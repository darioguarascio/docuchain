import limiter from "@utils/limiter.ts";
import * as controller from "@modules/documents/controllers/documents.controller.ts";

export const get = [limiter, controller.verifyDocument];
