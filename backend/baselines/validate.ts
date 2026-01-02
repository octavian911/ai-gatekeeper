import { api, APIError } from "encore.dev/api";
import db from "../db";

export interface ValidateBaselineRequest {
  screenId: string;
}

export interface ValidateBaselineResponse {
  valid: boolean;
  expectedHash: string;
  actualHash?: string;
  message: string;
  hasImage: boolean;
}

export const validate = api<ValidateBaselineRequest, ValidateBaselineResponse>(
  { expose: true, method: "POST", path: "/baselines/validate" },
  async (req) => {
    const baseline = await db.queryRow<{
      id: string;
      has_image: boolean;
      hash: string | null;
      tags: string[];
      masks: any;
    }>`
      SELECT id, has_image, hash, tags, masks
      FROM baselines
      WHERE id = ${req.screenId}
    `;

    if (!baseline) {
      return {
        valid: false,
        expectedHash: "",
        message: "Baseline not found",
        hasImage: false,
      };
    }

    if (!baseline.has_image || !baseline.hash) {
      return {
        valid: false,
        expectedHash: baseline.hash || "",
        message: "Baseline image is missing",
        hasImage: false,
      };
    }

    const isPlaceholder = baseline.hash.includes("placeholder");

    if (isPlaceholder) {
      return {
        valid: false,
        expectedHash: baseline.hash,
        actualHash: baseline.hash,
        message: "Hash is a placeholder value",
        hasImage: true,
      };
    }

    if (baseline.tags.includes("noisy") && (!baseline.masks || baseline.masks.length === 0)) {
      return {
        valid: false,
        expectedHash: baseline.hash,
        actualHash: baseline.hash,
        message: "Baseline tagged as 'noisy' requires at least one mask",
        hasImage: true,
      };
    }

    return {
      valid: true,
      expectedHash: baseline.hash,
      actualHash: baseline.hash,
      message: "Baseline is valid",
      hasImage: true,
    };
  }
);
