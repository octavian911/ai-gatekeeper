import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

interface ConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  action: "approve" | "reject";
  screenCount: number;
  failedCount: number;
}

export function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  action,
  screenCount,
  failedCount,
}: ConfirmationDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const expectedText = action === "approve" ? "APPROVE" : "REJECT";

  const handleConfirm = () => {
    if (confirmText === expectedText) {
      onConfirm();
      setConfirmText("");
      onClose();
    }
  };

  const handleClose = () => {
    setConfirmText("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>
              {action === "approve" ? (
                <>
                  <CheckCircle2 className="size-5 text-green-600 inline" />
                  {" "}Approve Changes
                </>
              ) : (
                <>
                  <XCircle className="size-5 text-red-600 inline" />
                  {" "}Reject Changes
                </>
              )}
            </DialogTitle>
          </div>
          <DialogDescription>
            {action === "approve" ? (
              <div className="bg-orange-500/10 border-2 border-orange-500/40 rounded-lg p-3 mt-2">
                <p className="font-semibold text-orange-700">⚠️ This will permanently replace the official baseline images.
                </p>
                <p className="text-sm text-orange-600 mt-1">
                  All future visual regression tests will use these new screenshots as the reference.
                </p>
              </div>
            ) : (
              "This will block the changes and mark the test run as rejected"
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {action === "approve" && failedCount > 0 && (
            <div className="bg-yellow-500/10 border-2 border-yellow-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="size-5 text-yellow-600 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold text-yellow-700 mb-1">
                    Warning: {failedCount} Failed Screen{failedCount > 1 ? "s" : ""}
                  </div>
                  <div className="text-sm text-yellow-700">
                    Approving will accept the changes from {failedCount} failed screen{failedCount > 1 ? "s" : ""} and 
                    update them as new baselines. Make sure these changes are intentional.
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-accent/50 border-2 border-border-strong rounded-lg p-4">
            <h4 className="font-semibold text-primary mb-2">What happens next:</h4>
            <ul className="space-y-2 text-sm text-secondary">
              {action === "approve" ? (
                <>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600">✓</span>
                    <span>New screenshots become the approved baseline</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600">✓</span>
                    <span>Future tests will compare against these new images</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600">✓</span>
                    <span>This review is marked as "Approved"</span>
                  </li>
                </>
              ) : (
                <>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">✗</span>
                    <span>Baseline remains unchanged</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">✗</span>
                    <span>Developer must fix the changes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">✗</span>
                    <span>This review is marked as "Rejected"</span>
                  </li>
                </>
              )}
            </ul>
          </div>

          <div>
            <label className="block text-sm font-semibold text-primary mb-2">
              Type <span className="font-mono text-red-600">{expectedText}</span> to confirm
            </label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={`Type ${expectedText}`}
              className="font-mono"
              autoFocus
            />
          </div>

          {confirmText && confirmText !== expectedText && (
            <div className="text-sm text-red-600">
              Please type exactly "{expectedText}" to confirm
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={confirmText !== expectedText}
            className={
              action === "approve"
                ? "bg-green-600 hover:bg-green-700"
                : "bg-red-600 hover:bg-red-700"
            }
          >
            {action === "approve" ? "Approve Changes" : "Reject Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
