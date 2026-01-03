import { useState } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { CheckCircle2, XCircle, AlertTriangle, Eye, Layers, ChevronDown, ChevronUp } from "lucide-react";
import type { ScreenResult } from "~backend/runs/get_review";

interface ScreenDiffCardProps {
  screen: ScreenResult;
  index: number;
}

export function ScreenDiffCard({ screen, index }: ScreenDiffCardProps) {
  const [expanded, setExpanded] = useState(screen.status === "FAIL");
  const [activeView, setActiveView] = useState<"diff" | "side-by-side" | "overlay">("diff");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const getStatusBadge = () => {
    switch (screen.status) {
      case "PASS":
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
            <CheckCircle2 className="size-3 mr-1" />
            PASS
          </Badge>
        );
      case "WARN":
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
            <AlertTriangle className="size-3 mr-1" />
            WARN
          </Badge>
        );
      case "FAIL":
        return (
          <Badge className="bg-red-500/10 text-red-600 border-red-500/30">
            <XCircle className="size-3 mr-1" />
            FAIL
          </Badge>
        );
    }
  };

  const getFlakeBadge = () => {
    if (screen.flakeStatus === "stable") {
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
          Stable ✅
        </Badge>
      );
    }
    if (screen.flakeStatus === "unstable") {
      return (
        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
          Unstable ⚠️
        </Badge>
      );
    }
    return null;
  };

  const getVerdict = () => {
    const drift = 100 - screen.originalityPercent;
    if (screen.status === "FAIL") {
      return `This screen drifted ${drift.toFixed(1)}% beyond baseline tolerance`;
    } else if (screen.status === "WARN") {
      return `Minor drift detected (${drift.toFixed(1)}%) - within warning threshold`;
    } else {
      return `Screen matches baseline within acceptable limits`;
    }
  };

  return (
    <div className="bg-card border-2 border-border-strong rounded-lg overflow-hidden">
      <div
        className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono text-secondary">#{index + 1}</span>
            <h3 className="text-lg font-semibold text-primary">{screen.name}</h3>
            {getStatusBadge()}
            {getFlakeBadge()}
          </div>
          <div className="flex items-center gap-4">
            {expanded ? (
              <ChevronUp className="size-5 text-icon-muted" />
            ) : (
              <ChevronDown className="size-5 text-icon-muted" />
            )}
          </div>
        </div>

        {!expanded && (
          <div className="mt-2 text-sm font-medium text-primary italic">
            {getVerdict()}
          </div>
        )}

        {screen.changes.length > 0 && (
          <div className="mt-1 text-sm text-secondary">
            {screen.changes.length} change{screen.changes.length > 1 ? "s" : ""} detected
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t-2 border-border-strong">
          <div className="p-4 bg-accent/30">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-primary">Decision Framework</h4>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={activeView === "diff" ? "default" : "outline"}
                  onClick={() => setActiveView("diff")}
                >
                  <Layers className="size-4" />
                  Diff
                </Button>
                <Button
                  size="sm"
                  variant={activeView === "side-by-side" ? "default" : "outline"}
                  onClick={() => setActiveView("side-by-side")}
                >
                  <Eye className="size-4" />
                  Side-by-Side
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
              <div className="bg-card border-2 border-border-strong rounded-lg p-3">
                <div className="font-semibold text-primary mb-1">1. Is it real?</div>
                <div className="text-secondary text-xs">
                  {screen.flakeStatus === "stable" ? (
                    <span className="text-green-600">✅ Stable change - not a flake</span>
                  ) : screen.flakeStatus === "unstable" ? (
                    <span className="text-yellow-600">⚠️ May be flaky - rerun recommended</span>
                  ) : (
                    <span>Unknown stability</span>
                  )}
                </div>
              </div>

              <div className="bg-card border-2 border-border-strong rounded-lg p-3">
                <div className="font-semibold text-primary mb-1">2. Is it acceptable?</div>
                <div className="text-secondary text-xs">
                  Review changes below
                </div>
              </div>

              <div className="bg-card border-2 border-border-strong rounded-lg p-3">
                <div className="font-semibold text-primary mb-1">3. What do I do?</div>
                <div className="text-secondary text-xs">
                  {screen.status === "FAIL" ? (
                    <span className="text-red-600">Approve = new baseline</span>
                  ) : (
                    <span className="text-green-600">Already passing</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAdvanced(!showAdvanced);
                }}
                className="text-xs text-secondary hover:text-primary"
              >
                {showAdvanced ? '▼ Hide' : '▶ Show'} Advanced Details
              </Button>
            </div>

            {showAdvanced && (
              <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-lg p-3 mb-4">
                <div className="text-sm font-semibold text-blue-700">
                  ℹ️ Technical Metrics
                </div>
                <div className="text-xs text-blue-600 mt-1 space-y-1">
                  <div>Similarity: {screen.originalityPercent.toFixed(1)}%</div>
                  {screen.volatileRegionsMasked! > 0 && (
                    <div>{screen.volatileRegionsMasked} volatile region{screen.volatileRegionsMasked! > 1 ? 's' : ''} masked from comparison</div>
                  )}
                  {screen.diffPixels && (
                    <div>{screen.diffPixels.toLocaleString()} pixels changed</div>
                  )}
                </div>
              </div>
            )}

            {activeView === "diff" && (
              <div className="bg-card border-2 border-border-strong rounded-lg p-4">
                <div className="text-center text-sm text-secondary mb-2">Diff Highlights</div>
                {screen.diffImageUrl || screen.diffPath ? (
                  <img
                    src={screen.diffImageUrl || screen.diffPath}
                    alt="Diff"
                    className="w-full rounded border-2 border-border-strong"
                  />
                ) : (
                  <div className="text-center py-8 text-secondary">No diff image available</div>
                )}
              </div>
            )}

            {activeView === "side-by-side" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-card border-2 border-border-strong rounded-lg p-4">
                  <div className="text-center text-sm font-semibold text-primary mb-2">
                    Approved (Baseline)
                  </div>
                  {screen.baselineImageUrl || screen.expectedPath ? (
                    <img
                      src={screen.baselineImageUrl || screen.expectedPath}
                      alt="Baseline"
                      className="w-full rounded border-2 border-green-500/30"
                    />
                  ) : (
                    <div className="text-center py-8 text-secondary">No baseline image</div>
                  )}
                </div>

                <div className="bg-card border-2 border-border-strong rounded-lg p-4">
                  <div className="text-center text-sm font-semibold text-primary mb-2">
                    Current (This PR)
                  </div>
                  {screen.currentImageUrl || screen.actualPath ? (
                    <img
                      src={screen.currentImageUrl || screen.actualPath}
                      alt="Current"
                      className="w-full rounded border-2 border-red-500/30"
                    />
                  ) : (
                    <div className="text-center py-8 text-secondary">No current image</div>
                  )}
                </div>
              </div>
            )}

            {screen.changes.length > 0 && (
              <div className="mt-4 bg-card border-2 border-border-strong rounded-lg p-4">
                <h4 className="text-sm font-semibold text-primary mb-3">Detected Changes</h4>
                <div className="space-y-2">
                  {screen.changes.map((change) => {
                    const getImpactDescription = () => {
                      if (change.changeType === "visual") {
                        return "Users will see different styling or layout in this area";
                      } else if (change.changeType === "content") {
                        return "Users will see different text, wording, or messaging";
                      } else if (change.changeType === "layout") {
                        return "Users will see elements in different positions or sizes";
                      } else if (change.changeType === "color") {
                        return "Users will see a different color scheme or visual appearance";
                      } else if (change.changeType === "structure") {
                        return "Users will see a different component structure or hierarchy";
                      } else if (change.changeType === "text") {
                        return "Users will see different text content or labels";
                      }
                      return change.description ? `Users will see: ${change.description}` : "Visual difference detected - review image comparison above";
                    };

                    return (
                      <div
                        key={change.id}
                        className="flex items-start gap-3 p-2 rounded bg-accent/30"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {change.changeType}
                            </Badge>
                            {change.metadata?.severity && (
                              <Badge
                                variant="outline"
                                className={
                                  change.metadata.severity === "high"
                                    ? "bg-red-500/10 text-red-600 border-red-500/30"
                                    : change.metadata.severity === "medium"
                                    ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/30"
                                    : "bg-blue-500/10 text-blue-600 border-blue-500/30"
                                }
                              >
                                {change.metadata.severity} impact
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-primary mt-1">{getImpactDescription()}</p>
                          {change.selector && showAdvanced && (
                            <code className="text-xs text-secondary font-mono block mt-1">
                              {change.selector}
                            </code>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {screen.suggestedMasks! > 0 && (
              <div className="mt-4 bg-yellow-500/10 border-2 border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-yellow-700 mb-1">
                      💡 Mask Suggestion: Avoid Approving
                    </div>
                    <div className="text-sm text-yellow-700 mb-2">
                      {screen.suggestedMasks} volatile region{screen.suggestedMasks! > 1 ? "s" : ""} detected (e.g., timestamps, random IDs, live data).
                    </div>
                    <div className="text-xs text-yellow-600 bg-yellow-500/10 rounded p-2 mb-2">
                      <strong>Recommended:</strong> Add mask rules to ignore these changing areas instead of approving this diff.
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-yellow-500/50 text-yellow-700 hover:bg-yellow-500/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open('/settings', '_blank');
                    }}
                  >
                    Apply Mask
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
