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

export interface EvidencePackManifest {
  files: Array<{ path: string; hash: string }>;
}

export interface EvidencePackResult {
  outputPath: string;
  manifest: EvidencePackManifest;
  fileCount: number;
}

export interface MaskSuggestion {
  route: string;
  selector: string;
  reason: string;
  confidence: number;
  examples: string[];
  screenId?: string;
  type?: 'css' | 'rect';
  bbox?: { x: number; y: number; width: number; height: number };
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

export type RunStatus = 'PASS' | 'WARN' | 'FAIL';

export interface ScreenResult {
  screenId: string;
  name: string;
  url: string;
  status: RunStatus;
  diffPixels: number;
  diffPixelRatio: number;
  totalPixels: number;
  originalityPercent: number;
  thresholds: ScreenThresholds;
  error?: string;
  expectedPath?: string;
  actualPath?: string;
  diffPath?: string;
}

export interface RunSummary {
  runId: string;
  timestamp: string;
  sha?: string;
  branch?: string;
  total: number;
  passed: number;
  warned: number;
  failed: number;
  results: ScreenResult[];
  policyHash?: string;
  looseningOccurred?: boolean;
  looseningJustifications?: Array<{ screenId: string; justification: string }>;
}

export interface DeterministicConfig {
  browser: 'chromium' | 'firefox' | 'webkit';
  deviceScaleFactor: number;
  locale: string;
  timezoneId: string;
  colorScheme: 'light' | 'dark';
  reduceMotion: 'reduce' | 'no-preference';
  disableAnimations: boolean;
  blockExternalNetwork: boolean;
  waitUntil: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  layoutStabilityMs: number;
  screenshotAfterSettledOnly: boolean;
}

export interface PolicyThresholds {
  warn: ThresholdBand;
  fail: ThresholdBand;
  requireMasks?: boolean;
}

export interface PolicyDefaults {
  viewport: { width: number; height: number };
  determinism: DeterministicConfig;
  thresholds: {
    standard: PolicyThresholds;
    critical: PolicyThresholds;
    noisy: PolicyThresholds;
  };
}

export interface TagRules {
  criticalRoutes?: string[];
  noisyRoutes?: string[];
}

export interface EnforcementConfig {
  allowLoosening: boolean;
  allowPerScreenViewportOverride: boolean;
  allowPerScreenMaskOverride: boolean;
  maxMaskCoverageRatio: number;
}

export interface OrgPolicy {
  schemaVersion: number;
  defaults: PolicyDefaults;
  tagRules?: TagRules;
  enforcement: EnforcementConfig;
}

export interface ResolvedScreenConfig extends ScreenBaseline {
  resolvedViewport: ViewportConfig;
  resolvedThresholds: ScreenThresholds;
  resolvedDeterminism: DeterministicConfig;
  appliedTags: string[];
  looseningApplied: boolean;
  overrideJustification?: string;
  maskCoverageRatio?: number;
}
