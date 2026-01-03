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
    <div className="border rounded-lg p-4 bg-card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-primary mb-1">{baseline.name}</h3>
          <p className="text-sm text-secondary">{baseline.screenId}</p>
        </div>
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="text-sm font-medium">{getStatusText()}</span>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {baseline.url && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-secondary">Route:</span>
            <code className="text-xs bg-muted px-2 py-1 rounded max-w-[200px] truncate">{baseline.url}</code>
          </div>
        )}
        {baseline.viewportWidth && baseline.viewportHeight && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-secondary">Viewport:</span>
            <span className="text-primary">{baseline.viewportWidth}×{baseline.viewportHeight}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-secondary">Size:</span>
          <span className="text-primary">{formatSize(baseline.size)}</span>
        </div>
        <div className="flex items-start justify-between text-sm">
          <span className="text-secondary">Hash:</span>
          <code className="text-xs bg-muted px-2 py-1 rounded max-w-[200px] truncate" title={baseline.hash}>
            {baseline.hash.slice(0, 12)}...
          </code>
        </div>
        {baseline.statusMessage && (
          <div className="flex items-start gap-2 text-sm">
            <AlertCircle className="size-3 text-yellow-500 mt-0.5 flex-shrink-0" />
            <span className="text-secondary text-xs">{baseline.statusMessage}</span>
          </div>
        )}
        {baseline.tags && baseline.tags.length > 0 && (
          <div className="flex items-start gap-2 text-sm">
            <span className="text-secondary">Tags:</span>
            <div className="flex flex-wrap gap-1">
              {baseline.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full"
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
          <div className="text-sm text-secondary text-center py-2 flex-1">
            No baseline image found
          </div>
        )}
      </div>
    </div>
  );
}
