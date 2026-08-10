import { z } from "zod";

const environmentSchema = z.object({
  VITE_APP_ENV: z.enum(["development", "production", "test"]),
  VITE_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]),
});

const rawEnvironment =
  import.meta.env.MODE === "test"
    ? { VITE_APP_ENV: "test", VITE_LOG_LEVEL: "error" }
    : import.meta.env;

const parsedEnvironment = environmentSchema.parse(rawEnvironment);

export const appEnvironment = Object.freeze({
  mode: parsedEnvironment.VITE_APP_ENV,
  logLevel: parsedEnvironment.VITE_LOG_LEVEL,
});
