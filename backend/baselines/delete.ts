import { api, APIError } from "encore.dev/api";
import { baselineImages } from "./storage";
import db from "../db";

export interface DeleteBaselineRequest {
  screenId: string;
}

export interface DeleteBaselineResponse {
  success: boolean;
  message: string;
}

export const deleteBaseline = api<DeleteBaselineRequest, DeleteBaselineResponse>(
  { expose: true, method: "DELETE", path: "/baselines/:screenId" },
  async (req) => {
    const baseline = await db.queryRow<{ hash: string | null }>`
      SELECT hash FROM baselines WHERE id = ${req.screenId}
    `;

    if (!baseline) {
      throw APIError.notFound("Baseline not found");
    }

    if (baseline.hash) {
      try {
        const objectName = `${req.screenId}/${baseline.hash}.png`;
        await baselineImages.remove(objectName);
      } catch (error) {
        console.warn(`Failed to delete object for ${req.screenId}:`, error);
      }
    }

    await db.exec`
      DELETE FROM baselines WHERE id = ${req.screenId}
    `;

    return {
      success: true,
      message: "Baseline deleted successfully",
    };
  }
);
