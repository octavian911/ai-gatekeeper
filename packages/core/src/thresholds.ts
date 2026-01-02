import type { ScreenBaseline, ScreenThresholds, ThresholdBand, ViewportConfig } from './types.js';

export const DEFAULT_VIEWPORT: ViewportConfig = {
  width: 1280,
  height: 720,
  deviceScaleFactor: 1,
  browser: 'chromium',
};

export const GLOBAL_THRESHOLDS: ScreenThresholds = {
  warn: {
    diffPixelRatio: 0.0002,
    diffPixels: 250,
  },
  fail: {
    diffPixelRatio: 0.0005,
    diffPixels: 600,
  },
};

export const TAG_OVERRIDES: Record<string, ScreenThresholds> = {
  critical: {
    warn: {
      diffPixelRatio: 0.0001,
      diffPixels: 150,
    },
    fail: {
      diffPixelRatio: 0.0003,
      diffPixels: 400,
    },
  },
  noisy: {
    warn: {
      diffPixelRatio: 0.0003,
      diffPixels: 350,
    },
    fail: {
      diffPixelRatio: 0.0008,
      diffPixels: 900,
    },
    requireMasks: true,
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function scaleThresholdsToViewport(
  width: number,
  height: number,
  tag?: string
): Pick<ScreenThresholds, 'warn' | 'fail'> {
  const P = width * height;

  if (tag === 'critical') {
    return {
      warn: {
        diffPixelRatio: 0.0001,
        diffPixels: clamp(Math.round(P * 0.00016), 100, 450),
      },
      fail: {
        diffPixelRatio: 0.0003,
        diffPixels: clamp(Math.round(P * 0.00043), 200, 900),
      },
    };
  }

  if (tag === 'noisy') {
    return {
      warn: {
        diffPixelRatio: 0.0003,
        diffPixels: clamp(Math.round(P * 0.00038), 200, 900),
      },
      fail: {
        diffPixelRatio: 0.0008,
        diffPixels: clamp(Math.round(P * 0.00100), 450, 2000),
      },
    };
  }

  return {
    warn: {
      diffPixelRatio: 0.0002,
      diffPixels: clamp(Math.round(P * 0.00027), 150, 600),
    },
    fail: {
      diffPixelRatio: 0.0005,
      diffPixels: clamp(Math.round(P * 0.00065), 300, 1200),
    },
  };
}

export function resolveThresholds(screen: ScreenBaseline): ScreenThresholds {
  const viewport = {
    ...DEFAULT_VIEWPORT,
    ...screen.viewport,
  };

  const primaryTag = screen.tags?.[0];
  
  let baseThresholds: ScreenThresholds;
  
  if (primaryTag && TAG_OVERRIDES[primaryTag]) {
    const tagOverride = TAG_OVERRIDES[primaryTag];
    const scaled = scaleThresholdsToViewport(viewport.width, viewport.height, primaryTag);
    
    baseThresholds = {
      warn: {
        diffPixelRatio: tagOverride.warn.diffPixelRatio,
        diffPixels: scaled.warn.diffPixels,
      },
      fail: {
        diffPixelRatio: tagOverride.fail.diffPixelRatio,
        diffPixels: scaled.fail.diffPixels,
      },
      requireMasks: tagOverride.requireMasks,
    };
  } else {
    const scaled = scaleThresholdsToViewport(viewport.width, viewport.height);
    baseThresholds = {
      warn: {
        diffPixelRatio: GLOBAL_THRESHOLDS.warn.diffPixelRatio,
        diffPixels: scaled.warn.diffPixels,
      },
      fail: {
        diffPixelRatio: GLOBAL_THRESHOLDS.fail.diffPixelRatio,
        diffPixels: scaled.fail.diffPixels,
      },
    };
  }

  if (screen.thresholds) {
    return {
      warn: {
        diffPixelRatio: screen.thresholds.warn?.diffPixelRatio ?? baseThresholds.warn.diffPixelRatio,
        diffPixels: screen.thresholds.warn?.diffPixels ?? baseThresholds.warn.diffPixels,
      },
      fail: {
        diffPixelRatio: screen.thresholds.fail?.diffPixelRatio ?? baseThresholds.fail.diffPixelRatio,
        diffPixels: screen.thresholds.fail?.diffPixels ?? baseThresholds.fail.diffPixels,
      },
      requireMasks: screen.thresholds.requireMasks ?? baseThresholds.requireMasks,
    };
  }

  return baseThresholds;
}

export function computeOriginalityPercent(diffPixels: number, totalPixels: number): number {
  if (totalPixels === 0) return 0;
  return (1 - (diffPixels / totalPixels)) * 100;
}
