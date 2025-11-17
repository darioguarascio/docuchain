import { Request, Response } from "express";
import * as crypto from "crypto";
import {
  generateDocument,
  processMarkdownTemplate,
} from "@modules/documents/services/document.service.ts";
import { createBlock } from "@modules/blockchain/services/blockchain.service.ts";
import env from "@utils/env.ts";
import path from "path";
import { appendHiddenMetadataBlock } from "@modules/documents/utils/template-metadata.ts";

/**
 * Internal endpoint for worker to generate documents
 * This endpoint is called by the worker, not by external clients
 */
export const post = async (req: Request, res: Response) => {
  const { documentId, template, placeholders, metadata = {} } = req.body;

  if (!documentId || !template) {
    return res
      .status(400)
      .json({ error: "documentId and template are required" });
  }

  try {
    const outputPath = path.join(env.PDF_OUTPUT_DIR, `${documentId}.pdf`);

    // Generate PDF
    const templateWithMetadata = template.includes('data-docuchain-meta="true"')
      ? template
      : appendHiddenMetadataBlock(template, metadata);

    const pdfBuffer = await generateDocument(
      templateWithMetadata,
      placeholders || {},
      outputPath,
    );

    // Calculate content hash
    const contentHash = crypto
      .createHash("sha256")
      .update(pdfBuffer)
      .digest("hex");

    // Extract signature data from template - first process placeholders, then extract
    const processedTemplate = processMarkdownTemplate(
      templateWithMetadata,
      placeholders || {},
    );
    const signaturePattern =
      /\{\{signature:([^:}]+)(?::([^:}]*))?(?::([^:}]*))?(?::([^}]*))?\}\}/g;
    const signatures: string[] = [];
    let match;
    while ((match = signaturePattern.exec(processedTemplate)) !== null) {
      signatures.push(match[1]);
    }
    const signatureData = JSON.stringify(signatures);

    // Create blockchain block
    await createBlock(documentId, contentHash, signatureData, {
      placeholders,
      pdf_path: outputPath,
      request_metadata: metadata,
    });

    return res.json({
      success: true,
      document_id: documentId,
      pdf_path: outputPath,
    });
  } catch (error: any) {
    console.error("Error generating document:", error);
    return res
      .status(500)
      .json({ error: "Failed to generate document", message: error.message });
  }
};
