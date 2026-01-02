import { X, Download } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import type { BaselineMetadata } from "~backend/baselines/list";

interface BaselinePreviewDrawerProps {
  baseline: BaselineMetadata;
  imageData: string;
  onClose: () => void;
  onDelete?: (screenId: string) => void;
  onRevalidate?: (screenId: string) => void;
}

export function BaselinePreviewDrawer({ 
  baseline, 
  imageData, 
  onClose, 
  onDelete,
  onRevalidate 
}: BaselinePreviewDrawerProps) {
  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${imageData}`;
    link.download = `${baseline.screenId}-baseline.png`;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      
      <div className="ml-auto relative z-50 bg-background border-l w-full max-w-2xl h-full overflow-y-auto">
        <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">{baseline.name}</h2>
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <img 
              src={`data:image/png;base64,${imageData}`} 
              alt={baseline.name}
              className="w-full border rounded-lg"
            />
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-2">Metadata</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Screen ID</span>
                <span className="text-foreground font-mono">{baseline.screenId}</span>
              </div>
              {baseline.url && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Route</span>
                  <span className="text-foreground font-mono">{baseline.url}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Viewport</span>
                <span className="text-foreground">
                  {baseline.viewportWidth}×{baseline.viewportHeight}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={baseline.status === "validated" ? "default" : "outline"}>
                  {baseline.status}
                </Badge>
              </div>
              {baseline.statusMessage && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Message</span>
                  <span className="text-foreground text-xs">{baseline.statusMessage}</span>
                </div>
              )}
              {baseline.size && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">File Size</span>
                  <span className="text-foreground">
                    {(baseline.size / 1024).toFixed(2)} KB
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hash</span>
                <span className="text-foreground font-mono text-xs truncate max-w-xs">
                  {baseline.hash}
                </span>
              </div>
            </div>
          </div>

          {baseline.tags && baseline.tags.length > 0 && (
            <div>
              <h3 className="font-semibold text-foreground mb-2">Tags</h3>
              <div className="flex gap-2 flex-wrap">
                {baseline.tags.map(tag => (
                  <Badge key={tag} variant="outline">{tag}</Badge>
                ))}
              </div>
            </div>
          )}

          {baseline.masks && baseline.masks.length > 0 && (
            <div>
              <h3 className="font-semibold text-foreground mb-2">Masks</h3>
              <div className="space-y-2">
                {baseline.masks.map((mask, idx) => (
                  <div key={idx} className="border rounded p-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <span className="text-foreground font-mono">{mask.type}</span>
                    </div>
                    {mask.selector && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Selector</span>
                        <span className="text-foreground font-mono text-xs">{mask.selector}</span>
                      </div>
                    )}
                    {mask.x !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Position</span>
                        <span className="text-foreground">
                          {mask.x},{mask.y} ({mask.width}×{mask.height})
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {baseline.thresholds && Object.keys(baseline.thresholds).length > 0 && (
            <div>
              <h3 className="font-semibold text-foreground mb-2">Thresholds</h3>
              <div className="space-y-2 text-sm">
                {Object.entries(baseline.thresholds).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-muted-foreground">{key}</span>
                    <span className="text-foreground font-mono">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleDownload}>
              <Download className="size-4" />
              Download
            </Button>
            {onRevalidate && (
              <Button variant="outline" className="flex-1" onClick={() => onRevalidate(baseline.screenId)}>
                Re-validate
              </Button>
            )}
          </div>

          {onDelete && (
            <Button 
              variant="outline" 
              className="w-full text-red-500 border-red-500 hover:bg-red-500 hover:text-white" 
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
