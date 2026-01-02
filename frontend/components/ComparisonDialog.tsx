import { useState } from "react";
import { X, Check, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";

interface ComparisonDialogProps {
  screenId: string;
  screenName: string;
  currentImageData?: string;
  newImageData: string;
  newFile: File;
  onApprove: (screenId: string, file: File) => Promise<void>;
  onReject: () => void;
}

export function ComparisonDialog({
  screenId,
  screenName,
  currentImageData,
  newImageData,
  newFile,
  onApprove,
  onReject,
}: ComparisonDialogProps) {
  const [processing, setProcessing] = useState(false);
  const [approved, setApproved] = useState(false);
  const [view, setView] = useState<"split" | "current" | "new">("split");

  const handleApprove = async () => {
    setProcessing(true);
    try {
      await onApprove(screenId, newFile);
      setApproved(true);
      setTimeout(() => {
        onReject();
      }, 1500);
    } catch (error) {
      console.error("Approval failed:", error);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-xl max-w-7xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        <div className="bg-background border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Compare Baselines</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {screenName} ({screenId})
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border rounded-lg overflow-hidden">
              <Button
                variant={view === "current" ? "default" : "ghost"}
                size="sm"
                onClick={() => setView("current")}
                className="rounded-none"
                disabled={!currentImageData}
              >
                Current
              </Button>
              <Button
                variant={view === "split" ? "default" : "ghost"}
                size="sm"
                onClick={() => setView("split")}
                className="rounded-none"
              >
                Split
              </Button>
              <Button
                variant={view === "new" ? "default" : "ghost"}
                size="sm"
                onClick={() => setView("new")}
                className="rounded-none"
              >
                New
              </Button>
            </div>
            <Button variant="ghost" size="icon" onClick={onReject} disabled={processing}>
              <X />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {!currentImageData && (
            <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                No current baseline exists. This will be the first baseline image.
              </p>
            </div>
          )}

          {view === "split" && currentImageData ? (
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Current Baseline</h3>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                    Existing
                  </span>
                </div>
                <div className="border-2 border-red-500/30 rounded-lg overflow-hidden bg-muted/20">
                  <img
                    src={`data:image/png;base64,${currentImageData}`}
                    alt="Current baseline"
                    className="w-full h-auto"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">New Baseline</h3>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                    Replacement
                  </span>
                </div>
                <div className="border-2 border-green-500/30 rounded-lg overflow-hidden bg-muted/20">
                  <img
                    src={newImageData}
                    alt="New baseline"
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </div>
          ) : view === "current" && currentImageData ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Current Baseline</h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setView("new")}
                  >
                    <ChevronRight />
                    Next
                  </Button>
                </div>
              </div>
              <div className="border rounded-lg overflow-hidden bg-muted/20">
                <img
                  src={`data:image/png;base64,${currentImageData}`}
                  alt="Current baseline"
                  className="w-full h-auto max-h-[70vh] object-contain mx-auto"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">New Baseline</h3>
                <div className="flex items-center gap-2">
                  {currentImageData && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setView("current")}
                    >
                      <ChevronLeft />
                      Previous
                    </Button>
                  )}
                </div>
              </div>
              <div className="border rounded-lg overflow-hidden bg-muted/20">
                <img
                  src={newImageData}
                  alt="New baseline"
                  className="w-full h-auto max-h-[70vh] object-contain mx-auto"
                />
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg mt-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{newFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(newFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-background border-t px-6 py-4 flex gap-3 justify-between">
          <div className="text-sm text-muted-foreground flex items-center">
            {currentImageData ? (
              <span>Review changes before approving the new baseline</span>
            ) : (
              <span>This will create the first baseline for this screen</span>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onReject}
              disabled={processing}
            >
              <XCircle />
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={processing || approved}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {processing ? (
                "Processing..."
              ) : approved ? (
                <>
                  <Check />
                  Approved!
                </>
              ) : (
                <>
                  <Check />
                  Approve & Upload
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
