import { useState, useEffect, useCallback } from "react";
import backend from "~backend/client";
import { BaselineCard } from "../components/BaselineCard";
import { BaselineUploadModal, BaselineInput } from "../components/BaselineUploadModal";
import { ImportZipModal } from "../components/ImportZipModal";
import { BaselinePreviewDrawer } from "../components/BaselinePreviewDrawer";
import { ReviewerGuidancePanel } from "../components/ReviewerGuidancePanel";
import { Search, RefreshCw, CheckCircle2, XCircle, AlertCircle, Upload, FileArchive, GitBranch, Download } from "lucide-react";
import { Button } from "../components/ui/button";
import type { BaselineMetadata } from "~backend/baselines/list_fs";
import { useToast } from "../hooks/useToast";

export function BaselinesPage() {
  const { showToast, ToastContainer } = useToast();
  const [baselines, setBaselines] = useState<BaselineMetadata[]>([]);
  const [filteredBaselines, setFilteredBaselines] = useState<BaselineMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "validated" | "invalid" | "missing">("all");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showImportZipModal, setShowImportZipModal] = useState(false);
  const [previewDrawer, setPreviewDrawer] = useState<{
    baseline: BaselineMetadata;
    imageData: string;
  } | null>(null);
  const [gitStatus, setGitStatus] = useState<{ baselinesChanged: boolean; changedFiles: string[] }>({
    baselinesChanged: false,
    changedFiles: [],
  });
  const [exporting, setExporting] = useState(false);

  const fetchBaselines = async () => {
    setLoading(true);
    try {
      const response = await backend.baselines.listFs();
      setBaselines(response.baselines);
      setFilteredBaselines(response.baselines);
    } catch (error) {
      console.error("Failed to fetch baselines:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGitStatus = async () => {
    try {
      const response = await backend.baselines.gitStatus();
      setGitStatus({
        baselinesChanged: response.baselinesChanged,
        changedFiles: response.changedFiles,
      });
    } catch (error) {
      console.error("Failed to fetch git status:", error);
    }
  };

  useEffect(() => {
    fetchBaselines();
    fetchGitStatus();
  }, []);

  useEffect(() => {
    let filtered = baselines;

    if (searchQuery) {
      filtered = filtered.filter(
        (b) =>
          b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.screenId.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (b.url && b.url.toLowerCase().includes(searchQuery.toLowerCase()))
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

  const handleView = async (screenId: string) => {
    try {
      const response = await backend.baselines.getImageFs({ screenId });
      const baseline = baselines.find((b) => b.screenId === screenId);
      if (baseline) {
        setPreviewDrawer({
          baseline,
          imageData: response.imageData,
        });
      }
    } catch (error) {
      console.error("Failed to load image:", error);
    }
  };

  const handleValidate = useCallback(async (screenId: string) => {
    const previousBaselines = [...baselines];
    
    const optimisticBaseline = baselines.find((b) => b.screenId === screenId);
    if (!optimisticBaseline) return;

    setBaselines(
      baselines.map((b) =>
        b.screenId === screenId
          ? { ...b, validated: true, statusMessage: undefined, status: "validated" }
          : b
      )
    );

    try {
      const response = await backend.baselines.validateBaselineFs({ screenId });
      showToast(response.message, "success");
      await fetchBaselines();
    } catch (error) {
      console.error("Validation failed:", error);
      setBaselines(previousBaselines);
      showToast("Validation failed", "error");
    }
  }, [baselines]);

  const handleDelete = useCallback(async (screenId: string) => {
    const previousBaselines = [...baselines];
    const deletedBaseline = baselines.find((b) => b.screenId === screenId);

    setBaselines(baselines.filter((b) => b.screenId !== screenId));
    
    if (previewDrawer?.baseline.screenId === screenId) {
      setPreviewDrawer(null);
    }

    try {
      await backend.baselines.deleteBaselineFs({ screenId });
      await fetchGitStatus();
      showToast(`Deleted baseline: ${deletedBaseline?.name || screenId}`, "success");
    } catch (error) {
      console.error("Delete failed:", error);
      setBaselines(previousBaselines);
      showToast("Delete failed", "error");
    }
  }, [baselines, previewDrawer]);

  const handleUploadBaselines = useCallback(async (baselineInputs: BaselineInput[]) => {
    const previousBaselines = [...baselines];
    
    const optimisticBaselines: BaselineMetadata[] = baselineInputs.map((input) => ({
      screenId: input.screenId,
      name: input.name,
      url: input.route,
      route: input.route,
      tags: input.tags,
      viewportWidth: input.viewportWidth,
      viewportHeight: input.viewportHeight,
      validated: input.tags.includes("noisy") ? false : true,
      hasImage: true,
      hash: "uploading...",
      size: input.file.size,
      status: input.tags.includes("noisy") ? "invalid" : "validated",
      statusMessage: input.tags.includes("noisy") ? "Baseline tagged as 'noisy' requires at least one mask" : undefined,
      masks: [],
      thresholds: {},
    }));

    const existingIds = new Set(baselines.map((b) => b.screenId));
    const newBaselines = optimisticBaselines.filter((b) => !existingIds.has(b.screenId));
    const updatedBaselines = baselines.map((b) => {
      const update = optimisticBaselines.find((opt) => opt.screenId === b.screenId);
      return update || b;
    });

    setBaselines([...updatedBaselines, ...newBaselines]);

    const baselinesData = await Promise.all(
      baselineInputs.map(async (input) => {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = (e) => {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            const uint8Array = new Uint8Array(arrayBuffer);
            resolve(btoa(String.fromCharCode(...uint8Array)));
          };
          reader.readAsArrayBuffer(input.file);
        });

        return {
          screenId: input.screenId,
          name: input.name,
          route: input.route,
          tags: input.tags,
          viewportWidth: input.viewportWidth,
          viewportHeight: input.viewportHeight,
          imageData: base64,
        };
      })
    );

    try {
      const response = await backend.baselines.uploadMultiFs({ baselines: baselinesData });
      
      const created = response.uploaded.filter(u => u.status === "created").length;
      const updated = response.uploaded.filter(u => u.status === "updated").length;
      const noChange = response.uploaded.filter(u => u.status === "no_change").length;
      
      if (response.errors.length > 0) {
        showToast(`Uploaded ${response.uploaded.length} baseline(s) with ${response.errors.length} error(s)`, "warning");
      } else if (noChange > 0 && created === 0 && updated === 0) {
        const screenIds = response.uploaded.map(u => u.screenId).join(", ");
        showToast(`No change: ${screenIds} (identical)`, "success");
      } else {
        const messages: string[] = [];
        if (created > 0) messages.push(`${created} created`);
        if (updated > 0) messages.push(`${updated} updated`);
        if (noChange > 0) messages.push(`${noChange} unchanged`);
        showToast(`Baselines: ${messages.join(", ")}`, "success");
      }
      
      await fetchBaselines();
      await fetchGitStatus();
    } catch (error) {
      console.error("Upload failed:", error);
      setBaselines(previousBaselines);
      showToast("Upload failed", "error");
      throw error;
    }
  }, [baselines]);

  const handleImportZip = useCallback(async (zipFile: File, overwriteExisting: boolean, importPolicy: boolean) => {
    const previousBaselines = [...baselines];
    const arrayBuffer = await zipFile.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const base64 = btoa(String.fromCharCode(...uint8Array));

    try {
      const response = await backend.baselines.importZipFs({
        zipData: base64,
        overwriteExisting,
        importPolicy,
      });

      const created = response.imported.filter(i => i.status === "created").length;
      const updated = response.imported.filter(i => i.status === "updated").length;
      const noChange = response.imported.filter(i => i.status === "no_change").length;

      if (response.errors.length > 0) {
        showToast(
          `Imported ${response.imported.length} baseline(s) with ${response.errors.length} error(s)`,
          "warning"
        );
      } else if (response.skipped.length > 0) {
        showToast(
          `Imported ${response.imported.length} baseline(s), skipped ${response.skipped.length} existing`,
          "warning"
        );
      } else {
        const messages: string[] = [];
        if (created > 0) messages.push(`${created} created`);
        if (updated > 0) messages.push(`${updated} updated`);
        if (noChange > 0) messages.push(`${noChange} unchanged`);
        showToast(`Baselines: ${messages.join(", ")}`, "success");
      }

      await fetchBaselines();
      await fetchGitStatus();
    } catch (error) {
      console.error("Import failed:", error);
      setBaselines(previousBaselines);
      showToast("Import failed", "error");
      throw error;
    }
  }, [baselines]);

  const handleExportZip = async () => {
    setExporting(true);
    try {
      const response = await backend.baselines.exportZipFs();
      const blob = new Blob(
        [Uint8Array.from(atob(response.zipData), (c) => c.charCodeAt(0))],
        { type: "application/zip" }
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = response.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      showToast("Baselines exported successfully", "success");
    } catch (error) {
      console.error("Export failed:", error);
      showToast("Failed to export baselines", "error");
    } finally {
      setExporting(false);
    }
  };

  const handleUpdateMetadata = useCallback(async (
    screenId: string,
    updates: {
      masks?: Array<{ type: string; selector?: string; x?: number; y?: number; width?: number; height?: number }>;
      tags?: string[];
      viewportWidth?: number;
      viewportHeight?: number;
      route?: string;
    }
  ) => {
    const previousBaselines = [...baselines];
    const previousDrawer = previewDrawer;

    setBaselines(
      baselines.map((b) =>
        b.screenId === screenId ? { ...b, ...updates } : b
      )
    );

    if (previewDrawer && previewDrawer.baseline.screenId === screenId) {
      setPreviewDrawer({
        ...previewDrawer,
        baseline: { ...previewDrawer.baseline, ...updates },
      });
    }

    try {
      await backend.baselines.updateMetadataFs({
        screenId,
        ...updates,
      });
      await fetchBaselines();
      await fetchGitStatus();
      showToast("Metadata updated", "success");
    } catch (error) {
      console.error("Failed to update metadata:", error);
      setBaselines(previousBaselines);
      setPreviewDrawer(previousDrawer);
      showToast("Failed to update metadata", "error");
      throw error;
    }
  }, [baselines, previewDrawer]);

  const stats = {
    total: baselines.length,
    validated: baselines.filter((b) => b.validated).length,
    invalid: baselines.filter((b) => b.hasImage && !b.validated).length,
    missing: baselines.filter((b) => !b.hasImage).length,
  };

  return (
    <div className="p-8">
      <ToastContainer />
      {gitStatus.baselinesChanged && (
        <div className="mb-6 bg-yellow-500/10 border border-yellow-500 rounded-lg p-4 flex items-start gap-3">
          <GitBranch className="size-5 text-yellow-500 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-primary">Baselines changed. Commit these changes to preserve version history.</p>
            <p className="text-sm text-secondary mt-1">
              {gitStatus.changedFiles.length} file(s) modified in /baselines
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const fileList = gitStatus.changedFiles.join("\n");
              alert(`Changed files:\n${fileList}`);
            }}
          >
            Show Changed Files
          </Button>
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-primary mb-2">Baseline Management</h1>
            <p className="text-secondary">
              Upload, validate, and manage visual regression test baselines.
            </p>
          </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowUploadModal(true)}>
            <Upload className="size-4" />
            Upload Images
          </Button>
          <Button variant="outline" onClick={() => setShowImportZipModal(true)}>
            <FileArchive className="size-4" />
            Import ZIP
          </Button>
          <Button variant="outline" onClick={handleExportZip} disabled={exporting || stats.total === 0}>
            <Download className="size-4" />
            {exporting ? "Exporting..." : "Export ZIP"}
          </Button>
        </div>
        </div>
        <div className="bg-surface">
          <ReviewerGuidancePanel />
        </div>
      </div>

      <div className="bg-surface p-4 rounded-lg mb-6">
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-card border-2 border-border-strong rounded-lg p-4 hover:shadow-sm transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-secondary">Total</span>
              <RefreshCw className="size-4 text-icon-muted" />
            </div>
            <p className="text-2xl font-bold text-primary">{stats.total}</p>
          </div>
          <div className="bg-card border-2 border-border-strong rounded-lg p-4 hover:shadow-sm transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-primary">Validated</span>
              <CheckCircle2 className="size-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.validated}</p>
          </div>
          <div className="bg-card border-2 border-border-strong rounded-lg p-4 hover:shadow-sm transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-primary">Invalid</span>
              <AlertCircle className="size-4 text-yellow-500" />
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.invalid}</p>
          </div>
          <div className="bg-card border-2 border-border-strong rounded-lg p-4 hover:shadow-sm transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-primary">Missing</span>
              <XCircle className="size-4 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.missing}</p>
          </div>
        </div>
      </div>

      <div className="bg-surface p-4 rounded-lg mb-6">
        <div className="bg-card border-2 border-border-strong rounded-lg p-4">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-icon-muted" />
              <input
                type="text"
                placeholder="Search baselines..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-background border-2 border-border-strong rounded-md text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-border-strong transition-all"
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
            <Button variant="outline" size="sm" onClick={() => { fetchBaselines(); fetchGitStatus(); }}>
              <RefreshCw />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <RefreshCw className="size-8 animate-spin mx-auto mb-4 text-icon-muted" />
          <p className="text-secondary">Loading baselines...</p>
        </div>
      ) : stats.total === 0 ? (
        <div className="text-center py-16 bg-card border-2 border-border-strong rounded-lg">
          <Upload className="size-16 mx-auto mb-4 text-icon-muted" />
          <h3 className="text-xl font-semibold text-primary mb-2">No baselines yet</h3>
          <p className="text-secondary mb-6 max-w-md mx-auto">
            Upload baseline images or import a ZIP containing your baselines to get started.
          </p>
          <div className="flex gap-3 justify-center mb-4">
            <Button onClick={() => setShowUploadModal(true)}>
              <Upload className="size-4" />
              Upload Images
            </Button>
            <Button variant="outline" onClick={() => setShowImportZipModal(true)}>
              <FileArchive className="size-4" />
              Import ZIP
            </Button>
          </div>
          <div className="text-sm text-secondary max-w-lg mx-auto mt-6 border-t-2 border-border-strong pt-6">
            <p className="mb-2 text-secondary">
              <strong className="text-primary">Note:</strong> Baselines are saved to <code className="bg-accent px-1 rounded text-accent-foreground">/baselines</code> and should be committed to git.
            </p>
            <p className="font-semibold mb-2 mt-4 text-primary">Supported workflows:</p>
            <ul className="text-left space-y-1 text-secondary">
              <li>• Upload Images: PNG, JPG, JPEG, WEBP (max 5MB each)</li>
              <li>• Import ZIP: baselines/manifest.json structure</li>
              <li>• Infer screen IDs from filenames</li>
              <li>• Configure tags, viewport, masks per screen</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBaselines.map((baseline) => (
            <BaselineCard
              key={baseline.screenId}
              baseline={baseline}
              onView={handleView}
              onValidate={handleValidate}
            />
          ))}
        </div>
      )}

      {!loading && filteredBaselines.length === 0 && stats.total > 0 && (
        <div className="text-center py-12 bg-card border-2 border-border-strong rounded-lg">
          <p className="text-secondary">No baselines found matching your filters.</p>
        </div>
      )}

      {showUploadModal && (
        <BaselineUploadModal
          open={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onUpload={handleUploadBaselines}
          showToast={showToast}
        />
      )}

      {showImportZipModal && (
        <ImportZipModal
          open={showImportZipModal}
          onClose={() => setShowImportZipModal(false)}
          onImport={handleImportZip}
        />
      )}

      {previewDrawer && (
        <BaselinePreviewDrawer
          baseline={previewDrawer.baseline}
          imageData={previewDrawer.imageData}
          onClose={() => setPreviewDrawer(null)}
          onDelete={handleDelete}
          onRevalidate={handleValidate}
          onUpdateMetadata={handleUpdateMetadata}
        />
      )}
    </div>
  );
}
