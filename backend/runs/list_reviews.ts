import { api } from "encore.dev/api";
import db from "../db";

export interface ReviewItem {
  id: number;
  runId: string;
  branch: string;
  commit: string;
  pullRequest: number;
  status: "passed" | "failed" | "in_progress";
  reviewStatus: "pending" | "approved" | "rejected" | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  timestamp: Date;
  totalScreens: number;
  passedScreens: number;
  warnedScreens: number;
  failedScreens: number;
  worstScreenName?: string;
  worstScreenOriginality?: number;
  worstScreenStatus?: string;
}

export interface ListReviewsResponse {
  reviews: ReviewItem[];
}

export const listReviews = api<void, ListReviewsResponse>(
  { expose: true, method: "GET", path: "/runs/reviews" },
  async () => {
    const rows = await db.queryAll<{
      id: number;
      commit: string;
      branch: string;
      pull_request: number;
      status: string;
      review_status: string | null;
      reviewed_by: string | null;
      reviewed_at: Date | null;
      timestamp: Date;
      run_data: any;
    }>`
      SELECT
        id,
        commit,
        branch,
        pull_request,
        status,
        review_status,
        reviewed_by,
        reviewed_at,
        timestamp,
        run_data
      FROM runs
      WHERE run_data IS NOT NULL
      ORDER BY timestamp DESC
      LIMIT 100
    `;

    const reviews: ReviewItem[] = rows.map((row) => {
      const runData = row.run_data || {};
      
      let worstScreenName: string | undefined;
      let worstScreenOriginality: number | undefined;
      let worstScreenStatus: string | undefined;

      if (runData.screens) {
        const screens = Object.entries(runData.screens);
        if (screens.length > 0) {
          const failedScreens = screens.filter(([_, s]: [string, any]) => s.status === "failed");
          const warnedScreens = screens.filter(([_, s]: [string, any]) => s.status === "warned");
          
          const worstList = failedScreens.length > 0 ? failedScreens : warnedScreens.length > 0 ? warnedScreens : screens;
          
          if (worstList.length > 0) {
            const [screenId, screenData] = worstList.sort(([_, a]: [string, any], [__, b]: [string, any]) => 
              (a.originality || 100) - (b.originality || 100)
            )[0] as [string, any];
            
            worstScreenName = screenId.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());
            worstScreenOriginality = screenData.originality;
            worstScreenStatus = screenData.status;
          }
        }
      }
      
      return {
        id: row.id,
        runId: `run-${row.id}`,
        branch: row.branch,
        commit: row.commit,
        pullRequest: row.pull_request,
        status: row.status as "passed" | "failed" | "in_progress",
        reviewStatus: row.review_status as "pending" | "approved" | "rejected" | null,
        reviewedBy: row.reviewed_by,
        reviewedAt: row.reviewed_at,
        timestamp: row.timestamp,
        totalScreens: runData.total || 0,
        passedScreens: runData.passed || 0,
        warnedScreens: runData.warned || 0,
        failedScreens: runData.failed || 0,
        worstScreenName,
        worstScreenOriginality,
        worstScreenStatus,
      };
    });

    return { reviews };
  }
);
