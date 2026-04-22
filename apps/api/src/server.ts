import { createApp } from "./app.js";
import { parseConfig } from "./config.js";
import { createLogger } from "./logger.js";

const config = parseConfig(process.env);
const logger = createLogger(config);
const app = createApp({ config, logger });

app.listen(config.port, () => {
  logger.info({ port: config.port }, "api listening");
});
