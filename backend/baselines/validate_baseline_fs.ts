import { api } from "encore.dev/api";
import {
  readManifest,
  readScreenConfig,
  readBaselineImage,
  getImageHash,
} from "./filesystem";

export interface ValidateBaselineRequest {
  screenId: string;
}

export interface ValidateBaselineResponse {
  message: string;
  status: string;
  hash?: string;
}

export const validateBaselineFs = api<ValidateBaselineRequest, ValidateBaselineResponse>(
  { expose: true, method: "POST", path: "/baselines/:screenId/validate-fs" },
  async (req) => {
    const manifest = await readManifest();
    const manifestEntry = manifest.baselines.find((b) => b.screenId === req.screenId);

    if (!manifestEntry) {
      return {
        message: "Baseline not found in manifest",
        status: "missing",
      };
    }

    const imageBuffer = await readBaselineImage(req.screenId);

    if (!imageBuffer) {
      return {
        message: "Baseline image file is missing",
        status: "missing",
      };
    }

    const hash = await getImageHash(imageBuffer);
    const screenConfig = await readScreenConfig(req.screenId);
    const tags = screenConfig?.tags || manifestEntry.tags || [];
    const masks = screenConfig?.masks || [];

    if (tags.includes("noisy") && masks.length === 0) {
      return {
        message: "Baseline tagged as 'noisy' requires at least one mask",
        status: "invalid",
        hash,
      };
    }

    return {
      message: "Baseline is valid",
      status: "validated",
      hash,
    };
  }
);
