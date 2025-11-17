import rateLimit from "express-rate-limit";
import env from "@utils/env.ts";

const limiter = rateLimit({
  windowMs: env.LIMITER_WINDOW * 1000,
  max: env.LIMITER_LIMIT,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true,
});

export default limiter;
