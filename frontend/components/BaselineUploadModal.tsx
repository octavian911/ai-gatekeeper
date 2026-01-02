import { useState } from "react";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Upload, X, AlertCircle, Loader2 } from "lucide-react";

export interface BaselineInput {
  id: string;
  file: File;
  preview: string;
  screenId: string;
  name: string;
  route: string;
  tags: string[];
  viewportWidth: number;
  viewportHeight: number;
  width: number;
  height: number;
  error?: string;
}

interface BaselineUploadModalProps {
  open: boolean;
  onClose: () => void;
  onUpload: (baselines: BaselineInput[]) => Promise<void>;
}

export function BaselineUploadModal({ open, onClose, onUpload }: BaselineUploadModalProps) {
  const [baselines, setBaselines] = useState<BaselineInput[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files) return;

    const newBaselines: BaselineInput[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (!file.type.match(/^image\/(png|jpe?g|webp)$/)) {
        continue;
      }

      if (file.size > 5 * 1024 * 1024) {
        continue;
      }

      const preview = URL.createObjectURL(file);
      const img = new Image();

      await new Promise((resolve) => {
        img.onload = resolve;
        img.src = preview;
      });

      const screenId = file.name.replace(/\.(png|jpg|jpeg|webp)$/i, "");

      newBaselines.push({
        id: Math.random().toString(36).substr(2, 9),
        file,
        preview,
        screenId,
        name: screenId.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
        route: `/${screenId}`,
        tags: [],
        viewportWidth: 1280,
        viewportHeight: 720,
        width: img.width,
        height: img.height,
      });
    }

    setBaselines([...baselines, ...newBaselines]);
  };

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
    handleFilesSelected(e.dataTransfer.files);
  };

  const removeBaseline = (id: string) => {
    const baseline = baselines.find((b) => b.id === id);
    if (baseline) {
      URL.revokeObjectURL(baseline.preview);
    }
    setBaselines(baselines.filter((b) => b.id !== id));
    selectedIds.delete(id);
    setSelectedIds(new Set(selectedIds));
  };

  const updateBaseline = (id: string, updates: Partial<BaselineInput>) => {
    setBaselines(baselines.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  };

  const toggleTag = (id: string, tag: string) => {
    const baseline = baselines.find((b) => b.id === id);
    if (!baseline) return;

    const tags = baseline.tags.includes(tag)
      ? baseline.tags.filter((t) => t !== tag)
      : [...baseline.tags, tag];

    updateBaseline(id, { tags });
  };

  const validateBaselines = () => {
    const screenIds = new Map<string, number>();
    const updated = baselines.map((b) => {
      const count = screenIds.get(b.screenId) || 0;
      screenIds.set(b.screenId, count + 1);

      let error: string | undefined;
      if (count > 0) {
        error = "Duplicate screen ID";
      } else if (Math.abs(b.width - b.viewportWidth) > 10 || Math.abs(b.height - b.viewportHeight) > 10) {
        error = `Image dimensions (${b.width}×${b.height}) mismatch viewport (${b.viewportWidth}×${b.viewportHeight})`;
      }

      return { ...b, error };
    });

    setBaselines(updated);
    return updated.filter((b) => !b.error);
  };

  const handleUpload = async () => {
    const valid = validateBaselines();
    if (valid.length === 0) return;

    setUploading(true);
    try {
      await onUpload(valid);
      baselines.forEach((b) => URL.revokeObjectURL(b.preview));
      setBaselines([]);
      setSelectedIds(new Set());
      onClose();
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setUploading(false);
    }
  };

  const applyViewportToAll = () => {
    if (baselines.length === 0) return;
    const { viewportWidth, viewportHeight } = baselines[0];
    setBaselines(baselines.map((b) => ({ ...b, viewportWidth, viewportHeight })));
  };

  const applyTagToSelected = (tag: string) => {
    setBaselines(
      baselines.map((b) =>
        selectedIds.has(b.id) && !b.tags.includes(tag) ? { ...b, tags: [...b.tags, tag] } : b
      )
    );
  };

  const handleClose = () => {
    if (!uploading) {
      baselines.forEach((b) => URL.revokeObjectURL(b.preview));
      setBaselines([]);
      setSelectedIds(new Set());
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-card border rounded-lg p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Upload className="size-6 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">Upload Images</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClose} disabled={uploading}>
              ✕
            </Button>
          </div>

          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center mb-6 transition-colors ${
              dragActive ? "border-primary bg-primary/10" : "border-border"
            }`}
          >
            <Upload className="size-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-foreground mb-2">Drag & drop images here</p>
            <p className="text-sm text-muted-foreground mb-4">
              Supports: PNG, JPG, JPEG, WEBP (max 5MB each)
            </p>
            <input
              type="file"
              multiple
              accept=".png,.jpg,.jpeg,.webp"
              onChange={(e) => handleFilesSelected(e.target.files)}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload">
              <Button asChild variant="outline">
                <span>Select Files</span>
              </Button>
            </label>
          </div>

          {baselines.length > 0 && (
            <>
              <div className="flex gap-2 mb-4 flex-wrap">
                <Button size="sm" variant="outline" onClick={applyViewportToAll}>
                  Apply viewport to all
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => applyTagToSelected("standard")}
                  disabled={selectedIds.size === 0}
                >
                  Tag selected: standard
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => applyTagToSelected("critical")}
                  disabled={selectedIds.size === 0}
                >
                  Tag selected: critical
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => applyTagToSelected("noisy")}
                  disabled={selectedIds.size === 0}
                >
                  Tag selected: noisy
                </Button>
                <Button size="sm" variant="outline" onClick={validateBaselines}>
                  Validate All
                </Button>
              </div>

              <div className="max-h-[400px] overflow-y-auto space-y-3 mb-6">
                {baselines.map((baseline) => (
                  <div
                    key={baseline.id}
                    className={`border rounded-lg p-3 ${
                      baseline.error ? "border-red-500 bg-red-500/5" : "border-border"
                    }`}
                  >
                    <div className="flex gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(baseline.id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedIds);
                          if (e.target.checked) {
                            newSet.add(baseline.id);
                          } else {
                            newSet.delete(baseline.id);
                          }
                          setSelectedIds(newSet);
                        }}
                        className="self-start mt-2"
                      />
                      <img
                        src={baseline.preview}
                        alt={baseline.screenId}
                        className="size-20 object-cover rounded border"
                      />
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-muted-foreground font-medium">
                            Screen ID *
                          </label>
                          <Input
                            value={baseline.screenId}
                            onChange={(e) =>
                              updateBaseline(baseline.id, { screenId: e.target.value })
                            }
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground font-medium">Name</label>
                          <Input
                            value={baseline.name}
                            onChange={(e) => updateBaseline(baseline.id, { name: e.target.value })}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground font-medium">Route</label>
                          <Input
                            value={baseline.route}
                            onChange={(e) => updateBaseline(baseline.id, { route: e.target.value })}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground font-medium">
                            Viewport
                          </label>
                          <div className="flex gap-1 mt-1">
                            <Input
                              type="number"
                              value={baseline.viewportWidth}
                              onChange={(e) =>
                                updateBaseline(baseline.id, {
                                  viewportWidth: parseInt(e.target.value),
                                })
                              }
                              className="w-24"
                            />
                            <span className="text-muted-foreground self-center">×</span>
                            <Input
                              type="number"
                              value={baseline.viewportHeight}
                              onChange={(e) =>
                                updateBaseline(baseline.id, {
                                  viewportHeight: parseInt(e.target.value),
                                })
                              }
                              className="w-24"
                            />
                          </div>
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-muted-foreground font-medium">Tags</label>
                          <div className="flex gap-2 mt-1">
                            {["standard", "critical", "noisy"].map((tag) => (
                              <span
                                key={tag}
                                className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-md cursor-pointer ${
                                  baseline.tags.includes(tag)
                                    ? "bg-primary text-primary-foreground"
                                    : "border border-border text-foreground hover:bg-accent"
                                }`}
                                onClick={() => toggleTag(baseline.id, tag)}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => removeBaseline(baseline.id)}>
                        <X className="size-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground ml-24">
                      <span>
                        Detected: {baseline.width}×{baseline.height}px
                      </span>
                      {baseline.error && (
                        <div className="flex items-center gap-1 text-red-500 font-medium">
                          <AlertCircle className="size-3" />
                          {baseline.error}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="flex gap-3 justify-end border-t pt-4">
            <Button variant="outline" onClick={handleClose} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={baselines.length === 0 || uploading}>
              {uploading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="size-4" />
                  Upload {baselines.length} baseline{baselines.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
