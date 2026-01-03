import { api } from "encore.dev/api";
import db from "../db";

export interface ScreenChange {
  screenId: string;
  changeType: string;
  selector?: string;
  description: string;
  confidence: number;
  metadata?: any;
}

export interface SaveChangesRequest {
  runId: number;
  changes: ScreenChange[];
}

export interface SaveChangesResponse {
  saved: number;
}

export const saveChanges = api<SaveChangesRequest, SaveChangesResponse>(
  { expose: true, method: "POST", path: "/runs/:runId/changes" },
  async (req) => {
    let saved = 0;

    for (const change of req.changes) {
      await db.exec`
        INSERT INTO screen_changes (
          run_id,
          screen_id,
          change_type,
          selector,
          description,
          confidence,
          metadata
        ) VALUES (
          ${req.runId},
          ${change.screenId},
          ${change.changeType},
          ${change.selector || null},
          ${change.description},
          ${change.confidence},
          ${JSON.stringify(change.metadata || {})}
        )
      `;
      saved++;
    }

    return { saved };
  }
);
