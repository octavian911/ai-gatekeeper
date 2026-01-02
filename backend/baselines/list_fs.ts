import { api } from "encore.dev/api";
import {
  readManifest,
  readScreenConfig,
  readBaselineImage,
  getImageHash,
  getImageMtime,
} from "./filesystem";

export interface BaselineMetadata {
  screenId: string;
  name: string;
  url: string;
  hash: string;
  tags?: string[];
  hasImage: boolean;
  validated: boolean;
  size?: number;
  uploadedAt?: string;
  status: string;
  statusMessage?: string;
  viewportWidth: number;
  viewportHeight: number;
  masks?: Array<{ type: string; selector?: string; x?: number; y?: number; width?: number; height?: number }>;
  thresholds?: Record<string, number>;
}

export interface ListBaselinesResponse {
  baselines: BaselineMetadata[];
}

async function validateBaseline(
  screenId: string,
  manifestEntry: any,
  screenConfig: any,
  imageBuffer: Buffer | null
): Promise<{ status: string; statusMessage?: string; validated: boolean }> {
  if (!imageBuffer) {
    return {
      status: "missing",
      statusMessage: "Baseline image not found",
      validated: false,
    };
  }

  const tags = screenConfig?.tags || manifestEntry.tags || [];
  const masks = screenConfig?.masks || [];

  if (tags.includes("noisy") && masks.length === 0) {
    return {
      status: "invalid",
      statusMessage: "Baseline tagged as 'noisy' requires at least one mask",
      validated: false,
    };
  }

  return {
    status: "validated",
    validated: true,
  };
}

export const listFs = api<void, ListBaselinesResponse>(
  { expose: true, method: "GET", path: "/baselines/fs" },
  async () => {
    const manifest = await readManifest();
    const baselines: BaselineMetadata[] = [];

    for (const entry of manifest.baselines) {
      const screenConfig = await readScreenConfig(entry.screenId);
      const imageBuffer = await readBaselineImage(entry.screenId);
      const mtime = await getImageMtime(entry.screenId);

      const name = screenConfig?.name || entry.name || entry.screenId;
      const url = screenConfig?.url || entry.url || "";
      const tags = screenConfig?.tags || entry.tags || [];
      const viewport = screenConfig?.viewport || { width: 1280, height: 720 };
      const masks = screenConfig?.masks || [];
      const thresholds = screenConfig?.thresholds || {};

      let hash = "";
      let size: number | undefined;
      if (imageBuffer) {
        hash = await getImageHash(imageBuffer);
        size = imageBuffer.length;
      }

      const validation = await validateBaseline(entry.screenId, entry, screenConfig, imageBuffer);

      baselines.push({
        screenId: entry.screenId,
        name,
        url,
        hash,
        tags,
        hasImage: !!imageBuffer,
        validated: validation.validated,
        size,
        uploadedAt: mtime?.toISOString(),
        status: validation.status,
        statusMessage: validation.statusMessage,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        masks,
        thresholds,
      });
    }

    return { baselines };
  }
);
