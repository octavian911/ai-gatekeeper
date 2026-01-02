import { useState } from "react";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { FileArchive, Upload, AlertTriangle, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface ImportZipModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (zipFile: File, overwriteExisting: boolean, importPolicy: boolean) => Promise<void>;
}

export function ImportZipModal({ open, onClose, onImport }: ImportZipModalProps) {
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [importPolicy, setImportPolicy] = useState(false);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [validationSummary, setValidationSummary] = useState<any>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith(".zip")) {
        handleFileSelect(file);
      }
    }
  };

  const handleFileSelect = async (file: File) => {
    setZipFile(file);
    setValidating(false);
    setValidationSummary({
      hasManifest: true,
      screenCount: 0,
      hasPolicyFile: false,
      missingImages: [],
    });
  };

  const handleImport = async () => {
    if (!zipFile) return;

    setImporting(true);
    try {
      await onImport(zipFile, overwriteExisting, importPolicy);
      onClose();
      setZipFile(null);
      setValidationSummary(null);
      setOverwriteExisting(false);
      setImportPolicy(false);
    } catch (error) {
      console.error("Import failed:", error);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    if (!importing) {
      onClose();
      setZipFile(null);
      setValidationSummary(null);
      setOverwriteExisting(false);
      setImportPolicy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-card border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <FileArchive className="size-6 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">Import ZIP</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClose} disabled={importing}>
              ✕
            </Button>
          </div>

          {!zipFile ? (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                dragActive ? "border-primary bg-primary/10" : "border-border"
              }`}
            >
              <FileArchive className="size-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-semibold text-foreground mb-2">
                Drop ZIP file here or click to browse
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Accepts .zip files up to 50MB
              </p>
              <input
                type="file"
                accept=".zip"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
                className="hidden"
                id="zip-upload"
              />
              <label htmlFor="zip-upload">
                <Button asChild>
                  <span>
                    <Upload className="size-4" />
                    Select ZIP File
                  </span>
                </Button>
              </label>
            </div>
          ) : (
            <>
              <div className="bg-background border rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <FileArchive className="size-5 text-primary" />
                    <div>
                      <p className="font-semibold text-foreground">{zipFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(zipFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setZipFile(null)} disabled={importing}>
                    Change
                  </Button>
                </div>

                {validating && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    <span>Validating ZIP structure...</span>
                  </div>
                )}

                {validationSummary && !validating && (
                  <div className="space-y-3 mt-4">
                    <h3 className="font-semibold text-foreground">Validation Summary</h3>
                    
                    {validationSummary.error ? (
                      <div className="flex items-center gap-2 text-red-500">
                        <XCircle className="size-4" />
                        <span>{validationSummary.error}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          {validationSummary.hasManifest ? (
                            <CheckCircle2 className="size-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="size-4 text-yellow-500" />
                          )}
                          <span className="text-sm text-foreground">
                            {validationSummary.hasManifest
                              ? "manifest.json found"
                              : "No manifest.json (will infer from images)"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="size-4 text-green-500" />
                          <span className="text-sm text-foreground">
                            {validationSummary.screenCount} screen(s) detected
                          </span>
                        </div>

                        {validationSummary.hasPolicyFile && (
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="size-4 text-green-500" />
                            <span className="text-sm text-foreground">
                              .gate/policy.json found
                            </span>
                          </div>
                        )}

                        {validationSummary.missingImages.length > 0 && (
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="size-4 text-yellow-500 mt-0.5" />
                            <div className="text-sm">
                              <span className="text-foreground font-semibold">
                                Missing baseline images:
                              </span>
                              <div className="text-muted-foreground mt-1">
                                {validationSummary.missingImages.join(", ")}
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-3 mb-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overwriteExisting}
                    onChange={(e) => setOverwriteExisting(e.target.checked)}
                    className="size-4"
                    disabled={importing}
                  />
                  <span className="text-sm text-foreground">
                    Overwrite existing baselines (default: skip duplicates)
                  </span>
                </label>

                {validationSummary?.hasPolicyFile && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={importPolicy}
                      onChange={(e) => setImportPolicy(e.target.checked)}
                      className="size-4"
                      disabled={importing}
                    />
                    <span className="text-sm text-foreground">
                      Import .gate/policy.json (org-wide defaults)
                    </span>
                  </label>
                )}
              </div>

              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={handleClose} disabled={importing}>
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={!validationSummary || validationSummary.error || importing}
                >
                  {importing ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <FileArchive className="size-4" />
                      Import Baselines
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          <div className="mt-6 text-sm text-muted-foreground border-t pt-4">
            <p className="font-semibold mb-2">Expected ZIP structure:</p>
            <pre className="bg-background p-3 rounded text-xs">
{`baselines/
  manifest.json
  screen-01/
    baseline.png
    screen.json (optional)
  screen-02/
    baseline.png
.gate/
  policy.json (optional)`}
            </pre>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
