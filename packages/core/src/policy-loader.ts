import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import type {
  OrgPolicy,
  PolicyDefaults,
  EnforcementConfig,
  DeterministicConfig,
  ScreenBaseline,
  ResolvedScreenConfig,
  ViewportConfig,
  ScreenThresholds,
  ThresholdBand,
  Mask,
} from './types.js';
import { DEFAULT_VIEWPORT, GLOBAL_THRESHOLDS, TAG_OVERRIDES } from './thresholds.js';
import { DETERMINISTIC_DEFAULTS } from './deterministic.js';

export const CORE_DEFAULTS: PolicyDefaults = {
  viewport: { width: 1280, height: 720 },
  determinism: {
    browser: 'chromium',
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'light',
    reduceMotion: 'reduce',
    disableAnimations: true,
    blockExternalNetwork: true,
    waitUntil: 'networkidle',
    layoutStabilityMs: 300,
    screenshotAfterSettledOnly: true,
  },
  thresholds: {
    standard: {
      warn: { diffPixelRatio: 0.0002, diffPixels: 250 },
      fail: { diffPixelRatio: 0.0005, diffPixels: 600 },
    },
    critical: {
      warn: { diffPixelRatio: 0.0001, diffPixels: 150 },
      fail: { diffPixelRatio: 0.0003, diffPixels: 400 },
    },
    noisy: {
      warn: { diffPixelRatio: 0.0003, diffPixels: 350 },
      fail: { diffPixelRatio: 0.0008, diffPixels: 900 },
      requireMasks: true,
    },
  },
};

export const DEFAULT_ENFORCEMENT: EnforcementConfig = {
  allowLoosening: false,
  allowPerScreenViewportOverride: true,
  allowPerScreenMaskOverride: true,
  maxMaskCoverageRatio: 0.35,
};

export async function loadOrgPolicy(basePath: string = process.cwd()): Promise<OrgPolicy | null> {
  const policyPath = path.join(basePath, '.gate', 'policy.json');
  
  try {
    const data = await fs.readFile(policyPath, 'utf-8');
    const policy = JSON.parse(data) as OrgPolicy;
    
    if (!policy.schemaVersion || policy.schemaVersion !== 1) {
      throw new Error('Invalid or unsupported policy schema version');
    }
    
    return policy;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export function mergeDefaults(orgPolicy: OrgPolicy | null): PolicyDefaults {
  if (!orgPolicy) {
    return CORE_DEFAULTS;
  }
  
  return {
    viewport: { ...CORE_DEFAULTS.viewport, ...orgPolicy.defaults.viewport },
    determinism: { ...CORE_DEFAULTS.determinism, ...orgPolicy.defaults.determinism },
    thresholds: {
      standard: {
        warn: { ...CORE_DEFAULTS.thresholds.standard.warn, ...orgPolicy.defaults.thresholds.standard?.warn },
        fail: { ...CORE_DEFAULTS.thresholds.standard.fail, ...orgPolicy.defaults.thresholds.standard?.fail },
        requireMasks: orgPolicy.defaults.thresholds.standard?.requireMasks,
      },
      critical: {
        warn: { ...CORE_DEFAULTS.thresholds.critical.warn, ...orgPolicy.defaults.thresholds.critical?.warn },
        fail: { ...CORE_DEFAULTS.thresholds.critical.fail, ...orgPolicy.defaults.thresholds.critical?.fail },
        requireMasks: orgPolicy.defaults.thresholds.critical?.requireMasks,
      },
      noisy: {
        warn: { ...CORE_DEFAULTS.thresholds.noisy.warn, ...orgPolicy.defaults.thresholds.noisy?.warn },
        fail: { ...CORE_DEFAULTS.thresholds.noisy.fail, ...orgPolicy.defaults.thresholds.noisy?.fail },
        requireMasks: orgPolicy.defaults.thresholds.noisy?.requireMasks ?? true,
      },
    },
  };
}

export function mergeEnforcement(orgPolicy: OrgPolicy | null): EnforcementConfig {
  if (!orgPolicy) {
    return DEFAULT_ENFORCEMENT;
  }
  
  return { ...DEFAULT_ENFORCEMENT, ...orgPolicy.enforcement };
}

export function applyTagRules(screen: ScreenBaseline, orgPolicy: OrgPolicy | null): string[] {
  if (screen.tags && screen.tags.length > 0) {
    return screen.tags;
  }
  
  if (!orgPolicy?.tagRules) {
    return [];
  }
  
  const appliedTags: string[] = [];
  
  if (orgPolicy.tagRules.criticalRoutes) {
    for (const route of orgPolicy.tagRules.criticalRoutes) {
      if (screen.url.includes(route)) {
        appliedTags.push('critical');
        break;
      }
    }
  }
  
  if (orgPolicy.tagRules.noisyRoutes && appliedTags.length === 0) {
    for (const route of orgPolicy.tagRules.noisyRoutes) {
      if (screen.url.includes(route)) {
        appliedTags.push('noisy');
        break;
      }
    }
  }
  
  return appliedTags;
}

export function getTagThresholds(
  tag: string | undefined,
  defaults: PolicyDefaults
): ScreenThresholds {
  if (!tag) {
    return defaults.thresholds.standard;
  }
  
  if (tag === 'critical') {
    return defaults.thresholds.critical;
  }
  
  if (tag === 'noisy') {
    return defaults.thresholds.noisy;
  }
  
  return defaults.thresholds.standard;
}

export function isThresholdLoosening(
  perScreen: Partial<ScreenThresholds> | undefined,
  base: ScreenThresholds
): boolean {
  if (!perScreen) {
    return false;
  }
  
  if (perScreen.warn) {
    if (
      (perScreen.warn.diffPixelRatio !== undefined && perScreen.warn.diffPixelRatio > base.warn.diffPixelRatio) ||
      (perScreen.warn.diffPixels !== undefined && perScreen.warn.diffPixels > base.warn.diffPixels)
    ) {
      return true;
    }
  }
  
  if (perScreen.fail) {
    if (
      (perScreen.fail.diffPixelRatio !== undefined && perScreen.fail.diffPixelRatio > base.fail.diffPixelRatio) ||
      (perScreen.fail.diffPixels !== undefined && perScreen.fail.diffPixels > base.fail.diffPixels)
    ) {
      return true;
    }
  }
  
  if (perScreen.requireMasks === false && base.requireMasks === true) {
    return true;
  }
  
  return false;
}

export function validateThresholdOverride(
  screen: ScreenBaseline,
  baseThresholds: ScreenThresholds,
  enforcement: EnforcementConfig
): { allowed: boolean; reason?: string } {
  if (!screen.thresholds) {
    return { allowed: true };
  }
  
  const hasLoosening = isThresholdLoosening(screen.thresholds, baseThresholds);
  
  if (!hasLoosening) {
    return { allowed: true };
  }
  
  if (!enforcement.allowLoosening) {
    return {
      allowed: false,
      reason: 'Policy enforcement does not allow loosening thresholds',
    };
  }
  
  if (!(screen as any).overrideJustification) {
    return {
      allowed: false,
      reason: 'Loosening thresholds requires overrideJustification field',
    };
  }
  
  return { allowed: true };
}

export function validateDeterminismOverride(
  perScreenDeterminism: Partial<DeterministicConfig> | undefined,
  enforcement: EnforcementConfig,
  hasJustification: boolean
): { allowed: boolean; reason?: string } {
  if (!perScreenDeterminism) {
    return { allowed: true };
  }
  
  const essentialFields = ['disableAnimations', 'blockExternalNetwork'];
  
  for (const field of essentialFields) {
    if (
      perScreenDeterminism[field as keyof DeterministicConfig] === false &&
      !enforcement.allowLoosening
    ) {
      return {
        allowed: false,
        reason: `Cannot disable ${field} without enforcement.allowLoosening=true`,
      };
    }
    
    if (
      perScreenDeterminism[field as keyof DeterministicConfig] === false &&
      enforcement.allowLoosening &&
      !hasJustification
    ) {
      return {
        allowed: false,
        reason: `Disabling ${field} requires overrideJustification`,
      };
    }
  }
  
  return { allowed: true };
}

export function computeMaskCoverageRatio(masks: Mask[], viewport: ViewportConfig): number {
  if (!masks || masks.length === 0) {
    return 0;
  }
  
  const viewportArea = viewport.width * viewport.height;
  let totalMaskArea = 0;
  
  for (const mask of masks) {
    if (mask.type === 'rect' && mask.width && mask.height) {
      totalMaskArea += mask.width * mask.height;
    }
  }
  
  return totalMaskArea / viewportArea;
}

export function resolveScreen(
  screen: ScreenBaseline,
  orgPolicy: OrgPolicy | null
): ResolvedScreenConfig {
  const defaults = mergeDefaults(orgPolicy);
  const enforcement = mergeEnforcement(orgPolicy);
  
  const appliedTags = applyTagRules(screen, orgPolicy);
  const primaryTag = appliedTags[0];
  
  const baseThresholds = getTagThresholds(primaryTag, defaults);
  
  const thresholdValidation = validateThresholdOverride(screen, baseThresholds, enforcement);
  if (!thresholdValidation.allowed) {
    throw new Error(
      `Screen "${screen.name}" threshold override rejected: ${thresholdValidation.reason}`
    );
  }
  
  const resolvedThresholds: ScreenThresholds = {
    warn: {
      diffPixelRatio: screen.thresholds?.warn?.diffPixelRatio ?? baseThresholds.warn.diffPixelRatio,
      diffPixels: screen.thresholds?.warn?.diffPixels ?? baseThresholds.warn.diffPixels,
    },
    fail: {
      diffPixelRatio: screen.thresholds?.fail?.diffPixelRatio ?? baseThresholds.fail.diffPixelRatio,
      diffPixels: screen.thresholds?.fail?.diffPixels ?? baseThresholds.fail.diffPixels,
    },
    requireMasks: screen.thresholds?.requireMasks ?? baseThresholds.requireMasks,
  };
  
  const resolvedViewport: ViewportConfig = {
    width: screen.viewport?.width ?? defaults.viewport.width,
    height: screen.viewport?.height ?? defaults.viewport.height,
    deviceScaleFactor: screen.viewport?.deviceScaleFactor ?? defaults.determinism.deviceScaleFactor,
    browser: screen.viewport?.browser ?? defaults.determinism.browser,
  };
  
  const perScreenDeterminism = (screen as any).determinism;
  const determinismValidation = validateDeterminismOverride(
    perScreenDeterminism,
    enforcement,
    !!(screen as any).overrideJustification
  );
  
  if (!determinismValidation.allowed) {
    throw new Error(
      `Screen "${screen.name}" determinism override rejected: ${determinismValidation.reason}`
    );
  }
  
  const resolvedDeterminism: DeterministicConfig = {
    ...defaults.determinism,
    ...perScreenDeterminism,
  };
  
  const looseningApplied = isThresholdLoosening(screen.thresholds, baseThresholds);
  
  const maskCoverageRatio = computeMaskCoverageRatio(screen.masks || [], resolvedViewport);
  
  if (maskCoverageRatio > enforcement.maxMaskCoverageRatio) {
    throw new Error(
      `Screen "${screen.name}" mask coverage (${(maskCoverageRatio * 100).toFixed(1)}%) exceeds policy limit (${(enforcement.maxMaskCoverageRatio * 100).toFixed(1)}%)`
    );
  }
  
  return {
    ...screen,
    resolvedViewport,
    resolvedThresholds,
    resolvedDeterminism,
    appliedTags,
    looseningApplied,
    overrideJustification: (screen as any).overrideJustification,
    maskCoverageRatio,
  };
}

export function computePolicyHash(policy: OrgPolicy | null): string {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(policy || {}));
  return hash.digest('hex').substring(0, 16);
}

export async function validatePolicy(basePath: string = process.cwd()): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
  policy: OrgPolicy | null;
}> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  let policy: OrgPolicy | null;
  
  try {
    policy = await loadOrgPolicy(basePath);
  } catch (error) {
    errors.push(`Failed to load policy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { valid: false, errors, warnings, policy: null };
  }
  
  if (!policy) {
    warnings.push('No .gate/policy.json found, using core defaults');
    return { valid: true, errors, warnings, policy: null };
  }
  
  if (policy.schemaVersion !== 1) {
    errors.push(`Unsupported schema version: ${policy.schemaVersion}`);
  }
  
  if (policy.enforcement.maxMaskCoverageRatio < 0 || policy.enforcement.maxMaskCoverageRatio > 1) {
    errors.push('enforcement.maxMaskCoverageRatio must be between 0 and 1');
  }
  
  if (policy.tagRules?.criticalRoutes && policy.tagRules?.noisyRoutes) {
    const overlap = policy.tagRules.criticalRoutes.filter((r) =>
      policy.tagRules!.noisyRoutes!.includes(r)
    );
    if (overlap.length > 0) {
      warnings.push(`Tag rules overlap for routes: ${overlap.join(', ')}`);
    }
  }
  
  return { valid: errors.length === 0, errors, warnings, policy };
}
