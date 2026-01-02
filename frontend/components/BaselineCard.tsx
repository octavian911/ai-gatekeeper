import { CheckCircle2, XCircle, AlertCircle, Upload, Eye } from "lucide-react";
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
    size?: number;
  };
  onUpload: (screenId: string) => void;
  onView: (screenId: string) => void;
  onValidate: (screenId: string) => void;
}

export function BaselineCard({
  baseline,
  onUpload,
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
    if (!baseline.hasImage) return "No image";
    if (baseline.validated) return "Validated";
    return "Invalid hash";
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
          <h3 className="font-semibold text-foreground mb-1">{baseline.name}</h3>
          <p className="text-sm text-muted-foreground">{baseline.screenId}</p>
        </div>
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="text-sm font-medium">{getStatusText()}</span>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">URL:</span>
          <code className="text-xs bg-muted px-2 py-1 rounded">{baseline.url}</code>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Size:</span>
          <span className="text-foreground">{formatSize(baseline.size)}</span>
        </div>
        <div className="flex items-start justify-between text-sm">
          <span className="text-muted-foreground">Hash:</span>
          <code className="text-xs bg-muted px-2 py-1 rounded max-w-[200px] truncate">
            {baseline.hash}
          </code>
        </div>
        {baseline.tags && baseline.tags.length > 0 && (
          <div className="flex items-start gap-2 text-sm">
            <span className="text-muted-foreground">Tags:</span>
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => onUpload(baseline.screenId)}
          className="flex-1"
        >
          <Upload />
          Upload
        </Button>
        {baseline.hasImage && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onView(baseline.screenId)}
            >
              <Eye />
              View
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onValidate(baseline.screenId)}
            >
              Validate
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
