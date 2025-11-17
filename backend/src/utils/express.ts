import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import morgan from "@utils/morgan.ts";
import cors from "@utils/cors.ts";
import {
  incrementPendingRequests,
  decrementPendingRequests,
} from "@utils/health-state.ts";
import path from "path";
import { router } from "express-file-routing";
import { fileURLToPath } from "url";

const routes = await router({
  directory: path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "/../routes",
  ),
});

const app = express();

app.set("trust proxy", true);

app.use((_req, res, next) => {
  incrementPendingRequests();
  res.on("finish", () => {
    decrementPendingRequests();
  });
  next();
});

// Raw body parser for PDF file uploads (verify endpoint) - must be before other parsers
app.use(
  "/api/v1/documents/verify/file",
  express.raw({ type: "application/pdf", limit: "50mb" }),
);
app.use(
  "/api/v1/documents/sign",
  express.raw({ type: "application/pdf", limit: "50mb" }),
);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors);
app.use(morgan);

app.use("/api", routes);

export default app;
