import { api } from "encore.dev/api";
import db from "../db";

export interface CreateReviewRequest {
  runId: string;
  totalScreens: number;
  passedScreens: number;
  warnedScreens: number;
  failedScreens: number;
  branch?: string;
  commit?: string;
  pullRequest?: number;
  runData: any;
}

export interface CreateReviewResponse {
  id: number;
  runId: string;
}

export const createReview = api<CreateReviewRequest, CreateReviewResponse>(
  { expose: true, method: "POST", path: "/runs/reviews" },
  async (req) => {
    const status = req.failedScreens > 0 ? "failed" : "passed";
    
    const result = await db.queryRow<{ id: number }>`
      INSERT INTO runs (
        pull_request,
        commit,
        branch,
        status,
        run_data,
        review_status
      ) VALUES (
        ${req.pullRequest || 0},
        ${req.commit || "unknown"},
        ${req.branch || "unknown"},
        ${status},
        ${JSON.stringify(req.runData)},
        'pending'
      )
      RETURNING id
    `;

    return {
      id: result!.id,
      runId: req.runId,
    };
  }
);
