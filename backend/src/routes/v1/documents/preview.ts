import limiter from "@utils/limiter.ts";
import { previewDocumentValidator } from "@modules/documents/validators/documents.validator.ts";
import * as controller from "@modules/documents/controllers/documents.controller.ts";

export const post = [
  limiter,
  ...previewDocumentValidator,
  controller.previewDocument,
];
