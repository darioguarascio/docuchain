/**
 * Helper class to retrive config from env var (when running with docker) or local file (when running in dev)
 */

const getv = function (name, def) {
  const isServer = typeof window === "undefined";
  if (isServer) {
    return (process as any).env?.[name] || import.meta.env[name] || def;
  }
  return import.meta.env[name] || def;
};

const toBool = (val: any, def = false): boolean => {
  if (val === undefined || val === null) return def;
  if (typeof val === "boolean") return val;
  return String(val).toLowerCase() === "true";
};

const envs = {
  PUBLIC_DOCUCHAIN_BACKEND_URL: getv(
    "PUBLIC_DOCUCHAIN_BACKEND_URL",
    "/api/v1",
  ),
  VERSION: getv("VERSION", "0.0.0"),

  // JWT/cookie settings shared by Express and Astro
  JWT_SECRET: getv("JWT_SECRET", "my-jwt-secret-2024"),
  JWT_COOKIE_NAME: getv("JWT_COOKIE_NAME", "jwt"),
  JWT_COOKIE_TTL_MS: Number(getv("JWT_COOKIE_TTL_MS", 3600 * 1000)),
  JWT_COOKIE_SAMESITE: getv("JWT_COOKIE_SAMESITE", "Lax"),
  JWT_COOKIE_SECURE: toBool(getv("JWT_COOKIE_SECURE", "false")),

  // HMAC secret for SPP authentication
  HMAC_SECRET_KEY: getv("HMAC_SECRET_KEY", "my-super-secret-hmac-key-2024"),

  // Application environment
  APP_ENV: getv("APP_ENV", "production"),

  MOUNT_PATH: getv("MOUNT_PATH", "/"),
};

export default envs;
