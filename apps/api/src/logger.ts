import type { Logger } from "pino";
import pino from "pino";
import type { AppConfig } from "./config.js";

export type { Logger };

export function createLogger(config: Pick<AppConfig, "logLevel">): Logger {
  return pino({
    level: config.logLevel,
    transport:
      process.env.NODE_ENV === "production"
        ? undefined
        : {
            target: "pino-pretty",
            options: { colorize: true, translateTime: "HH:MM:ss" },
          },
  });
}
