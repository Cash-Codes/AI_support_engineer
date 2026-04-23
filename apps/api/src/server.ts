import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { parseConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { createEmbedder } from "./rag/embeddings.js";
import { type Retriever, buildRetriever } from "./rag/indexer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

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

const app = createApp({ config, logger, retriever });

app.listen(config.port, () => {
  logger.info({ port: config.port }, "api listening");
});
