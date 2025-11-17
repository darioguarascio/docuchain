import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@islands/components/ui/card";
import { Button } from "@islands/components/ui/button";
import { Input } from "@islands/components/ui/input";
import env from "@utils/env";
import { toast } from "sonner";

interface VerificationResult {
  document_id?: string;
  content_hash?: string;
  verified?: boolean;
  block_hash?: string;
  [key: string]: any;
}

const verifyEndpoint = `${env.PUBLIC_DOCUCHAIN_BACKEND_URL}/documents/verify/file`;

export function DocumentVerifier() {
  const [file, setFile] = React.useState<File | null>(null);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [result, setResult] = React.useState<VerificationResult | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setResult(null);
  };

  const handleVerify = async () => {
    if (!file) {
      toast.error("Please select a PDF file to verify.");
      return;
    }

    setIsVerifying(true);
    setResult(null);
    try {
      const response = await fetch(verifyEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/pdf",
        },
        body: file,
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data?.error ?? "Verification failed");
        return;
      }

      setResult(data);
      toast.success("Verification completed");
    } catch (error: any) {
      console.error("Error verifying PDF:", error);
      toast.error(error?.message ?? "Failed to verify PDF");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verify a PDF</CardTitle>
        <CardDescription>
          Upload any PDF to confirm if it exists in the DocuChain ledger.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Input
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
          />
          <p className="text-xs text-muted-foreground">
            Only PDF files are supported.
          </p>
        </div>
        <Button
          onClick={handleVerify}
          disabled={isVerifying}
          className="w-full"
        >
          {isVerifying ? "Verifying..." : "Verify PDF"}
        </Button>
        {result && (
          <div className="mt-4 rounded-md border bg-muted/30 p-4">
            <p className="text-sm font-semibold mb-2">Verification Result</p>
            <pre className="text-xs overflow-auto whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
