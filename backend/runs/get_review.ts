import { api, APIError } from "encore.dev/api";
import db from "../db";

export interface ScreenResult {
  screenId: string;
  name: string;
  url: string;
  status: "PASS" | "WARN" | "FAIL";
  diffPixels: number;
  diffPixelRatio: number;
  originalityPercent: number;
  expectedPath?: string;
  actualPath?: string;
  diffPath?: string;
  changes: ScreenChange[];
}

export interface ScreenChange {
  id: number;
  changeType: string;
  selector?: string;
  description: string;
  confidence: number;
  metadata?: any;
}

export interface ReviewDetail {
  id: number;
  runId: string;
  branch: string;
  commit: string;
  pullRequest: number;
  status: "passed" | "failed" | "in_progress";
  reviewStatus: "pending" | "approved" | "rejected" | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  timestamp: Date;
  totalScreens: number;
  passedScreens: number;
  warnedScreens: number;
  failedScreens: number;
  screens: ScreenResult[];
}

export const getReview = api<{ id: number }, ReviewDetail>(
  { expose: true, method: "GET", path: "/runs/reviews/:id" },
  async ({ id }) => {
    const row = await db.queryRow<{
      id: number;
      commit: string;
      branch: string;
      pull_request: number;
      status: string;
      review_status: string | null;
      reviewed_by: string | null;
      reviewed_at: Date | null;
      review_notes: string | null;
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
        review_notes,
        timestamp,
        run_data
      FROM runs
      WHERE id = ${id}
    `;

    if (!row) {
      throw APIError.notFound("review not found");
    }

    const changes = await db.queryAll<{
      id: number;
      screen_id: string;
      change_type: string;
      selector: string | null;
      description: string;
      confidence: number;
      metadata: any;
    }>`
      SELECT
        id,
        screen_id,
        change_type,
        selector,
        description,
        confidence,
        metadata
      FROM screen_changes
      WHERE run_id = ${id}
      ORDER BY screen_id, confidence DESC
    `;

    const runData = row.run_data || {};
    const results = runData.results || [];

    const changesByScreen = new Map<string, ScreenChange[]>();
    for (const change of changes) {
      if (!changesByScreen.has(change.screen_id)) {
        changesByScreen.set(change.screen_id, []);
      }
      changesByScreen.get(change.screen_id)!.push({
        id: change.id,
        changeType: change.change_type,
        selector: change.selector || undefined,
        description: change.description,
        confidence: change.confidence,
        metadata: change.metadata,
      });
    }

    const screens: ScreenResult[] = results.map((result: any) => ({
      screenId: result.screenId,
      name: result.name,
      url: result.url,
      status: result.status,
      diffPixels: result.diffPixels || 0,
      diffPixelRatio: result.diffPixelRatio || 0,
      originalityPercent: result.originalityPercent || 100,
      expectedPath: result.expectedPath,
      actualPath: result.actualPath,
      diffPath: result.diffPath,
      changes: changesByScreen.get(result.screenId) || [],
    }));

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
      reviewNotes: row.review_notes,
      timestamp: row.timestamp,
      totalScreens: runData.total || 0,
      passedScreens: runData.passed || 0,
      warnedScreens: runData.warned || 0,
      failedScreens: runData.failed || 0,
      screens,
    };
  }
);
