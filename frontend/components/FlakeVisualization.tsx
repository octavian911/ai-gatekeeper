import { useState } from "react";
import { AlertTriangle, Eye, EyeOff, Layers } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

interface Mask {
  type: "css" | "rect";
  selector?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

interface FlakeVisualizationProps {
  screenId: string;
  screenName: string;
  baselineImage: string;
  masks: Mask[];
  diffPixels: number;
  totalPixels: number;
  maskCoveragePercent: number;
}

export function FlakeVisualization({
  screenName,
  baselineImage,
  masks,
  diffPixels,
  totalPixels,
  maskCoveragePercent,
}: FlakeVisualizationProps) {
  const [showMasks, setShowMasks] = useState(true);
  const [selectedMask, setSelectedMask] = useState<number | null>(null);

  const getMaskLabel = (mask: Mask, index: number) => {
    if (mask.type === "css" && mask.selector) {
      return mask.selector;
    }
    if (mask.type === "rect") {
      return `Rect ${index + 1} (${mask.width}×${mask.height}px)`;
    }
    return `Mask ${index + 1}`;
  };

  const getRiskLevel = () => {
    if (maskCoveragePercent > 35) return { label: "High Risk", color: "text-red-600", bg: "bg-red-500/10" };
    if (maskCoveragePercent > 20) return { label: "Medium Risk", color: "text-yellow-600", bg: "bg-yellow-500/10" };
    return { label: "Low Risk", color: "text-green-600", bg: "bg-green-500/10" };
  };

  const risk = getRiskLevel();
  const flakeRate = ((diffPixels / totalPixels) * 100).toFixed(4);

  return (
    <div className="bg-card border-2 border-border-strong rounded-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-primary mb-1">{screenName}</h3>
          <p className="text-sm text-secondary">Flake Detection & Masking Analysis</p>
        </div>
        <Badge className={`${risk.bg} ${risk.color} border-${risk.color}/30`}>
          <AlertTriangle className="size-4" />
          {risk.label}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-background rounded-lg p-4">
          <p className="text-xs text-secondary mb-1">Mask Coverage</p>
          <p className="text-2xl font-bold text-primary">{maskCoveragePercent.toFixed(1)}%</p>
          <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full ${maskCoveragePercent > 35 ? "bg-red-500" : maskCoveragePercent > 20 ? "bg-yellow-500" : "bg-green-500"}`}
              style={{ width: `${Math.min(100, maskCoveragePercent)}%` }}
            />
          </div>
        </div>
        <div className="bg-background rounded-lg p-4">
          <p className="text-xs text-secondary mb-1">Flake Rate</p>
          <p className="text-2xl font-bold text-primary">{flakeRate}%</p>
          <p className="text-xs text-secondary mt-1">{diffPixels.toLocaleString()} / {totalPixels.toLocaleString()} pixels</p>
        </div>
        <div className="bg-background rounded-lg p-4">
          <p className="text-xs text-secondary mb-1">Active Masks</p>
          <p className="text-2xl font-bold text-primary">{masks.length}</p>
          <p className="text-xs text-secondary mt-1">{masks.filter(m => m.type === "css").length} CSS, {masks.filter(m => m.type === "rect").length} Rect</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
              <Layers className="size-4" />
              Visual Preview
            </h4>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMasks(!showMasks)}
            >
              {showMasks ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              {showMasks ? "Hide" : "Show"} Masks
            </Button>
          </div>
          <div className="relative border-2 border-border-strong rounded-lg overflow-hidden">
            <img src={baselineImage} alt="Baseline" className="w-full" />
            {showMasks && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ mixBlendMode: "multiply" }}
              >
                {masks.map((mask, idx) => {
                  if (mask.type === "rect" && mask.x !== undefined && mask.y !== undefined) {
                    const isSelected = selectedMask === idx;
                    return (
                      <rect
                        key={idx}
                        x={mask.x}
                        y={mask.y}
                        width={mask.width}
                        height={mask.height}
                        fill={isSelected ? "rgba(255, 0, 0, 0.3)" : "rgba(255, 165, 0, 0.2)"}
                        stroke={isSelected ? "#ff0000" : "#ffa500"}
                        strokeWidth={isSelected ? "3" : "2"}
                        className="pointer-events-auto cursor-pointer"
                        onClick={() => setSelectedMask(isSelected ? null : idx)}
                      />
                    );
                  }
                  return null;
                })}
              </svg>
            )}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
            <AlertTriangle className="size-4 text-yellow-500" />
            Masked Regions ({masks.length})
          </h4>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {masks.map((mask, idx) => (
              <div
                key={idx}
                className={`bg-background rounded-lg p-3 cursor-pointer transition-all ${
                  selectedMask === idx ? "ring-2 ring-primary" : "hover:bg-accent"
                }`}
                onClick={() => setSelectedMask(selectedMask === idx ? null : idx)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-primary">{getMaskLabel(mask, idx)}</p>
                    {mask.type === "rect" && (
                      <p className="text-xs text-secondary mt-1">
                        Position: ({mask.x}, {mask.y}) • Size: {mask.width}×{mask.height}px
                      </p>
                    )}
                    {mask.type === "css" && (
                      <p className="text-xs text-secondary mt-1 font-mono">{mask.selector}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="ml-2">
                    {mask.type.toUpperCase()}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {maskCoveragePercent > 35 && (
            <div className="mt-4 bg-red-500/10 border-2 border-red-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="size-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-600 mb-1">Excessive Masking Detected</p>
                  <p className="text-sm text-foreground">
                    {maskCoveragePercent.toFixed(1)}% of the screen is masked, exceeding the recommended 35% limit. 
                    This may indicate over-reliance on masking and reduce test effectiveness.
                  </p>
                </div>
              </div>
            </div>
          )}

          {masks.length === 0 && (
            <div className="text-center py-8 bg-background rounded-lg">
              <Layers className="size-12 mx-auto mb-3 text-icon-muted" />
              <p className="text-sm text-secondary">No masks configured for this screen</p>
              <p className="text-xs text-secondary mt-1">Add masks to exclude dynamic content from comparison</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
