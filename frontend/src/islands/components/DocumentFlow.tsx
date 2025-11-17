import * as React from "react";
import { Toaster } from "@islands/components/ui/sonner";
import env from "@utils/env";
import { DocumentEditor } from "./DocumentEditor";
import { DocumentPreview } from "./DocumentPreview";
import { DocumentVerifier } from "./DocumentVerifier";

const resolveBackendBase = () => {
  const apiUrl = env.PUBLIC_DOCUCHAIN_BACKEND_URL || "";
  if (!apiUrl) {
    if (typeof window !== "undefined") {
      return window.location.origin;
    }
    return "";
  }
  return apiUrl.replace(/\/api\/v1.*$/, "");
};

export function DocumentFlow() {
  const [previewPdfBlob, setPreviewPdfBlob] = React.useState<Blob | null>(null);
  const [previewSignature, setPreviewSignature] = React.useState<string>("");
  const [signedDocumentId, setSignedDocumentId] = React.useState<string | null>(
    null,
  );
  const [signedPdfUrl, setSignedPdfUrl] = React.useState<string | null>(null);
  const [placeholders, setPlaceholders] = React.useState<
    Record<string, string>
  >({});

  const handlePreviewGenerated = (
    blob: Blob,
    signature: string,
    placeholderData: Record<string, string>,
  ) => {
    setPreviewPdfBlob(blob);
    setPreviewSignature(signature);
    setPlaceholders(placeholderData);
    setSignedDocumentId(null);
    setSignedPdfUrl(null);
  };

  const handleSigned = (documentId: string, pdfUrl: string) => {
    setSignedDocumentId(documentId);
    if (pdfUrl) {
      const base = resolveBackendBase();
      const absoluteUrl = pdfUrl.startsWith("http")
        ? pdfUrl
        : `${base}${pdfUrl.startsWith("/") ? pdfUrl : `/${pdfUrl}`}`;
      setSignedPdfUrl(absoluteUrl);
    } else {
      setSignedPdfUrl(null);
    }
  };

  const handleCreateNew = () => {
    setPreviewPdfBlob(null);
    setPreviewSignature("");
    setSignedDocumentId(null);
    setSignedPdfUrl(null);
    setPlaceholders({});
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-indigo-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">DocuChain</h1>
          <p className="text-gray-600">
            Generate and sign documents with blockchain-backed integrity
          </p>
        </div>

        {signedDocumentId ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center space-y-4">
            <div>
              <h2 className="text-2xl font-semibold text-green-800 mb-2">
                Document Signed Successfully!
              </h2>
              <p className="text-green-700">Document ID: {signedDocumentId}</p>
            </div>
            {signedPdfUrl && (
              <a
                href={signedPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-green-600 text-green-700 hover:bg-green-100 transition-colors"
              >
                Download Signed PDF
              </a>
            )}
            <button
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              onClick={handleCreateNew}
            >
              Create New Document
            </button>
          </div>
        ) : previewPdfBlob ? (
          <DocumentPreview
            pdfBlob={previewPdfBlob}
            previewSignature={previewSignature}
            placeholders={placeholders}
            onSigned={handleSigned}
          />
        ) : (
          <DocumentEditor onPreviewGenerated={handlePreviewGenerated} />
        )}
      </div>
      <div className="container mx-auto px-4 pb-12 max-w-6xl">
        <div className="mt-8">
          <DocumentVerifier />
        </div>
      </div>
      <Toaster />
    </div>
  );
}
