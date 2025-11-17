import MarkdownIt from "markdown-it";
import puppeteer, { Browser } from "puppeteer";
import fs from "fs";
import path from "path";
import { generateSignatureSVG } from "@modules/signatures/services/signature.service.ts";

const md = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true,
});

// Custom renderer for images to support dimension attributes
md.renderer.rules.image = (tokens, idx) => {
  const token = tokens[idx];
  if (!token) {
    return "";
  }
  const src = token.attrGet("src") || "";
  const alt = token.content || "";
  const title = token.attrGet("title") || "";

  // Check for dimension attributes in alt text or title
  // Format: ![alt](url "title{width=100,height=200}")
  let width = "";
  let height = "";
  let style = "";

  // Parse dimensions from title if present
  const titleMatch =
    title.match(/\{width=(\d+),?height=(\d+)?\}/i) ||
    title.match(/\{height=(\d+),?width=(\d+)?\}/i);
  if (titleMatch) {
    width = titleMatch[1] || "";
    height = titleMatch[2] || titleMatch[1] || "";
    // Remove dimension syntax from title
    const cleanTitle = title.replace(/\{.*?\}/, "").trim();
    if (width || height) {
      style = `style="width: ${width}px; height: ${height}px; object-fit: contain;"`;
    }
    return `<img src="${src}" alt="${alt}" ${title ? `title="${cleanTitle}"` : ""} ${style} />`;
  }

  // Parse dimensions from alt text if present
  const altMatch =
    alt.match(/\{width=(\d+),?height=(\d+)?\}/i) ||
    alt.match(/\{height=(\d+),?width=(\d+)?\}/i);
  if (altMatch) {
    width = altMatch[1] || "";
    height = altMatch[2] || altMatch[1] || "";
    const cleanAlt = alt.replace(/\{.*?\}/, "").trim();
    if (width || height) {
      style = `style="width: ${width}px; height: ${height}px; object-fit: contain;"`;
    }
    return `<img src="${src}" alt="${cleanAlt}" ${title ? `title="${title}"` : ""} ${style} />`;
  }

  // Default rendering
  return `<img src="${src}" alt="${alt}" ${title ? `title="${title}"` : ""} />`;
};

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browserInstance;
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

interface PlaceholderData {
  [key: string]: string;
}

/**
 * Processes markdown content and replaces placeholders
 */
export function processMarkdownTemplate(
  markdownContent: string,
  placeholders: PlaceholderData,
): string {
  let processed = markdownContent;

  // Replace simple placeholders like {{name}}, {{date}}, etc.
  Object.keys(placeholders).forEach((key) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    processed = processed.replace(regex, placeholders[key]);
  });

  return processed;
}

/**
 * Converts markdown to HTML with signature placeholders processed
 */
export function markdownToHtml(markdownContent: string): string {
  const signaturePattern =
    /\{\{signature:([^:}]+)(?::([^:}]*))?(?::([^:}]*))?(?::([^}]*))?\}\}/g;
  const signatures: Array<{ placeholder: string; svg: string }> = [];
  const placeholders: Array<{ original: string; placeholder: string }> = [];

  const matches = [...markdownContent.matchAll(signaturePattern)];
  matches.forEach((match, index) => {
    const signatureText = (match[1] ?? "").trim();
    const label =
      match[2] && match[2].length > 0 ? match[2] : "Firmato digitalmente da:";
    const uuid = match[3] && match[3].length > 0 ? match[3] : undefined;
    const fontFamily = match[4] && match[4].length > 0 ? match[4] : undefined;

    const svg = generateSignatureSVG({
      signatureText,
      label,
      uuid,
      fontPath: fontFamily,
    });

    const placeholder = `<!-- SIGNATURE_PLACEHOLDER_${index}_${Date.now()} -->`;
    signatures.push({ placeholder, svg });
    placeholders.push({ original: match[0], placeholder });
  });

  let processedContent = markdownContent;
  placeholders.forEach(({ original, placeholder }) => {
    processedContent = processedContent.replace(original, placeholder);
  });

  let html = md.render(processedContent);

  signatures.forEach(({ placeholder, svg }) => {
    const svgHtml = `<div style="max-width: 100%; margin: 1em 0; display: block;">${svg}</div>`;
    html = html.split(placeholder).join(svgHtml);
  });

  return html;
}

/**
 * Converts HTML to PDF
 */
export async function htmlToPdf(
  html: string,
  outputPath?: string,
): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  // Wrap HTML with proper styling for images and content
  const styledHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 100%;
    }
    img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 1em auto;
    }
    div[style*="margin: 16px 0"] img {
      margin: 0;
      display: inline-block;
    }
    h1, h2, h3, h4, h5, h6 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
    }
    p {
      margin: 1em 0;
    }
    code {
      background-color: #f4f4f4;
      padding: 2px 4px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
    }
    pre {
      background-color: #f4f4f4;
      padding: 1em;
      border-radius: 5px;
      overflow-x: auto;
    }
    blockquote {
      border-left: 4px solid #ddd;
      margin: 1em 0;
      padding-left: 1em;
      color: #666;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #f4f4f4;
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>
  `;

  await page.setContent(styledHtml, { waitUntil: "networkidle0" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: {
      top: "20mm",
      right: "15mm",
      bottom: "20mm",
      left: "15mm",
    },
  });

  await page.close();

  if (outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, pdfBuffer);
  }

  return pdfBuffer;
}

/**
 * Generates a PDF document from markdown template
 */
export async function generateDocument(
  markdownTemplate: string,
  placeholders: PlaceholderData,
  outputPath?: string,
): Promise<Buffer> {
  // Process placeholders
  const processedMarkdown = processMarkdownTemplate(
    markdownTemplate,
    placeholders,
  );

  // Convert to HTML with signatures
  const html = markdownToHtml(processedMarkdown);

  // Convert to PDF
  const pdfBuffer = await htmlToPdf(html, outputPath);

  return pdfBuffer;
}
