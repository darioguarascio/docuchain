import crypto from 'crypto';

export interface PreviewEnvelope {
  version: number;
  algorithm: string;
  content_hash: string;
  metadata_hash: string;
  metadata: Record<string, any>;
  timestamp: string;
  hmac?: string;
}

export const deterministicStringify = (value: any): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(item => deterministicStringify(item)).join(',')}]`;
  }

  const keys = Object.keys(value).sort();
  const entries = keys.map(key => `${JSON.stringify(key)}:${deterministicStringify(value[key])}`);
  return `{${entries.join(',')}}`;
};

const hashBuffer = (buffer: Buffer): string => {
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

const hashMetadata = (metadata: Record<string, any>): string => {
  return crypto.createHash('sha256').update(deterministicStringify(metadata)).digest('hex');
};

export interface AttachPreviewResult {
  buffer: Buffer;
  envelope: PreviewEnvelope;
  encodedEnvelope: string;
}

export const attachPreviewEnvelope = (
  pdfBuffer: Buffer,
  metadata: Record<string, any>,
  hmacSecret?: string
): AttachPreviewResult => {
  const envelopeBase: PreviewEnvelope = {
    version: 1,
    algorithm: 'sha256',
    content_hash: hashBuffer(pdfBuffer),
    metadata_hash: hashMetadata(metadata ?? {}),
    metadata,
    timestamp: new Date().toISOString(),
  };

  if (hmacSecret) {
    const envelopeForHmac = deterministicStringify(envelopeBase);
    envelopeBase.hmac = crypto.createHmac('sha256', hmacSecret).update(envelopeForHmac).digest('hex');
  }

  const encodedEnvelope = Buffer.from(JSON.stringify(envelopeBase), 'utf-8').toString('base64');
  const marker = Buffer.from(`\n%%DocuChainPreview:${encodedEnvelope}\n`, 'utf-8');
  const bufferWithEnvelope = Buffer.concat([pdfBuffer, marker]);

  return {
    buffer: bufferWithEnvelope,
    envelope: envelopeBase,
    encodedEnvelope,
  };
};

export interface PreviewExtractionResult {
  envelope: PreviewEnvelope | null;
  unsignedBuffer: Buffer;
}

export const extractPreviewEnvelope = (pdfBuffer: Buffer): PreviewExtractionResult => {
  const markerTag = Buffer.from('%%DocuChainPreview:');
  const markerStart = pdfBuffer.lastIndexOf(markerTag);

  if (markerStart === -1) {
    return { envelope: null, unsignedBuffer: pdfBuffer };
  }

  const base64Start = markerStart + markerTag.length;
  const newlineIndex = pdfBuffer.indexOf('\n'.charCodeAt(0), base64Start);
  const base64Slice = pdfBuffer
    .slice(base64Start, newlineIndex === -1 ? undefined : newlineIndex)
    .toString('utf-8')
    .trim();

  try {
    const decoded = Buffer.from(base64Slice, 'base64').toString('utf-8');
    const envelope = JSON.parse(decoded) as PreviewEnvelope;

    let contentEnd = markerStart;
    if (contentEnd > 0 && pdfBuffer[contentEnd - 1] === 0x0a) {
      contentEnd -= 1;
    }
    if (contentEnd > 0 && pdfBuffer[contentEnd - 1] === 0x0d) {
      contentEnd -= 1;
    }

    const unsignedBuffer = pdfBuffer.slice(0, contentEnd);
    return { envelope, unsignedBuffer };
  } catch (error) {
    console.error('Failed to decode preview envelope:', error);
    return { envelope: null, unsignedBuffer: pdfBuffer };
  }
};

