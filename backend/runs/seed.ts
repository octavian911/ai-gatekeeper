import { api } from "encore.dev/api";
import db from "../db";

export const seed = api<void, { success: boolean }>(
  { expose: true, method: "POST", path: "/runs/seed" },
  async () => {
    await db.exec`
      INSERT INTO runs (pull_request, commit, branch, status, timestamp)
      VALUES
        (123, 'a1b2c3d', 'feat/new-login-flow', 'failed', NOW() - INTERVAL '1 hour'),
        (122, 'e4f5g6h', 'fix/dashboard-alignment', 'passed', NOW() - INTERVAL '2 hours'),
        (121, 'i7j8k9l', 'main', 'in_progress', NOW() - INTERVAL '3 hours')
    `;

    return { success: true };
  }
);
