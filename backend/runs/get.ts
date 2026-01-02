import { api, APIError } from "encore.dev/api";
import db from "../db";

export interface Run {
  id: number;
  pullRequest: number;
  commit: string;
  branch: string;
  status: "passed" | "failed" | "in_progress";
  timestamp: Date;
}

export const get = api<{ id: number }, Run>(
  { expose: true, method: "GET", path: "/runs/:id" },
  async ({ id }) => {
    const row = await db.queryRow<{
      id: number;
      pull_request: number;
      commit: string;
      branch: string;
      status: string;
      timestamp: Date;
    }>`
      SELECT id, pull_request, commit, branch, status, timestamp
      FROM runs
      WHERE id = ${id}
    `;

    if (!row) {
      throw APIError.notFound("run not found");
    }

    return {
      id: row.id,
      pullRequest: row.pull_request,
      commit: row.commit,
      branch: row.branch,
      status: row.status as "passed" | "failed" | "in_progress",
      timestamp: row.timestamp,
    };
  }
);
