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
    let totalScreens = req.totalScreens || 0;
    let passedScreens = req.passedScreens || 0;
    let warnedScreens = req.warnedScreens || 0;
    let failedScreens = req.failedScreens || 0;

    if (req.runData?.screens) {
      const screens = Object.values(req.runData.screens);
      totalScreens = screens.length;
      passedScreens = screens.filter((s: any) => s.status === "passed").length;
      warnedScreens = screens.filter((s: any) => s.status === "warned").length;
      failedScreens = screens.filter((s: any) => s.status === "failed").length;
    }

    const enrichedRunData = {
      ...req.runData,
      total: totalScreens,
      passed: passedScreens,
      warned: warnedScreens,
      failed: failedScreens,
    };

    const status = failedScreens > 0 ? "failed" : "passed";
    
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
        ${enrichedRunData},
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
