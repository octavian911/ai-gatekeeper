export interface GateConfig {
  baseUrl: string;
  routes: RouteConfig[];
  policy: PolicyConfig;
  viewport: { width: number; height: number };
  timeout?: number;
}

export interface RouteConfig {
  path: string;
  name: string;
  waitForSelector?: string;
  threshold?: number;
  masks?: MaskConfig[];
}

export interface PolicyConfig {
  pixelDiffThreshold: number;
  antiAliasingTolerance: number;
  maxDiffPixels: number;
  tagOverrides?: Record<string, Partial<PolicyConfig>>;
}

export interface MaskConfig {
  selector: string;
  type: 'always' | 'conditional';
}

export interface BaselineMetadata {
  route: string;
  timestamp: string;
  viewport: { width: number; height: number };
  userAgent: string;
  hash: string;
}

export interface ComparisonResult {
  route: string;
  passed: boolean;
  pixelsDiff: number;
  percentDiff: number;
  threshold: number;
  baselinePath: string;
  actualPath: string;
  diffPath?: string;
}

export interface GateResult {
  passed: boolean;
  timestamp: string;
  totalRoutes: number;
  passedRoutes: number;
  failedRoutes: number;
  comparisons: ComparisonResult[];
  flakeRate?: number;
}

export interface EvidencePack {
  runId: string;
  timestamp: string;
  manifest: {
    baselines: { path: string; hash: string }[];
    actuals: { path: string; hash: string }[];
    diffs: { path: string; hash: string }[];
    summary: { path: string; hash: string };
  };
}

export interface MaskSuggestion {
  route: string;
  selector: string;
  reason: string;
  confidence: number;
  examples: string[];
}

export interface Mask {
  type: 'css' | 'rect';
  selector?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface ThresholdBand {
  diffPixelRatio: number;
  diffPixels: number;
}

export interface ScreenThresholds {
  warn: ThresholdBand;
  fail: ThresholdBand;
  requireMasks?: boolean;
}

export interface ViewportConfig {
  width: number;
  height: number;
  deviceScaleFactor: number;
  browser: 'chromium' | 'firefox' | 'webkit';
}

export interface ScreenBaseline {
  name: string;
  url: string;
  tags?: string[];
  viewport?: Partial<ViewportConfig>;
  thresholds?: Partial<ScreenThresholds>;
  masks?: Mask[];
}
