import type { Request } from "express";

type MetadataRecord = Record<string, any>;

const escapeHtml = (unsafe: string): string =>
  unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const removeUndefined = (metadata: MetadataRecord): MetadataRecord => {
  const entries = Object.entries(metadata).filter(
    ([, value]) => value !== undefined && value !== null && value !== "",
  );
  return Object.fromEntries(entries);
};

export const buildRequestMetadata = (req: Request): MetadataRecord => {
  const forwardedFor = (req.headers["x-forwarded-for"] as string | undefined)
    ?.split(",")[0]
    ?.trim();

  const customMetadata =
    typeof req.body?.metadata === "object" && req.body?.metadata !== null
      ? req.body.metadata
      : {};

  return removeUndefined({
    timestamp: new Date().toISOString(),
    request_ip:
      (req.headers["cf-connecting-ip"] as string | undefined) ??
      forwardedFor ??
      req.ip ??
      undefined,
    forwarded_for: req.headers["x-forwarded-for"],
    user_agent: req.headers["user-agent"],
    referer: req.headers.referer ?? req.headers.referrer,
    host: req.headers.host,
    origin: req.headers.origin,
    request_id: req.headers["x-request-id"],
    trace_id: req.headers["x-b3-traceid"] ?? req.headers.traceparent,
    http_method: req.method,
    custom_metadata: customMetadata,
  });
};

export const appendHiddenMetadataBlock = (
  template: string,
  metadata?: MetadataRecord,
): string => {
  if (!metadata || Object.keys(metadata).length === 0) {
    return template;
  }

  const serialized = JSON.stringify(metadata);
  const hiddenBlock = `<div style="display:none;" data-docuchain-meta="true">${escapeHtml(serialized)}</div>`;
  const commentBlock = `<!--DOCUCHAIN_METADATA:${Buffer.from(serialized).toString("base64")}-->`;

  return `${template}\n\n${hiddenBlock}\n${commentBlock}`;
};

export default appendHiddenMetadataBlock;
