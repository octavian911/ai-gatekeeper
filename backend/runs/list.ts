import { api } from "encore.dev/api";
import db from "../db";

export interface Run {
  id: number;
  pullRequest: number;
  commit: string;
  branch: string;
  status: "passed" | "failed" | "in_progress";
  timestamp: Date;
}

export interface ListRunsResponse {
  runs: Run[];
}

export const list = api<void, ListRunsResponse>(
  { expose: true, method: "GET", path: "/runs" },
  async () => {
    const rows = await db.queryAll<{
      id: number;
      pull_request: number;
      commit: string;
      branch: string;
      status: string;
      timestamp: Date;
    }>`
      SELECT id, pull_request, commit, branch, status, timestamp
      FROM runs
      ORDER BY timestamp DESC
      LIMIT 50
    `;

    const runs: Run[] = rows.map((row) => ({
      id: row.id,
      pullRequest: row.pull_request,
      commit: row.commit,
      branch: row.branch,
      status: row.status as "passed" | "failed" | "in_progress",
      timestamp: row.timestamp,
    }));

    return { runs };
  }
);
