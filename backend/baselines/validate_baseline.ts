import { api, APIError } from "encore.dev/api";
import db from "../db";

export interface ValidateBaselineRequest {
  screenId: string;
}

export interface ValidateBaselineResponse {
  valid: boolean;
  status: string;
  message: string;
}

export const validateBaseline = api<ValidateBaselineRequest, ValidateBaselineResponse>(
  { expose: true, method: "POST", path: "/baselines/:screenId/validate" },
  async (req) => {
    const baseline = await db.queryRow<{
      id: string;
      has_image: boolean;
      hash: string | null;
      tags: string[];
      masks: any;
      viewport_width: number;
      viewport_height: number;
    }>`
      SELECT id, has_image, hash, tags, masks, viewport_width, viewport_height
      FROM baselines
      WHERE id = ${req.screenId}
    `;

    if (!baseline) {
      throw APIError.notFound("Baseline not found");
    }
    let status = "validated";
    let message = "Baseline is valid";

    if (!baseline.has_image || !baseline.hash) {
      status = "missing";
      message = "Baseline image is missing";
    } else if (baseline.hash.includes("placeholder")) {
      status = "invalid";
      message = "Hash is a placeholder value";
    } else if (baseline.tags.includes("noisy") && (!baseline.masks || baseline.masks.length === 0)) {
      status = "invalid";
      message = "Baseline tagged as 'noisy' requires at least one mask";
    }

    await db.exec`
      UPDATE baselines
      SET status = ${status}, status_message = ${message}, updated_at = NOW()
      WHERE id = ${req.screenId}
    `;

    return {
      valid: status === "validated",
      status,
      message,
    };
  }
);
