import { useState, useEffect } from "react";
import backend from "~backend/client";
import { BaselineCard } from "../components/BaselineCard";
import { UploadDialog } from "../components/UploadDialog";
import { ComparisonDialog } from "../components/ComparisonDialog";
import { ImagePreviewDialog } from "../components/ImagePreviewDialog";
import { Search, RefreshCw, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import type { BaselineMetadata } from "~backend/baselines/list";

export function BaselinesPage() {
  const [baselines, setBaselines] = useState<BaselineMetadata[]>([]);
  const [filteredBaselines, setFilteredBaselines] = useState<BaselineMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "validated" | "invalid" | "missing">("all");
  const [uploadDialog, setUploadDialog] = useState<{
    screenId: string;
    screenName: string;
  } | null>(null);
  const [comparisonDialog, setComparisonDialog] = useState<{
    screenId: string;
    screenName: string;
    currentImageData?: string;
    newImageData: string;
    newFile: File;
  } | null>(null);
  const [previewDialog, setPreviewDialog] = useState<{
    screenId: string;
    screenName: string;
    imageData: string;
    hash: string;
  } | null>(null);

  const fetchBaselines = async () => {
    setLoading(true);
    try {
      const response = await backend.baselines.list();
      setBaselines(response.baselines);
      setFilteredBaselines(response.baselines);
    } catch (error) {
      console.error("Failed to fetch baselines:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBaselines();
  }, []);

  useEffect(() => {
    let filtered = baselines;

    if (searchQuery) {
      filtered = filtered.filter(
        (b) =>
          b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.screenId.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.url.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter((b) => {
        if (filterStatus === "validated") return b.validated;
        if (filterStatus === "invalid") return b.hasImage && !b.validated;
        if (filterStatus === "missing") return !b.hasImage;
        return true;
      });
    }

    setFilteredBaselines(filtered);
  }, [searchQuery, filterStatus, baselines]);

  const handleCompare = async (screenId: string, file: File, preview: string) => {
    const baseline = baselines.find((b) => b.screenId === screenId);
    if (!baseline) return;

    let currentImageData: string | undefined;
    if (baseline.hasImage) {
      try {
        const response = await backend.baselines.getImage({ screenId });
        currentImageData = response.imageData;
      } catch (error) {
        console.error("Failed to load current image:", error);
      }
    }

    setUploadDialog(null);
    setComparisonDialog({
      screenId,
      screenName: baseline.name,
      currentImageData,
      newImageData: preview,
      newFile: file,
    });
  };

  const handleApprove = async (screenId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      const uint8Array = new Uint8Array(arrayBuffer);
      const base64 = btoa(String.fromCharCode(...uint8Array));

      try {
        await backend.baselines.upload({ screenId, imageData: base64 });
        await fetchBaselines();
      } catch (error) {
        console.error("Upload failed:", error);
        throw error;
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleView = async (screenId: string) => {
    try {
      const response = await backend.baselines.getImage({ screenId });
      const baseline = baselines.find((b) => b.screenId === screenId);
      if (baseline) {
        setPreviewDialog({
          screenId,
          screenName: baseline.name,
          imageData: response.imageData,
          hash: response.hash,
        });
      }
    } catch (error) {
      console.error("Failed to load image:", error);
    }
  };

  const handleValidate = async (screenId: string) => {
    try {
      const response = await backend.baselines.validate({ screenId });
      alert(response.message);
      await fetchBaselines();
    } catch (error) {
      console.error("Validation failed:", error);
    }
  };

  const stats = {
    total: baselines.length,
    validated: baselines.filter((b) => b.validated).length,
    invalid: baselines.filter((b) => b.hasImage && !b.validated).length,
    missing: baselines.filter((b) => !b.hasImage).length,
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Baseline Management</h1>
        <p className="text-muted-foreground">
          Upload, validate, and manage visual regression test baselines.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Total</span>
            <RefreshCw className="size-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Validated</span>
            <CheckCircle2 className="size-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.validated}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Invalid</span>
            <AlertCircle className="size-4 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.invalid}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Missing</span>
            <XCircle className="size-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.missing}</p>
        </div>
      </div>

      <div className="bg-card border rounded-lg p-4 mb-6">
        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search baselines..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={filterStatus === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("all")}
            >
              All
            </Button>
            <Button
              variant={filterStatus === "validated" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("validated")}
            >
              <CheckCircle2 />
              Validated
            </Button>
            <Button
              variant={filterStatus === "invalid" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("invalid")}
            >
              <AlertCircle />
              Invalid
            </Button>
            <Button
              variant={filterStatus === "missing" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("missing")}
            >
              <XCircle />
              Missing
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={fetchBaselines}>
            <RefreshCw />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <RefreshCw className="size-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading baselines...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBaselines.map((baseline) => (
            <BaselineCard
              key={baseline.screenId}
              baseline={baseline}
              onUpload={(screenId) => {
                const b = baselines.find((b) => b.screenId === screenId);
                if (b) {
                  setUploadDialog({ screenId, screenName: b.name });
                }
              }}
              onView={handleView}
              onValidate={handleValidate}
            />
          ))}
        </div>
      )}

      {!loading && filteredBaselines.length === 0 && (
        <div className="text-center py-12 bg-card border rounded-lg">
          <p className="text-muted-foreground">No baselines found matching your filters.</p>
        </div>
      )}

      {uploadDialog && (
        <UploadDialog
          screenId={uploadDialog.screenId}
          screenName={uploadDialog.screenName}
          onClose={() => setUploadDialog(null)}
          onCompare={handleCompare}
        />
      )}

      {comparisonDialog && (
        <ComparisonDialog
          screenId={comparisonDialog.screenId}
          screenName={comparisonDialog.screenName}
          currentImageData={comparisonDialog.currentImageData}
          newImageData={comparisonDialog.newImageData}
          newFile={comparisonDialog.newFile}
          onApprove={handleApprove}
          onReject={() => setComparisonDialog(null)}
        />
      )}

      {previewDialog && (
        <ImagePreviewDialog
          screenId={previewDialog.screenId}
          screenName={previewDialog.screenName}
          imageData={previewDialog.imageData}
          hash={previewDialog.hash}
          onClose={() => setPreviewDialog(null)}
        />
      )}
    </div>
  );
}
