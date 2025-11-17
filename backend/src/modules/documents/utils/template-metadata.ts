import type { Request } from "express";
import { nanoid } from "nanoid";

export interface SignatureSlot {
  id: string;
  label: string;
  placeholder: string;
}

export interface SignaturePayloadEntry {
  slot: string;
  signatureText: string;
}

export interface RequestMetadata {
  timestamp: string;
  request_id: string;
  request_ip?: string;
  forwarded_for?: string;
  user_agent?: string;
  referer?: string;
  host?: string;
  origin?: string;
  traceparent?: string;
  http_method?: string;
  custom_metadata?: Record<string, any>;
  signature_slots?: SignatureSlot[];
  template_content?: string;
  signature_payload?: SignaturePayloadEntry[];
}

const escapeHtml = (unsafe: string): string =>
  unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const removeUndefined = <T extends Record<string, any>>(metadata: T): T =>
  Object.fromEntries(
    Object.entries(metadata).filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    ),
  ) as T;

export const extractSignatureSlots = (template: string): SignatureSlot[] => {
  const slots: SignatureSlot[] = [];
  const prefix = "{{signature_slot:";
  let index = 0;

  while (index < template.length) {
    const start = template.indexOf(prefix, index);
    if (start === -1) break;

    let cursor = start + prefix.length;
    let slotId = "";
    while (cursor < template.length) {
      const char = template[cursor];
      if (char === ":" || (char === "}" && template[cursor + 1] === "}")) {
        break;
      }
      slotId += char;
      cursor++;
    }
    slotId = slotId.trim();
    if (!slotId) {
      index = cursor + 2;
      continue;
    }

    let label = "";
    let depth = 0;
    if (template[cursor] === ":") {
      cursor++;
      while (cursor < template.length) {
        if (template.startsWith("{{", cursor)) {
          depth++;
          label += "{{";
          cursor += 2;
          continue;
        }
        if (template.startsWith("}}", cursor)) {
          if (depth === 0) {
            cursor += 2;
            break;
          }
          depth--;
          label += "}}";
          cursor += 2;
          continue;
        }
        label += template[cursor];
        cursor++;
      }
    } else if (template.startsWith("}}", cursor)) {
      cursor += 2;
    }

    const placeholder = template.slice(start, cursor);
    slots.push({
      id: slotId,
      label: (label && label.trim()) || slotId || "Signature",
      placeholder,
    });

    index = cursor;
  }

  return slots;
};

export const replaceSignatureSlots = (
  template: string,
  slots: SignatureSlot[],
  slotRenderer: (slot: SignatureSlot) => string,
): string => {
  let processed = template;
  slots.forEach((slot) => {
    processed = processed.replace(slot.placeholder, slotRenderer(slot));
  });
  return processed;
};

export const buildRequestMetadata = (
  req: Request,
  options?: {
    customMetadata?: Record<string, any>;
    templateContent?: string;
    signatureSlots?: SignatureSlot[];
  },
): RequestMetadata => {
  const forwardedFor = (req.headers["x-forwarded-for"] as string | undefined)
    ?.split(",")[0]
    ?.trim();

  const metadata = removeUndefined<RequestMetadata>({
    timestamp: new Date().toISOString(),
    request_id: (req.headers["x-request-id"] as string) ?? nanoid(),
    request_ip:
      (req.headers["cf-connecting-ip"] as string | undefined) ??
      forwardedFor ??
      req.ip ??
      undefined,
    forwarded_for: req.headers["x-forwarded-for"] as string | undefined,
    user_agent: req.headers["user-agent"] as string | undefined,
    referer:
      (req.headers.referer as string | undefined) ??
      (req.headers.referrer as string | undefined),
    host: req.headers.host,
    origin: req.headers.origin as string | undefined,
    traceparent: req.headers.traceparent as string | undefined,
    http_method: req.method,
    custom_metadata: options?.customMetadata,
    signature_slots: options?.signatureSlots,
    template_content: options?.templateContent,
  });

  return metadata;
};

export const appendHiddenMetadataBlock = (
  template: string,
  metadata?: RequestMetadata,
): string => {
  if (!metadata) {
    return template;
  }

  const serialized = JSON.stringify(metadata);
  const hiddenBlock = `<div style="display:none;" data-docuchain-meta="true">${escapeHtml(serialized)}</div>`;
  const commentBlock = `<!--DOCUCHAIN_METADATA:${Buffer.from(serialized).toString(
    "base64",
  )}-->`;

  return `${template}\n\n${hiddenBlock}\n${commentBlock}`;
};
