import multer from "multer";
import limiter from "@utils/limiter.ts";
import { signDocument } from "@modules/documents/controllers/documents.controller.ts";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
  },
});

export const post = [limiter, upload.single("pdf"), signDocument];
