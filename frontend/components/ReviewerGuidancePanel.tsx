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
    <div className="bg-card border-2 border-border-strong rounded-lg overflow-hidden shadow-sm">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-accent/50 hover:bg-accent transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="size-4 text-icon-muted" />
          ) : (
            <ChevronRight className="size-4 text-icon-muted" />
          )}
          <h3 className="font-semibold text-primary">Review Evidence (for non-technical reviewers)</h3>
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
          <div className="bg-background rounded-lg p-4 border-2 border-border-strong">
            <ol className="space-y-2 text-sm">
              <li className="flex gap-2">
                <span className="font-semibold min-w-[1.5rem] text-primary">1.</span>
                <span className="text-primary">Open the Pull Request in GitHub</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold min-w-[1.5rem] text-primary">2.</span>
                <span className="text-primary">Go to the <strong>"Checks"</strong> tab</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold min-w-[1.5rem] text-primary">3.</span>
                <span className="text-primary">Download the test artifacts (look for visual regression results)</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold min-w-[1.5rem] text-primary">4.</span>
                <span className="text-primary">Extract the ZIP and open <code className="bg-accent px-1 rounded text-foreground">report.html</code></span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold min-w-[1.5rem] text-primary">5.</span>
                <span className="text-primary">Review all <strong>FAIL</strong> and <strong>WARN</strong> diffs carefully</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold min-w-[1.5rem] text-primary">6.</span>
                <span className="text-primary">
                  If changes are intentional: add label{" "}
                  <code className="bg-accent px-1 rounded font-semibold text-foreground">approve-baseline</code> in GitHub
                </span>
              </li>
            </ol>
          </div>

          <div className="text-sm bg-muted/30 p-3 rounded-lg">
            <p className="text-primary">
              <strong>Note:</strong> You only need to review visual diffs. Technical details are handled
              automatically.
            </p>
          </div>

          <button
            onClick={() => setShowMeanings(!showMeanings)}
            className="w-full text-left px-3 py-2 bg-background border-2 border-border-strong rounded-lg hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-primary">
                Understanding Test Results
              </span>
              {showMeanings ? (
                <ChevronDown className="size-4 text-icon-muted" />
              ) : (
                <ChevronRight className="size-4 text-icon-muted" />
              )}
            </div>
          </button>

          {showMeanings && (
            <div className="bg-background border-2 border-border-strong rounded-lg p-4 space-y-3">
              <div className="flex gap-3">
                <CheckCircle2 className="size-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-primary mb-1">PASS</h4>
                  <p className="text-sm text-secondary">
                    Screenshot matches baseline within acceptable thresholds. No action needed.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <AlertCircle className="size-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-primary mb-1">WARN</h4>
                  <p className="text-sm text-secondary">
                    Minor differences detected. Review the diff image to determine if intentional.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <XCircle className="size-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-primary mb-1">FAIL</h4>
                  <p className="text-sm text-secondary">
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
