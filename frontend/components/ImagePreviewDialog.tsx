import { X, Hash, FileImage } from "lucide-react";
import { Button } from "./ui/button";

interface ImagePreviewDialogProps {
  screenId: string;
  screenName: string;
  imageData: string;
  hash: string;
  onClose: () => void;
}

export function ImagePreviewDialog({
  screenId,
  screenName,
  imageData,
  hash,
  onClose,
}: ImagePreviewDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-background border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Baseline Preview</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {screenName} ({screenId})
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          <div className="border rounded-lg overflow-hidden bg-muted/20">
            <img
              src={`data:image/png;base64,${imageData}`}
              alt={screenName}
              className="w-full h-auto"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
              <Hash className="size-5 text-muted-foreground mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground mb-1">SHA-256 Hash</p>
                <code className="text-xs bg-background px-2 py-1 rounded block break-all">
                  {hash}
                </code>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
              <FileImage className="size-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground mb-1">Image Information</p>
                <p className="text-xs text-muted-foreground">
                  Format: PNG • Base64 encoded
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-background border-t px-6 py-4 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
