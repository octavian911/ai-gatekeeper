import { api } from "encore.dev/api";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface GitStatusResponse {
  hasChanges: boolean;
  baselinesChanged: boolean;
  changedFiles: string[];
}

export const gitStatus = api<void, GitStatusResponse>(
  { expose: true, method: "GET", path: "/baselines/git-status" },
  async () => {
    try {
      const { stdout } = await execAsync("git status --porcelain", { cwd: "/" });
      const lines = stdout.trim().split("\n").filter((line) => line.length > 0);

      const changedFiles = lines.map((line) => line.substring(3));
      const baselinesChanged = changedFiles.some(
        (file) => file.startsWith("baselines/") || file.startsWith(".gate/")
      );

      return {
        hasChanges: lines.length > 0,
        baselinesChanged,
        changedFiles: changedFiles.filter(
          (file) => file.startsWith("baselines/") || file.startsWith(".gate/")
        ),
      };
    } catch (error) {
      return {
        hasChanges: false,
        baselinesChanged: false,
        changedFiles: [],
      };
    }
  }
);
