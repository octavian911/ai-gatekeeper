import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Upload, FileArchive, X, AlertCircle, CheckCircle2 } from "lucide-react";

interface BaselineInput {
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
  const [activeTab, setActiveTab] = useState("images");
  const [baselines, setBaselines] = useState<BaselineInput[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [metadataFile, setMetadataFile] = useState<File | null>(null);

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files) return;

    const newBaselines: BaselineInput[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (!file.type.startsWith("image/")) {
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
        name: screenId.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFilesSelected(e.dataTransfer.files);
  };

  const removeBaseline = (id: string) => {
    const baseline = baselines.find(b => b.id === id);
    if (baseline) {
      URL.revokeObjectURL(baseline.preview);
    }
    setBaselines(baselines.filter(b => b.id !== id));
    selectedIds.delete(id);
    setSelectedIds(new Set(selectedIds));
  };

  const updateBaseline = (id: string, updates: Partial<BaselineInput>) => {
    setBaselines(baselines.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const toggleTag = (id: string, tag: string) => {
    const baseline = baselines.find(b => b.id === id);
    if (!baseline) return;

    const tags = baseline.tags.includes(tag)
      ? baseline.tags.filter(t => t !== tag)
      : [...baseline.tags, tag];

    updateBaseline(id, { tags });
  };

  const validateBaselines = () => {
    const screenIds = new Map<string, number>();
    const updated = baselines.map(b => {
      const count = screenIds.get(b.screenId) || 0;
      screenIds.set(b.screenId, count + 1);

      let error: string | undefined;
      if (count > 0) {
        error = "Duplicate screen ID";
      } else if (b.tags.includes("noisy")) {
        error = "Noisy tag requires masks (not yet supported in upload UI)";
      } else if (b.width !== b.viewportWidth || b.height !== b.viewportHeight) {
        error = `Image dimensions (${b.width}x${b.height}) don't match viewport (${b.viewportWidth}x${b.viewportHeight})`;
      }

      return { ...b, error };
    });

    setBaselines(updated);
    return updated.filter(b => !b.error);
  };

  const handleUpload = async () => {
    const valid = validateBaselines();
    if (valid.length === 0) return;

    setUploading(true);
    try {
      await onUpload(valid);
      setBaselines([]);
      onClose();
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setUploading(false);
    }
  };

  const handleZipUpload = async () => {
    if (!zipFile) return;

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const uint8Array = new Uint8Array(arrayBuffer);
        const base64 = btoa(String.fromCharCode(...uint8Array));
        
        await fetch("/api/baselines/import-zip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ zipData: base64 }),
        });

        setZipFile(null);
        onClose();
      };
      reader.readAsArrayBuffer(zipFile);
    } catch (error) {
      console.error("ZIP import failed:", error);
    } finally {
      setUploading(false);
    }
  };

  const applyViewportToAll = () => {
    if (baselines.length === 0) return;
    const { viewportWidth, viewportHeight } = baselines[0];
    setBaselines(baselines.map(b => ({ ...b, viewportWidth, viewportHeight })));
  };

  const applyTagToSelected = (tag: string) => {
    setBaselines(baselines.map(b => 
      selectedIds.has(b.id) && !b.tags.includes(tag)
        ? { ...b, tags: [...b.tags, tag] }
        : b
    ));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Baselines</DialogTitle>
          <DialogDescription>
            Upload baseline images from Figma/Stitch, import a ZIP, or provide metadata.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="images" value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="images">Images</TabsTrigger>
            <TabsTrigger value="zip">ZIP Import</TabsTrigger>
            <TabsTrigger value="metadata">Metadata</TabsTrigger>
          </TabsList>

          <TabsContent value="images">
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center mb-4"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <Upload className="size-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-foreground mb-2">Drag & drop images here</p>
              <p className="text-sm text-muted-foreground mb-4">
                Supports: PNG, JPG, JPEG, WEBP (max 5MB each)
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.multiple = true;
                  input.accept = ".png,.jpg,.jpeg,.webp";
                  input.onchange = (e) => handleFilesSelected((e.target as HTMLInputElement).files);
                  input.click();
                }}
              >
                Select Files
              </Button>
            </div>

            {baselines.length > 0 && (
              <>
                <div className="flex gap-2 mb-4">
                  <Button size="sm" variant="outline" onClick={applyViewportToAll}>
                    Apply viewport to all
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => applyTagToSelected("standard")}
                    disabled={selectedIds.size === 0}
                  >
                    Tag selected as "standard"
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => applyTagToSelected("critical")}
                    disabled={selectedIds.size === 0}
                  >
                    Tag selected as "critical"
                  </Button>
                </div>

                <div className="max-h-96 overflow-y-auto space-y-3">
                  {baselines.map((baseline) => (
                    <div 
                      key={baseline.id} 
                      className={`border rounded-lg p-3 ${baseline.error ? "border-red-500" : "border-border"}`}
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
                        />
                        <img src={baseline.preview} alt={baseline.screenId} className="size-16 object-cover rounded" />
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground">Screen ID</label>
                            <Input
                              value={baseline.screenId}
                              onChange={(e) => updateBaseline(baseline.id, { screenId: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Name</label>
                            <Input
                              value={baseline.name}
                              onChange={(e) => updateBaseline(baseline.id, { name: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Route</label>
                            <Input
                              value={baseline.route}
                              onChange={(e) => updateBaseline(baseline.id, { route: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Viewport</label>
                            <div className="flex gap-1">
                              <Input
                                type="number"
                                value={baseline.viewportWidth}
                                onChange={(e) => updateBaseline(baseline.id, { viewportWidth: parseInt(e.target.value) })}
                                className="w-20"
                              />
                              <span className="text-muted-foreground self-center">×</span>
                              <Input
                                type="number"
                                value={baseline.viewportHeight}
                                onChange={(e) => updateBaseline(baseline.id, { viewportHeight: parseInt(e.target.value) })}
                                className="w-20"
                              />
                            </div>
                          </div>
                          <div className="col-span-2">
                            <label className="text-xs text-muted-foreground">Tags</label>
                            <div className="flex gap-2 mt-1">
                              {["standard", "critical", "noisy"].map(tag => (
                                <span
                                  key={tag}
                                  className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-md cursor-pointer ${
                                    baseline.tags.includes(tag) 
                                      ? "bg-primary text-primary-foreground" 
                                      : "border border-border text-foreground"
                                  }`}
                                  onClick={() => toggleTag(baseline.id, tag)}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeBaseline(baseline.id)}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                      {baseline.error && (
                        <div className="flex items-center gap-2 mt-2 text-sm text-red-500">
                          <AlertCircle className="size-4" />
                          {baseline.error}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-2">
                        Detected: {baseline.width}×{baseline.height}px
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={baselines.length === 0 || uploading}>
                {uploading ? "Uploading..." : `Upload ${baselines.length} baseline${baselines.length !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="zip">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center mb-4">
              <FileArchive className="size-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-foreground mb-2">Upload a ZIP file</p>
              <p className="text-sm text-muted-foreground mb-4">
                Expected structure: baselines/manifest.json, baselines/&lt;screenId&gt;/baseline.png
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".zip";
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) setZipFile(file);
                  };
                  input.click();
                }}
              >
                Select ZIP
              </Button>
            </div>

            {zipFile && (
              <div className="border rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileArchive className="size-5 text-muted-foreground" />
                    <span className="text-foreground">{zipFile.name}</span>
                    <span className="text-sm text-muted-foreground">
                      ({(zipFile.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setZipFile(null)}>
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleZipUpload} disabled={!zipFile || uploading}>
                {uploading ? "Importing..." : "Import ZIP"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="metadata">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center mb-4">
              <Upload className="size-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-foreground mb-2">Upload screens.json (optional)</p>
              <p className="text-sm text-muted-foreground mb-4">
                Metadata will be merged with inferred data from uploaded images
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".json";
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) setMetadataFile(file);
                  };
                  input.click();
                }}
              >
                Select screens.json
              </Button>
            </div>

            {metadataFile && (
              <div className="border rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-5 text-green-500" />
                    <span className="text-foreground">{metadataFile.name}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setMetadataFile(null)}>
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
