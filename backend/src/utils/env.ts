import dotenv from "dotenv";

dotenv.config();

interface Env {
  [key: string]: any;
  APP_ENV: string;
  APP_NAME: string;
  CORS_METHODS: string;
  CORS_ORIGIN: string;
  LISTENING_PORT: number;
  VERSION: string;
  LIMITER_LIMIT: number;
  LIMITER_WINDOW: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_SECRET: string;
  JWT_COOKIE_NAME: string;
  GRACEFUL_TIMEOUT_MS: number;
  SIGNATURE_FONT_PATH: string;
  PDF_OUTPUT_DIR: string;
  HMAC_SECRET_KEY: string;
  REDIS_QUEUE: string;
}

const getv = function (name: string, def: any): any {
  return process.env[name] || def;
};

const envs: Env = {
  APP_ENV: getv("APP_ENV", "dev"),
  APP_NAME: getv("APP_NAME", "docuchain"),
  CORS_METHODS: getv("CORS_METHODS", "GET,POST,DELETE,PUT"),
  CORS_ORIGIN: getv("CORS_ORIGIN", "*").split(","),
  LISTENING_PORT: parseInt(getv("LISTENING_PORT", 3000)),
  VERSION: getv("VERSION", "0.0.0"),
  LIMITER_LIMIT: parseInt(getv("LIMITER_LIMIT", 100)),
  LIMITER_WINDOW: parseInt(getv("LIMITER_WINDOW", 15 * 60)),
  DATABASE_URL: getv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/postgres",
  ),
  REDIS_URL: getv("REDIS_URL", "redis://localhost:6379"),
  JWT_SECRET: getv("JWT_SECRET", "docuchain-jwt-secret-change-in-production"),
  JWT_COOKIE_NAME: getv("JWT_COOKIE_NAME", "jwt"),
  GRACEFUL_TIMEOUT_MS: parseInt(getv("GRACEFUL_TIMEOUT_MS", "10000")),
  SIGNATURE_FONT_PATH: getv(
    "SIGNATURE_FONT_PATH",
    "./assets/fonts/Priestacy.otf",
  ),
  PDF_OUTPUT_DIR: getv("PDF_OUTPUT_DIR", "./tmp/pdfs"),
  HMAC_SECRET_KEY: getv(
    "HMAC_SECRET_KEY",
    "super-secret-hmac-key-change-in-production",
  ),
  REDIS_QUEUE: getv("REDIS_QUEUE", "docuchain:documents:queue"),
};

export default envs;
