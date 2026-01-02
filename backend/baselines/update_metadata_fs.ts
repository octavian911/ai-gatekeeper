import { api } from "encore.dev/api";
import {
  readManifest,
  writeManifest,
  readScreenConfig,
  writeScreenConfig,
} from "./filesystem";

export interface UpdateMetadataRequest {
  screenId: string;
  name?: string;
  route?: string;
  tags?: string[];
  viewportWidth?: number;
  viewportHeight?: number;
  masks?: Array<{ type: string; selector?: string; x?: number; y?: number; width?: number; height?: number }>;
  thresholds?: Record<string, any>;
}

export interface UpdateMetadataResponse {
  success: boolean;
  message: string;
}

export const updateMetadataFs = api<UpdateMetadataRequest, UpdateMetadataResponse>(
  { expose: true, method: "POST", path: "/baselines/:screenId/metadata-fs" },
  async (req) => {
    const manifest = await readManifest();
    const manifestEntry = manifest.baselines.find((b) => b.screenId === req.screenId);

    if (!manifestEntry) {
      return {
        success: false,
        message: "Baseline not found in manifest",
      };
    }

    if (req.name !== undefined) {
      manifestEntry.name = req.name;
    }

    if (req.route !== undefined) {
      manifestEntry.url = req.route;
    }

    if (req.tags !== undefined) {
      manifestEntry.tags = req.tags;
    }

    await writeManifest(manifest);

    const existingConfig = await readScreenConfig(req.screenId) || {};

    const updatedConfig: any = {
      ...existingConfig,
    };

    if (req.name !== undefined) {
      updatedConfig.name = req.name;
    }

    if (req.route !== undefined) {
      updatedConfig.url = req.route;
    }

    if (req.tags !== undefined) {
      updatedConfig.tags = req.tags;
    }

    if (req.viewportWidth !== undefined || req.viewportHeight !== undefined) {
      updatedConfig.viewport = {
        width: req.viewportWidth ?? existingConfig.viewport?.width ?? 1280,
        height: req.viewportHeight ?? existingConfig.viewport?.height ?? 720,
      };
    }

    if (req.masks !== undefined) {
      updatedConfig.masks = req.masks;
    }

    if (req.thresholds !== undefined) {
      updatedConfig.thresholds = req.thresholds;
    }

    await writeScreenConfig(req.screenId, updatedConfig);

    return {
      success: true,
      message: "Metadata updated successfully",
    };
  }
);
