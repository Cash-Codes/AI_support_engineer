import { z } from "zod";

const csv = (raw: string | undefined): string[] =>
  raw
    ? raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

const EnvSchema = z.object({
  PORT: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? 8080 : Number(v)))
    .refine((n) => Number.isFinite(n) && n > 0 && n < 65536, {
      message: "PORT must be a number in 1..65535",
    }),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  DEMO_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  ENABLE_PR_FLOW: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  PRODUCT_REPO_PATH: z.string().optional(),
  PRODUCT_REPO_URL: z.string().optional(),
  DOCS_DIR: z.string().optional(),
  RAG_CACHE_PATH: z.string().optional(),
  WIDGET_ALLOWED_ORIGINS: z.string().optional(),
  DASHBOARD_ORIGIN: z.string().optional(),
  SHORTCUT_API_TOKEN: z.string().optional(),
  SHORTCUT_WORKSPACE: z.string().optional(),
  SHORTCUT_WORKFLOW_STATE_ID: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : Number(v)))
    .refine((n) => n === undefined || Number.isFinite(n), {
      message: "SHORTCUT_WORKFLOW_STATE_ID must be numeric",
    }),
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_REPO: z.string().optional(),
});

export type LogLevel = z.infer<typeof EnvSchema>["LOG_LEVEL"];

export interface AppConfig {
  port: number;
  logLevel: LogLevel;
  demoMode: boolean;
  enablePrFlow: boolean;
  productRepo: { path?: string; url?: string };
  rag: { docsDir?: string; cachePath?: string };
  cors: { widgetOrigins: string[]; dashboardOrigin?: string };
  claude: { mode: "live" | "mock" };
  shortcut:
    | { mode: "mock" }
    | {
        mode: "live";
        token: string;
        workspace?: string;
        workflowStateId?: number;
      };
  github: { mode: "mock" } | { mode: "live"; token: string; repo: string };
}

export function parseConfig(raw: NodeJS.ProcessEnv): AppConfig {
  const normalized: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw)) {
    normalized[k] = v === "" ? undefined : v;
  }
  const env = EnvSchema.parse(normalized);

  const shortcut: AppConfig["shortcut"] = env.SHORTCUT_API_TOKEN
    ? {
        mode: "live",
        token: env.SHORTCUT_API_TOKEN,
        workspace: env.SHORTCUT_WORKSPACE,
        workflowStateId: env.SHORTCUT_WORKFLOW_STATE_ID,
      }
    : { mode: "mock" };

  const github: AppConfig["github"] =
    env.ENABLE_PR_FLOW && env.GITHUB_TOKEN && env.GITHUB_REPO
      ? { mode: "live", token: env.GITHUB_TOKEN, repo: env.GITHUB_REPO }
      : { mode: "mock" };

  // Claude mode is resolved in the entrypoint by checking for the credentials
  // file. This package defaults to "mock"; server bootstrap may override.
  const claude: AppConfig["claude"] = { mode: "mock" };

  return {
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    demoMode: env.DEMO_MODE,
    enablePrFlow: env.ENABLE_PR_FLOW,
    productRepo: {
      path: env.PRODUCT_REPO_PATH,
      url: env.PRODUCT_REPO_URL,
    },
    rag: {
      docsDir: env.DOCS_DIR,
      cachePath: env.RAG_CACHE_PATH,
    },
    cors: {
      widgetOrigins: csv(env.WIDGET_ALLOWED_ORIGINS),
      dashboardOrigin: env.DASHBOARD_ORIGIN,
    },
    claude,
    shortcut,
    github,
  };
}
