import { api } from "encore.dev/api";
import {
  readManifest,
  writeManifest,
  deleteBaseline,
} from "./filesystem";

export interface DeleteBaselineRequest {
  screenId: string;
}

export interface DeleteBaselineResponse {
  success: boolean;
  message: string;
}

export const deleteBaselineFs = api<DeleteBaselineRequest, DeleteBaselineResponse>(
  { expose: true, method: "DELETE", path: "/baselines/:screenId/fs" },
  async (req) => {
    const manifest = await readManifest();
    const index = manifest.baselines.findIndex((b) => b.screenId === req.screenId);

    if (index === -1) {
      return {
        success: false,
        message: "Baseline not found in manifest",
      };
    }

    manifest.baselines.splice(index, 1);
    await writeManifest(manifest);

    await deleteBaseline(req.screenId);

    return {
      success: true,
      message: "Baseline deleted successfully",
    };
  }
);
