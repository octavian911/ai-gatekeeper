import { useState } from "react";
import { X, Download, Plus, Trash2, Save } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import type { BaselineMetadata } from "~backend/baselines/list_fs";

interface BaselinePreviewDrawerProps {
  baseline: BaselineMetadata;
  imageData: string;
  onClose: () => void;
  onDelete?: (screenId: string) => void;
  onRevalidate?: (screenId: string) => void;
  onUpdateMetadata?: (
    screenId: string,
    updates: {
      masks?: Array<{ type: string; selector?: string; x?: number; y?: number; width?: number; height?: number }>;
      tags?: string[];
      viewportWidth?: number;
      viewportHeight?: number;
      route?: string;
    }
  ) => void;
}

export function BaselinePreviewDrawer({
  baseline,
  imageData,
  onClose,
  onDelete,
  onRevalidate,
  onUpdateMetadata,
}: BaselinePreviewDrawerProps) {
  const [editing, setEditing] = useState(false);
  const [masks, setMasks] = useState(baseline.masks || []);
  const [tags, setTags] = useState(baseline.tags || []);
  const [route, setRoute] = useState(baseline.url || "");
  const [viewportWidth, setViewportWidth] = useState(baseline.viewportWidth);
  const [viewportHeight, setViewportHeight] = useState(baseline.viewportHeight);
  const [saving, setSaving] = useState(false);

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = imageData;
    link.download = `${baseline.screenId}-baseline.png`;
    link.click();
  };

  const addCssMask = () => {
    setMasks([...masks, { type: "css", selector: "" }]);
  };

  const addRectMask = () => {
    setMasks([...masks, { type: "rect", x: 0, y: 0, width: 100, height: 100 }]);
  };

  const removeMask = (index: number) => {
    setMasks(masks.filter((_, i) => i !== index));
  };

  const updateMask = (index: number, updates: any) => {
    setMasks(masks.map((m, i) => (i === index ? { ...m, ...updates } : m)));
  };

  const toggleTag = (tag: string) => {
    setTags(tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]);
  };

  const handleSave = async () => {
    if (!onUpdateMetadata) return;

    setSaving(true);
    try {
      await onUpdateMetadata(baseline.screenId, {
        masks,
        tags,
        route,
        viewportWidth,
        viewportHeight,
      });
      setEditing(false);
      if (onRevalidate) {
        await onRevalidate(baseline.screenId);
      }
    } catch (error) {
      console.error("Failed to save metadata:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setMasks(baseline.masks || []);
    setTags(baseline.tags || []);
    setRoute(baseline.url || "");
    setViewportWidth(baseline.viewportWidth);
    setViewportHeight(baseline.viewportHeight);
    setEditing(false);
  };

  const getResolvedThresholds = () => {
    if (tags.includes("critical")) {
      return {
        warn: { diffPixelRatio: 0.0001, diffPixels: 10 },
        fail: { diffPixelRatio: 0.001, diffPixels: 50 },
      };
    } else if (tags.includes("noisy")) {
      return {
        warn: { diffPixelRatio: 0.01, diffPixels: 1000 },
        fail: { diffPixelRatio: 0.05, diffPixels: 5000 },
      };
    } else {
      return {
        warn: { diffPixelRatio: 0.001, diffPixels: 100 },
        fail: { diffPixelRatio: 0.01, diffPixels: 1000 },
      };
    }
  };

  const thresholds = getResolvedThresholds();

  const hasNoisyWarning = tags.includes("noisy") && masks.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />

      <div className="ml-auto relative z-50 bg-background border-l w-full max-w-2xl h-full overflow-y-auto">
        <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-primary">{baseline.name}</h2>
          <div className="flex gap-2">
            {!editing && onUpdateMetadata && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <img src={imageData} alt={baseline.name} className="w-full border rounded-lg" />
          </div>

          <div>
            <h3 className="font-semibold text-primary mb-2">Metadata</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-secondary">Screen ID</span>
                <span className="text-primary font-mono">{baseline.screenId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-secondary">Route</span>
                {editing ? (
                  <Input
                    value={route}
                    onChange={(e) => setRoute(e.target.value)}
                    className="max-w-xs h-8"
                  />
                ) : (
                  <span className="text-primary font-mono">{baseline.url || "—"}</span>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-secondary">Viewport</span>
                {editing ? (
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      value={viewportWidth}
                      onChange={(e) => setViewportWidth(parseInt(e.target.value))}
                      className="w-20 h-8"
                    />
                    <span className="self-center text-secondary">×</span>
                    <Input
                      type="number"
                      value={viewportHeight}
                      onChange={(e) => setViewportHeight(parseInt(e.target.value))}
                      className="w-20 h-8"
                    />
                  </div>
                ) : (
                  <span className="text-primary">
                    {baseline.viewportWidth}×{baseline.viewportHeight}
                  </span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Status</span>
                <Badge variant={baseline.status === "validated" ? "default" : "outline"}>
                  {baseline.status}
                </Badge>
              </div>
              {baseline.statusMessage && (
                <div className="flex justify-between">
                  <span className="text-secondary">Message</span>
                  <span className="text-primary text-xs">{baseline.statusMessage}</span>
                </div>
              )}
              {baseline.size && (
                <div className="flex justify-between">
                  <span className="text-secondary">File Size</span>
                  <span className="text-primary">{(baseline.size / 1024).toFixed(2)} KB</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-secondary">Hash</span>
                <span className="text-primary font-mono text-xs truncate max-w-xs">
                  {baseline.hash}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-primary mb-2">Tags</h3>
            <div className="flex gap-2 flex-wrap">
              {["standard", "critical", "noisy"].map((tag) => (
                <span
                  key={tag}
                  onClick={() => editing && toggleTag(tag)}
                  className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-md ${
                    tags.includes(tag)
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-primary"
                  } ${editing ? "cursor-pointer hover:bg-accent" : ""}`}
                >
                  {tag}
                </span>
              ))}
            </div>
            {hasNoisyWarning && (
              <p className="text-sm text-yellow-500 mt-2">
                ⚠️ Baseline tagged as 'noisy' requires at least one mask
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-primary">Masks</h3>
              {editing && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={addCssMask}>
                    <Plus className="size-3" />
                    CSS
                  </Button>
                  <Button size="sm" variant="outline" onClick={addRectMask}>
                    <Plus className="size-3" />
                    Rect
                  </Button>
                </div>
              )}
            </div>
            {masks.length === 0 ? (
              <p className="text-sm text-secondary">No masks configured</p>
            ) : (
              <div className="space-y-2">
                {masks.map((mask, idx) => (
                  <div key={idx} className="border rounded p-3 text-sm space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-primary font-medium">
                        {mask.type === "css" ? "CSS Selector" : "Rectangle"}
                      </span>
                      {editing && (
                        <Button size="sm" variant="ghost" onClick={() => removeMask(idx)}>
                          <Trash2 className="size-3 text-red-500" />
                        </Button>
                      )}
                    </div>
                    {mask.type === "css" ? (
                      <div>
                        <label className="text-xs text-secondary">Selector</label>
                        {editing ? (
                          <Input
                            value={mask.selector || ""}
                            onChange={(e) => updateMask(idx, { selector: e.target.value })}
                            placeholder='e.g., [data-testid="clock"]'
                            className="mt-1"
                          />
                        ) : (
                          <p className="text-primary font-mono text-xs mt-1">{mask.selector}</p>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-secondary">X</label>
                          {editing ? (
                            <Input
                              type="number"
                              value={mask.x || 0}
                              onChange={(e) => updateMask(idx, { x: parseInt(e.target.value) })}
                              className="mt-1"
                            />
                          ) : (
                            <p className="text-primary mt-1">{mask.x}</p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs text-secondary">Y</label>
                          {editing ? (
                            <Input
                              type="number"
                              value={mask.y || 0}
                              onChange={(e) => updateMask(idx, { y: parseInt(e.target.value) })}
                              className="mt-1"
                            />
                          ) : (
                            <p className="text-primary mt-1">{mask.y}</p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs text-secondary">Width</label>
                          {editing ? (
                            <Input
                              type="number"
                              value={mask.width || 0}
                              onChange={(e) => updateMask(idx, { width: parseInt(e.target.value) })}
                              className="mt-1"
                            />
                          ) : (
                            <p className="text-primary mt-1">{mask.width}</p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs text-secondary">Height</label>
                          {editing ? (
                            <Input
                              type="number"
                              value={mask.height || 0}
                              onChange={(e) =>
                                updateMask(idx, { height: parseInt(e.target.value) })
                              }
                              className="mt-1"
                            />
                          ) : (
                            <p className="text-primary mt-1">{mask.height}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="font-semibold text-primary mb-2">Resolved Thresholds</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-secondary">Warn Pixel Ratio</span>
                <span className="text-primary font-mono">
                  {thresholds.warn.diffPixelRatio.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Warn Pixels</span>
                <span className="text-primary font-mono">{thresholds.warn.diffPixels}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Fail Pixel Ratio</span>
                <span className="text-primary font-mono">
                  {thresholds.fail.diffPixelRatio.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Fail Pixels</span>
                <span className="text-primary font-mono">{thresholds.fail.diffPixels}</span>
              </div>
            </div>
            <p className="text-xs text-muted mt-2">
              Based on tags: {tags.length > 0 ? tags.join(", ") : "standard (default)"}
            </p>
          </div>

          {editing ? (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleCancel}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? (
                  "Saving..."
                ) : (
                  <>
                    <Save className="size-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleDownload}>
                <Download className="size-4" />
                Download
              </Button>
              {onRevalidate && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onRevalidate(baseline.screenId)}
                >
                  Re-validate
                </Button>
              )}
            </div>
          )}

          {onDelete && !editing && (
            <Button
              variant="outline"
              className="w-full text-red-700 border-red-700 hover:bg-red-700 hover:text-white"
              onClick={() => {
                if (confirm(`Delete baseline "${baseline.name}"?`)) {
                  onDelete(baseline.screenId);
                  onClose();
                }
              }}
            >
              Delete Baseline
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
