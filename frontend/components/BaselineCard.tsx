import { CheckCircle2, XCircle, AlertCircle, Eye, RotateCw, Trash2 } from "lucide-react";
import { Button } from "./ui/button";

interface BaselineCardProps {
  baseline: {
    screenId: string;
    name: string;
    url: string;
    hash: string;
    tags?: string[];
    hasImage: boolean;
    validated?: boolean;
    status?: string;
    statusMessage?: string;
    size?: number;
    viewportWidth?: number;
    viewportHeight?: number;
  };
  onView: (screenId: string) => void;
  onValidate: (screenId: string) => void;
}

export function BaselineCard({
  baseline,
  onView,
  onValidate,
}: BaselineCardProps) {
  const getStatusIcon = () => {
    if (!baseline.hasImage) {
      return <XCircle className="size-5 text-red-500" />;
    }
    if (baseline.validated) {
      return <CheckCircle2 className="size-5 text-green-500" />;
    }
    return <AlertCircle className="size-5 text-yellow-500" />;
  };

  const getStatusText = () => {
    if (!baseline.hasImage) return "Missing";
    if (baseline.validated) return "Validated";
    return "Invalid";
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return "—";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  return (
    <div data-testid="baseline-card" className="border-2 border-border-strong rounded-lg p-4 bg-card hover:border-border-strong hover:shadow-sm transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-value mb-1">{baseline.name}</h3>
          <p className="text-sm text-label">{baseline.screenId}</p>
        </div>
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="text-sm font-medium">{getStatusText()}</span>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {baseline.url && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-label">Route:</span>
            <code className="text-xs text-value bg-muted/30 border border-border px-2 py-1 rounded max-w-[200px] truncate">{baseline.url}</code>
          </div>
        )}
        {baseline.viewportWidth && baseline.viewportHeight && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-label">Viewport:</span>
            <span className="text-value">{baseline.viewportWidth}×{baseline.viewportHeight}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-label">Size:</span>
          <span className="text-value">{formatSize(baseline.size)}</span>
        </div>
        <div className="flex items-start justify-between text-sm">
          <span className="text-label">Hash:</span>
          <code className="text-xs text-value bg-muted/30 border border-border px-2 py-1 rounded max-w-[200px] truncate" title={baseline.hash}>
            {baseline.hash.slice(0, 12)}...
          </code>
        </div>
        {baseline.statusMessage && (
          <div className="flex items-start gap-2 text-sm">
            <AlertCircle className="size-3 text-yellow-500 mt-0.5 flex-shrink-0" />
            <span className="text-label text-xs">{baseline.statusMessage}</span>
          </div>
        )}
        {baseline.tags && baseline.tags.length > 0 && (
          <div className="flex items-start gap-2 text-sm">
            <span className="text-label">Tags:</span>
            <div className="flex flex-wrap gap-1">
              {baseline.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs bg-muted/30 text-value border border-border px-2 py-0.5 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {baseline.hasImage ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onView(baseline.screenId)}
              className="flex-1"
            >
              <Eye className="size-3" />
              View
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onValidate(baseline.screenId)}
            >
              <RotateCw className="size-3" />
              Re-validate
            </Button>
          </>
        ) : (
          <div className="text-sm text-label text-center py-2 flex-1">
            No baseline image found
          </div>
        )}
      </div>
    </div>
  );
}
