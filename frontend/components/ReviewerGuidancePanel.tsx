import { useState } from "react";
import { ChevronDown, ChevronRight, Copy, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { Button } from "./ui/button";

export function ReviewerGuidancePanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMeanings, setShowMeanings] = useState(false);
  const [copied, setCopied] = useState(false);

  const instructions = `Review Evidence (for non-technical reviewers)

1. Open the Pull Request in GitHub
2. Go to the "Checks" tab
3. Download the test artifacts
4. Extract the ZIP and open report.html
5. Review all FAIL and WARN diffs carefully
6. If changes are intentional: add label "approve-baseline" in GitHub

Note: You only need to review visual diffs. Technical details are handled automatically.`;

  const handleCopy = () => {
    navigator.clipboard.writeText(instructions);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-accent/50 hover:bg-accent transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
          <h3 className="font-semibold text-foreground">Review Evidence (for non-technical reviewers)</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleCopy();
          }}
        >
          {copied ? (
            <>
              <CheckCircle2 className="size-3 text-green-500" />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-3" />
              Copy Instructions
            </>
          )}
        </Button>
      </button>

      {isExpanded && (
        <div className="p-4 space-y-4">
          <div className="bg-background rounded-lg p-4 border">
            <ol className="space-y-2 text-sm text-foreground">
              <li className="flex gap-2">
                <span className="font-semibold min-w-[1.5rem]">1.</span>
                <span>Open the Pull Request in GitHub</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold min-w-[1.5rem]">2.</span>
                <span>Go to the "Checks" tab</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold min-w-[1.5rem]">3.</span>
                <span>Download the test artifacts (look for visual regression results)</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold min-w-[1.5rem]">4.</span>
                <span>Extract the ZIP and open <code className="bg-accent px-1 rounded">report.html</code></span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold min-w-[1.5rem]">5.</span>
                <span>Review all <strong>FAIL</strong> and <strong>WARN</strong> diffs carefully</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold min-w-[1.5rem]">6.</span>
                <span>
                  If changes are intentional: add label{" "}
                  <code className="bg-accent px-1 rounded font-semibold">approve-baseline</code> in GitHub
                </span>
              </li>
            </ol>
          </div>

          <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
            <p>
              <strong>Note:</strong> You only need to review visual diffs. Technical details are handled
              automatically.
            </p>
          </div>

          <button
            onClick={() => setShowMeanings(!showMeanings)}
            className="w-full text-left px-3 py-2 bg-background border rounded-lg hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">
                Understanding Test Results
              </span>
              {showMeanings ? (
                <ChevronDown className="size-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-4 text-muted-foreground" />
              )}
            </div>
          </button>

          {showMeanings && (
            <div className="bg-background border rounded-lg p-4 space-y-3">
              <div className="flex gap-3">
                <CheckCircle2 className="size-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-foreground mb-1">PASS</h4>
                  <p className="text-sm text-muted-foreground">
                    Screenshot matches baseline within acceptable thresholds. No action needed.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <AlertCircle className="size-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-foreground mb-1">WARN</h4>
                  <p className="text-sm text-muted-foreground">
                    Minor differences detected. Review the diff image to determine if intentional.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <XCircle className="size-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-foreground mb-1">FAIL</h4>
                  <p className="text-sm text-muted-foreground">
                    Significant differences found. Always review carefully before approving.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
