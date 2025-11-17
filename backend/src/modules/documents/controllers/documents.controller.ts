import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { nanoid } from "nanoid";
import crypto from "crypto";
import Document from "@modules/documents/models/document.model.ts";
import {
  generateDocument,
  processMarkdownTemplate,
} from "@modules/documents/services/document.service.ts";
import { createBlock } from "@modules/blockchain/services/blockchain.service.ts";
import env from "@utils/env.ts";
import path from "path";
import fs from "fs";
import {
  appendHiddenMetadataBlock,
  buildRequestMetadata,
  extractSignatureSlots,
  replaceSignatureSlots,
  SignatureSlot,
  RequestMetadata,
} from "@modules/documents/utils/template-metadata.ts";
import {
  attachPreviewEnvelope,
  extractPreviewEnvelope,
  PreviewEnvelope,
  deterministicStringify,
} from "@modules/documents/utils/preview-envelope.ts";
import { calculateHash, calculateObjectHash } from "@utils/hash.ts";
import { generateSignatureSVG } from "@modules/signatures/services/signature.service.ts";

const resolveSlotLabel = (
  slot: SignatureSlot,
  placeholders?: Record<string, string>,
): string => {
  if (!placeholders || Object.keys(placeholders).length === 0) {
    return slot.label;
  }
  return processMarkdownTemplate(slot.label, placeholders);
};

const renderSignaturePlaceholder = (
  slot: SignatureSlot,
  placeholders?: Record<string, string>,
): string => {
  const displayLabel = resolveSlotLabel(slot, placeholders);
  return `<div style="border:2px dashed #94a3b8; border-radius:8px; padding:16px; margin:16px 0; background:#f8fafc;">
  <strong>Signature Slot:</strong> ${displayLabel}
  <div style="color:#64748b; font-size:14px;">
    This area will display the signature for <em>${slot.id}</em> when the document is signed.
  </div>
</div>`;
};

const renderSignatureSvg = (
  slot: SignatureSlot,
  signatureText: string,
  placeholders?: Record<string, string>,
): string => {
  // Resolve placeholders in signature text (e.g., {{party_a_name}})
  const resolvedSignatureText = placeholders
    ? processMarkdownTemplate(signatureText, placeholders)
    : signatureText;
  
  // Parse label: extract part outside parentheses for header
  // e.g., "Firma paziente (Jane Doe, Esq.)" -> "Firma paziente"
  const fullLabel = resolveSlotLabel(slot, placeholders);
  const labelMatch = fullLabel.match(/^([^(]+)(?:\s*\([^)]+\))?\s*$/);
  const displayLabel = labelMatch ? labelMatch[1].trim() : fullLabel;
  
  // Parse signature text: extract only the part inside parentheses
  // e.g., "Firma paziente (Jane Doe, Esq.)" -> "Jane Doe, Esq."
  const signatureMatch = resolvedSignatureText.match(/\(([^)]+)\)/);
  const signatureOnly = signatureMatch
    ? signatureMatch[1].trim()
    : resolvedSignatureText;
  
  // Generate a proper UUID for the signature (don't use slot.id)
  const svg = generateSignatureSVG({
    signatureText: signatureOnly,
    label: displayLabel,
    // uuid not provided - will auto-generate a proper UUID
  });
  // Encode SVG as data URL to avoid HTML parsing issues
  const base64Svg = Buffer.from(svg).toString("base64");
  const dataUrl = `data:image/svg+xml;base64,${base64Svg}`;
  // Match placeholder margin for alignment (16px 0) and ensure left alignment
  return `<div style="margin: 16px 0; display: block; text-align: left;"><img src="${dataUrl}" alt="Signature" style="display: inline-block; margin: 0 !important; vertical-align: top;" /></div>`;
};

interface SignaturePayloadEntry {
  slot: string;
  signatureText: string;
}

const normalizeSignaturePayload = (payload: any): SignaturePayloadEntry[] => {
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload
    .map((entry) => {
      if (!entry) {
        return null;
      }
      if (typeof entry === "string") {
        return { slot: entry, signatureText: entry };
      }
      if (typeof entry === "object" && typeof entry.slot === "string") {
        const slotId = entry.slot.trim();
        if (!slotId) {
          return null;
        }
        const signatureText =
          typeof entry.signatureText === "string" && entry.signatureText.length > 0
            ? entry.signatureText
            : slotId;
        return { slot: slotId, signatureText };
      }
      return null;
    })
    .filter((entry): entry is SignaturePayloadEntry => !!entry?.slot);
};

export const createDocument = async (req: Request, res: Response) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(422).send({ errors: result.array() });
  }

  const { template, placeholders, async: asyncProcessing } = req.body;
  if (typeof template !== "string" || template.length === 0) {
    return res.status(400).json({ error: "Template is required" });
  }
  const safePlaceholders =
    placeholders && typeof placeholders === "object"
      ? (placeholders as Record<string, string>)
      : {};

  try {
    const documentId = nanoid();
    const requestMetadata = buildRequestMetadata(req, {
      templateContent: template,
      signatureSlots: extractSignatureSlots(template),
      customMetadata:
        typeof req.body?.metadata === "object" ? req.body.metadata : undefined,
    });
    const mergedPlaceholders = {
      ...safePlaceholders,
      ...(requestMetadata.custom_metadata ?? {}),
    };
    const signatureSlots = requestMetadata.signature_slots ?? [];
    const previewTemplate = replaceSignatureSlots(
      template,
      signatureSlots,
      (slot) => renderSignaturePlaceholder(slot, mergedPlaceholders),
    );
    const templateWithMetadata = appendHiddenMetadataBlock(
      previewTemplate,
      requestMetadata,
    );

    // Create document record
    const document = await Document.create({
      document_id: documentId,
      template_content: templateWithMetadata,
      placeholders: safePlaceholders,
      status: asyncProcessing ? "pending" : "processing",
    });

    // If async processing is requested, queue the job
    if (asyncProcessing) {
      // Import Redis client
      const { createClient } = await import("redis");
      const redisClient = createClient({
        url: env.REDIS_URL || "redis://localhost:6379",
      });
      await redisClient.connect();

      const queueName = env.REDIS_QUEUE || "docuchain:documents:queue";
      await redisClient.rPush(
        queueName,
        JSON.stringify({
          documentId,
          template: templateWithMetadata,
          placeholders: safePlaceholders,
          metadata: requestMetadata,
        }),
      );

      await redisClient.quit();

      return res.status(202).json({
        document_id: documentId,
        status: "pending",
        message: "Document queued for processing",
        pdf_url: null,
      });
    }

    // Synchronous processing
    const outputPath = path.join(env.PDF_OUTPUT_DIR, `${documentId}.pdf`);

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate PDF
    const pdfBuffer = await generateDocument(
      templateWithMetadata,
      mergedPlaceholders,
      outputPath,
    );

    // Calculate content hash
    const contentHash = calculateHash(pdfBuffer);

    // Extract signature data from template - first process placeholders, then extract
    const processedTemplate = processMarkdownTemplate(
      templateWithMetadata,
      safePlaceholders,
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
      placeholders: safePlaceholders,
      pdf_path: outputPath,
      request_metadata: requestMetadata,
    });

    // Update document status
    await document.update({
      status: "completed",
      pdf_path: outputPath,
    });

    return res.status(201).json({
      document_id: documentId,
      status: "completed",
      pdf_url: `/api/v1/documents/${documentId}/pdf`,
    });
  } catch (error: any) {
    console.error("Error creating document:", error);
    return res
      .status(500)
      .json({ error: "Failed to create document", message: error.message });
  }
};

export const previewDocument = async (req: Request, res: Response) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(422).send({ errors: result.array() });
  }

  const { template, placeholders, metadata = {} } = req.body;
  const safePlaceholders =
    placeholders && typeof placeholders === "object"
      ? (placeholders as Record<string, string>)
      : {};

  try {
    const signatureSlots = extractSignatureSlots(template);
    const mergedPlaceholders = {
      ...safePlaceholders,
      ...(metadata ?? {}),
    };
    const previewTemplate = replaceSignatureSlots(
      template,
      signatureSlots,
      (slot) => renderSignaturePlaceholder(slot, mergedPlaceholders),
    );
    const requestMetadata = buildRequestMetadata(req, {
      customMetadata: metadata,
      templateContent: template,
      signatureSlots,
    });
    const templateWithMetadata = appendHiddenMetadataBlock(
      previewTemplate,
      requestMetadata,
    );
    const pdfBuffer = await generateDocument(
      templateWithMetadata,
      mergedPlaceholders,
    );

    const { buffer: bufferWithEnvelope, encodedEnvelope } =
      attachPreviewEnvelope(
        Buffer.from(pdfBuffer),
        requestMetadata,
        env.HMAC_SECRET_KEY,
      );

    res.setHeader("X-Docuchain-Preview-Signature", encodedEnvelope);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'inline; filename="docuchain-preview.pdf"',
    );
    return res.end(bufferWithEnvelope);
  } catch (error: any) {
    console.error("Error generating preview document:", error);
    return res.status(500).json({
      error: "Failed to generate preview document",
      message: error.message,
    });
  }
};

const parseJsonField = <T>(
  value?: string,
  fieldName?: string,
): T | undefined => {
  if (!value) {
    return undefined;
  }
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new Error(`Invalid JSON for field ${fieldName ?? "unknown"}`);
  }
};

const decodePreviewSignatureField = (raw?: string): PreviewEnvelope | null => {
  if (!raw) {
    return null;
  }
  try {
    const json = Buffer.from(raw, "base64").toString("utf-8");
    return JSON.parse(json) as PreviewEnvelope;
  } catch (error) {
    console.error("Failed to decode preview signature field:", error);
    return null;
  }
};

export const signDocument = async (req: Request, res: Response) => {
  const multerFile = (req as Request & { file?: Express.Multer.File }).file;
  if (!multerFile?.buffer) {
    return res
      .status(400)
      .json({ error: "PDF file upload is required (field name: pdf)" });
  }

  const pdfBuffer = multerFile.buffer;

  const { envelope: embeddedEnvelope, unsignedBuffer } =
    extractPreviewEnvelope(pdfBuffer);
  const providedEnvelope = decodePreviewSignatureField(
    req.body.preview_signature,
  );
  const envelope = providedEnvelope ?? embeddedEnvelope;

  if (!envelope) {
    return res
      .status(400)
      .json({ error: "Preview envelope not found in upload" });
  }

  if (envelope.hmac) {
    if (!env.HMAC_SECRET_KEY) {
      return res.status(400).json({
        error: "Preview envelope is signed but server has no HMAC secret",
      });
    }
    // Reconstruct envelope without hmac field (same as when creating)
    const { hmac: _hmac, ...envelopeWithoutHmac } = envelope;
    const hmac = crypto
      .createHmac("sha256", env.HMAC_SECRET_KEY)
      .update(deterministicStringify(envelopeWithoutHmac))
      .digest("hex");
    if (hmac !== envelope.hmac) {
      return res
        .status(422)
        .json({ error: "Preview envelope HMAC verification failed" });
    }
  }

  const bufferForHash = embeddedEnvelope ? unsignedBuffer : pdfBuffer;
  const actualHash = calculateHash(bufferForHash);
  if (actualHash !== envelope.content_hash) {
    return res
      .status(422)
      .json({ error: "Uploaded PDF does not match preview hash" });
  }

  const metadataHash = calculateObjectHash(envelope.metadata ?? {});
  if (metadataHash !== envelope.metadata_hash) {
    return res.status(422).json({ error: "Preview metadata hash mismatch" });
  }

  let extraMetadata: Record<string, any> = {};
  let placeholders: Record<string, any> = {};
  let signaturePayloadRaw: any = [];

  try {
    extraMetadata =
      parseJsonField<Record<string, any>>(req.body.metadata, "metadata") ?? {};
    placeholders =
      parseJsonField<Record<string, any>>(
        req.body.placeholders,
        "placeholders",
      ) ?? {};
    signaturePayloadRaw =
      parseJsonField<any>(req.body.signature_payload, "signature_payload") ??
      [];
  } catch (error: any) {
    return res
      .status(400)
      .json({ error: error.message ?? "Invalid JSON input" });
  }

  const signatureEntries = normalizeSignaturePayload(signaturePayloadRaw);
  const metadataCustom =
    (envelope.metadata?.custom_metadata as Record<string, string>) ?? {};
  const mergedPlaceholders = { ...metadataCustom, ...placeholders };
  const slotSignatureMap = new Map(
    signatureEntries.map((entry) => [entry.slot, entry.signatureText]),
  );

  try {
    const baseTemplate = envelope.metadata?.template_content as string | undefined;
    if (!baseTemplate) {
      return res.status(400).json({
        error: "Preview metadata missing template content",
      });
    }

    const slotsFromMetadata: SignatureSlot[] = Array.isArray(
      envelope.metadata?.signature_slots,
    )
      ? (envelope.metadata?.signature_slots as SignatureSlot[])
      : [];

    const signedTemplate = replaceSignatureSlots(
      baseTemplate,
      slotsFromMetadata,
      (slot) =>
        renderSignatureSvg(
          slot,
          slotSignatureMap.get(slot.id) ?? slot.label ?? slot.id,
          mergedPlaceholders,
        ),
    );

    const finalMetadata: RequestMetadata = {
      ...(envelope.metadata as RequestMetadata),
      signature_slots: slotsFromMetadata,
      signature_payload: signatureEntries,
      user_metadata: extraMetadata,
      template_content: baseTemplate,
    };

    const templateWithMetadata = appendHiddenMetadataBlock(
      signedTemplate,
      finalMetadata,
    );

    const documentId = nanoid();
    const outputPath = path.join(env.PDF_OUTPUT_DIR, `${documentId}.pdf`);
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const finalPdfBuffer = await generateDocument(
      templateWithMetadata,
      mergedPlaceholders,
      outputPath,
    );
    const finalContentHash = calculateHash(finalPdfBuffer);

    await Document.create({
      document_id: documentId,
      template_content: templateWithMetadata,
      placeholders,
      status: "completed",
      pdf_path: outputPath,
    });

    await createBlock(
      documentId,
      finalContentHash,
      JSON.stringify(signatureEntries),
      {
        placeholders,
        preview_metadata: envelope.metadata,
        user_metadata: extraMetadata,
      },
    );

    return res.status(201).json({
      document_id: documentId,
      status: "completed",
      pdf_url: `/api/v1/documents/${documentId}/pdf`,
      content_hash: finalContentHash,
    });
  } catch (error: any) {
    console.error("Error signing document:", error);
    return res
      .status(500)
      .json({ error: "Failed to sign document", message: error.message });
  }
};

const getDocumentIdParam = (req: Request): string | null => {
  const documentId = req.params?.documentId;
  if (typeof documentId !== "string" || documentId.length === 0) {
    return null;
  }
  return documentId;
};

export const getDocument = async (req: Request, res: Response) => {
  const documentId = getDocumentIdParam(req);
  if (!documentId) {
    return res.status(400).json({ error: "documentId is required" });
  }

  try {
    const document = await Document.findOne({
      where: { document_id: documentId },
    });

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    return res.json({
      document_id: document.document_id,
      status: document.status,
      created_at: document.created_at,
      pdf_url: document.pdf_path ? `/api/v1/documents/${documentId}/pdf` : null,
    });
  } catch (error: any) {
    console.error("Error fetching document:", error);
    return res
      .status(500)
      .json({ error: "Failed to fetch document", message: error.message });
  }
};

export const getDocumentPdf = async (req: Request, res: Response) => {
  const documentId = getDocumentIdParam(req);
  if (!documentId) {
    return res.status(400).json({ error: "documentId is required" });
  }

  try {
    const document = await Document.findOne({
      where: { document_id: documentId },
    });

    if (!document || !document.pdf_path) {
      return res.status(404).json({ error: "PDF not found" });
    }

    if (!fs.existsSync(document.pdf_path)) {
      return res.status(404).json({ error: "PDF file not found on disk" });
    }

    const pdfBuffer = fs.readFileSync(document.pdf_path);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${documentId}.pdf"`,
    );
    return res.send(pdfBuffer);
  } catch (error: any) {
    console.error("Error fetching PDF:", error);
    return res
      .status(500)
      .json({ error: "Failed to fetch PDF", message: error.message });
  }
};

export const verifyDocument = async (req: Request, res: Response) => {
  const documentId = getDocumentIdParam(req);
  if (!documentId) {
    return res.status(400).json({ error: "documentId is required" });
  }

  try {
    const { verifyDocument: verifyDoc } = await import(
      "@modules/blockchain/services/blockchain.service.ts"
    );
    const result = await verifyDoc(documentId);

    return res.json(result);
  } catch (error: any) {
    console.error("Error verifying document:", error);
    return res
      .status(500)
      .json({ error: "Failed to verify document", message: error.message });
  }
};

export const verifyDocumentByFile = async (req: Request, res: Response) => {
  try {
    // Check if file was uploaded
    if (!req.body || !Buffer.isBuffer(req.body)) {
      return res.status(400).json({
        error:
          "PDF file is required. Send the PDF file as raw binary data with Content-Type: application/pdf",
      });
    }

    const pdfBuffer = Buffer.from(req.body);

    // Calculate content hash
    const contentHash = calculateHash(pdfBuffer);

    // Verify by hash
    const { verifyDocumentByHash } = await import(
      "@modules/blockchain/services/blockchain.service.ts"
    );
    const result = await verifyDocumentByHash(contentHash);

    return res.json({
      ...result,
      content_hash: contentHash,
    });
  } catch (error: any) {
    console.error("Error verifying document by file:", error);
    return res
      .status(500)
      .json({ error: "Failed to verify document", message: error.message });
  }
};
