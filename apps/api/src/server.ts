import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createApp } from "./app.js";
import type { ClaudeClient } from "./clients/claude.js";
import { createLiveClaudeClient } from "./clients/claude.js";
import { createMockClaudeClient } from "./clients/claude.mock.js";
import { type GithubClient, createLiveGithubClient } from "./clients/github.js";
import { createMockGithubClient } from "./clients/github.mock.js";
import {
  type ShortcutClient,
  createLiveShortcutClient,
} from "./clients/shortcut.js";
import { createMockShortcutClient } from "./clients/shortcut.mock.js";
import { parseConfig } from "./config.js";
import { type FixtureLibrary, loadFixtures } from "./fixtures/index.js";
import { createLogger } from "./logger.js";
import { resolveProductRepo } from "./productRepo/bootstrap.js";
import { createEmbedder } from "./rag/embeddings.js";
import { type Retriever, buildRetriever } from "./rag/indexer.js";
import { SqliteSessionStore } from "./sessions/sqliteStore.js";
import { InMemorySessionStore, type SessionStore } from "./sessions/store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

// The Claude Code CLI finds its OAuth credentials on its own - we don't
// inject ANTHROPIC_API_KEY or pass a path. At boot we only need to decide
// whether to wire the live client at all (vs. falling back to the
// fixture-backed mock, which is honest in deploys without creds).
//
// Storage backends differ by environment:
//   • Cloud Run / Docker - credentials mounted as a file at
//     /root/.claude/.credentials.json
//   • Linux / older mac CLI - file at ~/.claude/.credentials.json
//   • Modern macOS CLI - credentials live in the Keychain, no file at all.
//     `claude auth status` is the portable check.
const CLAUDE_CREDENTIALS_FILE_CANDIDATES = [
  "/root/.claude/.credentials.json",
  path.join(os.homedir(), ".claude/.credentials.json"),
];
const execFileAsync = promisify(execFile);

const config = parseConfig(process.env);
const logger = createLogger(config);

// Docs live in the product repo (source of truth - they evolve with the
// code they describe). When PRODUCT_REPO_PATH is set we read from there;
// otherwise fall back to a local docs/ in this repo for offline dev.
const docsDir =
  config.rag.docsDir ??
  (config.productRepo.path
    ? path.join(config.productRepo.path, "docs")
    : path.join(REPO_ROOT, "docs"));
const cachePath =
  config.rag.cachePath ?? path.join(REPO_ROOT, "data/rag-index.json");

// Resolve the product repo path up front so both docs + code investigation
// share the same source of truth.
const productRepo = await resolveProductRepo({
  configPath: config.productRepo.path,
  configUrl: config.productRepo.url,
  logger,
});

// Load demo fixtures (Cloud-Run-style fallback when no live LLM is wired).
// In dev with Claude credentials configured, fixtures are unused - real
// Claude answers every query. Set FIXTURES_DIR to a product-specific
// fixtures folder (e.g. /path/to/pulsefile/fixtures/mock-responses) for a
// deploy demo without burning tokens.
let fixtures: FixtureLibrary | undefined;
try {
  fixtures = await loadFixtures(config.fixtures.dir);
  const count = fixtures.all().length;
  if (count === 0) {
    logger.info(
      { dir: config.fixtures.dir ?? "(default, empty)" },
      "fixtures: no demo fixtures - mock client will use the generic fallback",
    );
  } else {
    logger.info(
      { count, dir: config.fixtures.dir ?? "(default)" },
      "fixtures: loaded",
    );
  }
} catch (err) {
  logger.error(
    { err: err instanceof Error ? err.message : String(err) },
    "fixtures: failed to load - mock client will use fallback only",
  );
}

// Build the RAG retriever against whichever docs dir we resolved.
let retriever: Retriever | undefined;
try {
  logger.info({ docsDir, cachePath }, "rag: initializing");
  const embedder = await createEmbedder();
  retriever = await buildRetriever({ docsDir, cachePath, embedder, logger });
  logger.info({ ragIndexed: retriever.size() }, "rag: ready");
} catch (err) {
  logger.error(
    { err: err instanceof Error ? err.message : String(err) },
    "rag: initialization failed - falling back to stub retrieval",
  );
}

// Pick the Claude client. The live client spawns the Claude Code CLI as a
// subprocess and needs OAuth credentials available somewhere it can read
// them (file or Keychain). In every other case we use the fixture-backed
// mock - reproducible, fast, no credentials needed.
const claudeAuth = await detectClaudeAuth();
const claudeMode: "live" | "mock" =
  claudeAuth.kind !== "none" && productRepo.exists ? "live" : "mock";

let claude: ClaudeClient;
if (claudeMode === "live" && productRepo.path) {
  claude = createLiveClaudeClient({
    productRepoPath: productRepo.path,
    logger,
  });
  logger.info(
    { productRepoPath: productRepo.path, auth: claudeAuth },
    "claude: live CLI client active",
  );
} else if (fixtures) {
  claude = createMockClaudeClient(fixtures);
  logger.info(
    {
      reason: claudeAuth.kind === "none" ? "no-credentials" : "no-product-repo",
    },
    "claude: mock client active",
  );
} else {
  claude = createMockClaudeClient({
    match: () => undefined,
    all: () => [],
    fallback: () => ({
      slug: "no-fixtures",
      keywords: [],
      router: {
        escalate: false,
        rationale: "no fixtures available",
        confidence: "low",
      },
      resolution: {
        explanation: "Mock client running without fixtures.",
        workaround: "Configure fixtures or run against a live Claude CLI.",
        confidence: "low",
        citations: [],
      },
    }),
  });
  logger.warn("claude: mock client active with no fixtures");
}

// Pick the GitHub client. Live mode requires both ENABLE_PR_FLOW=true and
// either GH_TOKEN/GITHUB_TOKEN (gh CLI authentication). The mock client
// returns a deterministic fake URL.
let github: GithubClient;
if (config.github.mode === "live") {
  github = createLiveGithubClient({ token: config.github.token, logger });
  logger.info({ repo: config.github.repo }, "github: live client active");
} else {
  github = createMockGithubClient();
  logger.info("github: mock client active");
}

// Pick the Shortcut client. Live mode requires both SHORTCUT_API_TOKEN
// (already in config) and - for most workspaces - a workflow_state_id. In
// every other case we use the deterministic mock.
let shortcut: ShortcutClient;
if (config.shortcut.mode === "live") {
  shortcut = createLiveShortcutClient({
    apiToken: config.shortcut.token,
    apiBase: config.shortcut.apiBase,
    workflowStateId: config.shortcut.workflowStateId,
    logger,
  });
  logger.info(
    {
      apiBase: config.shortcut.apiBase,
      workspaceSlug: config.shortcut.workspaceSlug ?? "(none)",
      workflowStateId: config.shortcut.workflowStateId ?? "(none)",
    },
    "shortcut: live client active",
  );
} else {
  shortcut = createMockShortcutClient({
    workspaceSlug: config.shortcut.workspaceSlug,
  });
  logger.info(
    { workspaceSlug: config.shortcut.workspaceSlug ?? "(none)" },
    "shortcut: mock client active",
  );
}

// Pick the session store. SQLite when DATABASE_PATH is set (default in
// dev: data/sessions.db); in-memory otherwise. The store interface is
// identical, so the rest of the app doesn't care.
const dbPath = config.database.path ?? path.join(REPO_ROOT, "data/sessions.db");
let sessions: SessionStore;
if (config.database.path !== undefined || process.env.NODE_ENV !== "test") {
  sessions = new SqliteSessionStore({ dbPath });
  logger.info({ dbPath }, "sessions: sqlite store active");
} else {
  sessions = new InMemorySessionStore();
  logger.info("sessions: in-memory store active");
}

const app = createApp({
  config,
  logger,
  sessions,
  retriever,
  claude,
  shortcut,
  github,
  fixtures,
  productRepoPath: productRepo.path,
  productRepoBaseBranch: config.productRepo.baseBranch,
});

app.listen(config.port, () => {
  logger.info({ port: config.port }, "api listening");
});

type ClaudeAuth =
  | { kind: "none" }
  | { kind: "file"; path: string }
  | { kind: "cli"; method?: string };

async function detectClaudeAuth(): Promise<ClaudeAuth> {
  for (const p of CLAUDE_CREDENTIALS_FILE_CANDIDATES) {
    try {
      await fs.access(p);
      return { kind: "file", path: p };
    } catch {
      // try next
    }
  }
  // Modern macOS CLI stores credentials in the Keychain. `claude auth
  // status` is the portable way to ask without caring about the backend.
  try {
    const { stdout } = await execFileAsync("claude", ["auth", "status"], {
      timeout: 5_000,
    });
    const parsed = JSON.parse(stdout) as {
      loggedIn?: boolean;
      authMethod?: string;
    };
    if (parsed.loggedIn) return { kind: "cli", method: parsed.authMethod };
  } catch {
    // claude not on PATH, or status reported error - treat as unauth.
  }
  return { kind: "none" };
}
