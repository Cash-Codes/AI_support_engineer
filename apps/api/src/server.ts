import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import type { ClaudeClient } from "./clients/claude.js";
import { createLiveClaudeClient } from "./clients/claude.js";
import { createMockClaudeClient } from "./clients/claude.mock.js";
import { parseConfig } from "./config.js";
import { type FixtureLibrary, loadFixtures } from "./fixtures/index.js";
import { createLogger } from "./logger.js";
import { resolveProductRepo } from "./productRepo/bootstrap.js";
import { createEmbedder } from "./rag/embeddings.js";
import { type Retriever, buildRetriever } from "./rag/indexer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const CLAUDE_CREDENTIALS_PATH = "/root/.claude/.credentials.json";

const config = parseConfig(process.env);
const logger = createLogger(config);

// Docs live in the product repo (source of truth — they evolve with the
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

// Load demo / mock fixtures from repo-root fixtures/mock-responses/.
let fixtures: FixtureLibrary | undefined;
try {
  fixtures = await loadFixtures();
  logger.info({ count: fixtures.all().length }, "fixtures: loaded");
} catch (err) {
  logger.error(
    { err: err instanceof Error ? err.message : String(err) },
    "fixtures: failed to load — mock client will use fallback only",
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
    "rag: initialization failed — falling back to stub retrieval",
  );
}

// Pick the Claude client. The live client spawns the Claude Code CLI as a
// subprocess and needs OAuth credentials on disk. In every other case we
// use the fixture-backed mock — reproducible, fast, no credentials needed.
const claudeCredentialsPresent = await fileExists(CLAUDE_CREDENTIALS_PATH);
const claudeMode: "live" | "mock" =
  claudeCredentialsPresent && productRepo.exists ? "live" : "mock";

let claude: ClaudeClient;
if (claudeMode === "live" && productRepo.path) {
  claude = createLiveClaudeClient({
    productRepoPath: productRepo.path,
    credentialsPath: CLAUDE_CREDENTIALS_PATH,
    logger,
  });
  logger.info(
    { productRepoPath: productRepo.path },
    "claude: live CLI client active",
  );
} else if (fixtures) {
  claude = createMockClaudeClient(fixtures);
  logger.info(
    {
      reason: !claudeCredentialsPresent ? "no-credentials" : "no-product-repo",
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

const app = createApp({ config, logger, retriever, claude, fixtures });

app.listen(config.port, () => {
  logger.info({ port: config.port }, "api listening");
});

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
