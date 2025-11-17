import * as React from "react";
import { Button } from "@islands/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@islands/components/ui/card";
import { api } from "@utils/api";
import { toast } from "sonner";

interface DocumentPreviewProps {
  pdfBlob: Blob;
  previewSignature: string;
  placeholders: Record<string, string>;
  onSigned: (documentId: string, pdfUrl: string) => void;
}

export function DocumentPreview({
  pdfBlob,
  previewSignature,
  placeholders,
  onSigned,
}: DocumentPreviewProps) {
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);
  const [isSigning, setIsSigning] = React.useState(false);

  React.useEffect(() => {
    const url = URL.createObjectURL(pdfBlob);
    setPdfUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pdfBlob]);

  const handleSign = async () => {
    setIsSigning(true);
    try {
      const formData = new FormData();
      formData.append("pdf", pdfBlob, "preview.pdf");
      formData.append("preview_signature", previewSignature);
      formData.append("placeholders", JSON.stringify(placeholders));
      formData.append(
        "metadata",
        JSON.stringify({
          signed_by: "web-ui",
          signed_at: new Date().toISOString(),
        }),
      );

      const result = await api.postFormData("/documents/sign", formData);

      if (result.document_id) {
        toast.success("Document signed successfully!");
        onSigned(result.document_id, result.pdf_url || "");
      } else if (result.error) {
        toast.error(result.error);
      } else {
        toast.error("Failed to sign document");
      }
    } catch (error: any) {
      console.error("Error signing document:", error);
      toast.error(error.message || "Failed to sign document");
    } finally {
      setIsSigning(false);
    }
  };

  const handleDownload = () => {
    if (!pdfUrl) return;
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = "preview.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Document Preview</CardTitle>
        <CardDescription>Review your document before signing.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pdfUrl && (
          <div className="border rounded-lg overflow-hidden">
            <iframe
              src={pdfUrl}
              className="w-full h-[600px]"
              title="Document Preview"
            />
          </div>
        )}
        <div className="flex gap-2">
          <Button onClick={handleDownload} variant="outline" className="flex-1">
            Download Preview
          </Button>
          <Button onClick={handleSign} disabled={isSigning} className="flex-1">
            {isSigning ? "Signing..." : "Sign Document"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
