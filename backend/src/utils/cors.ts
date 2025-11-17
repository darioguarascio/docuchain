import cors from "cors";
import env from "@utils/env.ts";

const origin =
  Array.isArray(env.CORS_ORIGIN) && env.CORS_ORIGIN.includes("*")
    ? true
    : env.CORS_ORIGIN;

const corsOptions = {
  origin,
  credentials: true,
  methods: env.CORS_METHODS,
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

export default cors(corsOptions);
