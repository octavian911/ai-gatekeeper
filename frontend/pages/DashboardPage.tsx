import { useEffect, useState } from "react";
import backend from "~backend/client";
import type { Run } from "~backend/runs/list";
import { CheckCircle2, XCircle, Loader2, ArrowRight, GitPullRequest, GitCommit, GitBranch, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRuns();
  }, []);

  const loadRuns = async () => {
    try {
      const response = await backend.runs.list();
      setRuns(response.runs);
    } catch (error) {
      console.error("Failed to load runs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: Run["status"]) => {
    switch (status) {
      case "passed":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "in_progress":
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    }
  };

  const getStatusBadge = (status: Run["status"]) => {
    const styles = {
      passed: "bg-green-500/10 text-green-500 border-green-500/20",
      failed: "bg-red-500/10 text-red-500 border-red-500/20",
      in_progress: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    };

    const labels = {
      passed: "Passed",
      failed: "Failed",
      in_progress: "In Progress",
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium border ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const formatTimestamp = (timestamp: Date) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 365) {
      return `over ${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) > 1 ? "s" : ""} ago`;
    } else if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    } else if (diffMins > 0) {
      return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    } else {
      return "just now";
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of recent visual regression test runs.
        </p>
      </div>

      <div className="bg-card rounded-lg border border-border">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground mb-1">
            Recent Runs
          </h2>
          <p className="text-sm text-muted-foreground">
            A list of the most recent CI runs for visual fidelity.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Pull Request
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Commit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Branch
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              ) : runs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    No runs found
                  </td>
                </tr>
              ) : (
                runs.map((run) => (
                  <tr
                    key={run.id}
                    className="border-b border-border hover:bg-accent/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(run.status)}
                        {getStatusBadge(run.status)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-foreground">
                        <GitPullRequest className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">#{run.pullRequest}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <GitCommit className="w-4 h-4" />
                        <code className="text-sm">{run.commit}</code>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-foreground">
                        <GitBranch className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{run.branch}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm">{formatTimestamp(run.timestamp)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Button variant="ghost" size="sm" className="gap-2">
                        View
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
