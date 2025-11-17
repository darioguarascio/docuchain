import opentype from "opentype.js";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import env from "@utils/env.ts";

interface SignatureOptions {
  signatureText: string;
  label?: string;
  uuid?: string;
  fontPath?: string;
}

/**
 * Generates a signature SVG with label, signature text, UUID, and bracket
 */
export function generateSignatureSVG({
  signatureText,
  label = "Firmato digitalmente da:",
  uuid = null,
  fontPath = null,
}: SignatureOptions): string {
  const signatureUuid = uuid || uuidv4();

  const actualFontPath = fontPath || env.SIGNATURE_FONT_PATH;

  let font;
  let useCustomFont = false;

  try {
    if (fs.existsSync(actualFontPath)) {
      font = opentype.loadSync(actualFontPath);
      useCustomFont = true;
    }
  } catch (error) {
    console.warn(`Could not load font ${actualFontPath}:`, error);
  }

  function escapeXml(text: string): string {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function textToPath(
    font: opentype.Font,
    text: string,
    fontSize: number,
    x: number,
    y: number,
  ): string {
    const path = font.getPath(text, x, y, fontSize);
    const { commands } = path;
    let d = "";
    for (const cmd of commands) {
      if (cmd.type === "M") {
        d += `M ${cmd.x} ${cmd.y} `;
      } else if (cmd.type === "L") {
        d += `L ${cmd.x} ${cmd.y} `;
      } else if (cmd.type === "Q") {
        d += `Q ${cmd.x1} ${cmd.y1} ${cmd.x} ${cmd.y} `;
      } else if (cmd.type === "C") {
        d += `C ${cmd.x1} ${cmd.y1} ${cmd.x2} ${cmd.y2} ${cmd.x} ${cmd.y} `;
      } else if (cmd.type === "Z") {
        d += "Z ";
      }
    }
    return `<path d="${d.trim()}" fill="#000000" stroke="none"/>`;
  }

  const padding = 20;
  const bracketWidth = 12;
  const textStartX = padding + bracketWidth + 10;
  const labelY = padding + 16;
  const signatureY = padding + 20 + 12 + 22;
  const uuidY = padding + 20 + 12 + 30 + 12 + 12;

  const estimatedWidth = 400;
  const estimatedHeight = padding * 2 + 20 + 12 + 30 + 12 + 16;

  let signaturePath = "";
  if (useCustomFont && font) {
    try {
      signaturePath = textToPath(
        font,
        signatureText,
        24,
        textStartX,
        signatureY,
      );
    } catch (error) {
      console.warn("Error converting signature to path:", error);
      signaturePath = `<text x="${textStartX}" y="${signatureY}" font-size="24" fill="#000000">${escapeXml(signatureText)}</text>`;
    }
  } else {
    signaturePath = `<text x="${textStartX}" y="${signatureY}" font-family="Arial, sans-serif" font-size="24" fill="#000000">${escapeXml(signatureText)}</text>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${estimatedWidth}" height="${estimatedHeight}" viewBox="0 0 ${estimatedWidth} ${estimatedHeight}">
    <g>
      <!-- Bracket -->
      <path d="M ${padding} ${padding} Q ${padding} ${padding + 8} ${padding + 8} ${padding + 8} L ${padding + 8} ${estimatedHeight - padding - 8} Q ${padding} ${estimatedHeight - padding - 8} ${padding} ${estimatedHeight - padding}" 
            stroke="#CCCCCC" 
            stroke-width="4" 
            fill="none" 
            stroke-linecap="round" 
            stroke-linejoin="round"/>
      
      <!-- Label -->
      <text x="${textStartX}" y="${labelY}" font-family="Arial, sans-serif" font-size="14" fill="#000000">${escapeXml(label)}</text>
      
      <!-- Signature -->
      ${signaturePath}
      
      <!-- UUID -->
      <text x="${textStartX}" y="${uuidY}" font-family="Arial, sans-serif" font-size="11" fill="#000000">${escapeXml(signatureUuid)}</text>
    </g>
  </svg>`;

  return svg;
}

/**
 * Generates a signature and returns it as a base64 data URL (SVG)
 */
export function generateSignatureDataUrl(options: SignatureOptions): string {
  const svg = generateSignatureSVG(options);
  const base64Svg = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64Svg}`;
}
