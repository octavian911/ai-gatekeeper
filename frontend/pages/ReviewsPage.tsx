import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import backend from "~backend/client";
import type { ReviewItem } from "~backend/runs/list_reviews";
import { CheckCircle2, XCircle, Clock, AlertCircle, GitBranch, GitCommit } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { useToast } from "../hooks/useToast";

export function ReviewsPage() {
  const { showToast, ToastContainer } = useToast();
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const navigate = useNavigate();

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const response = await backend.runs.listReviews();
      setReviews(response.reviews);
    } catch (error) {
      console.error("Failed to fetch reviews:", error);
      showToast("Failed to load reviews", "error");
    } finally {
      setLoading(false);
    }
  };

  const filteredReviews = reviews.filter((review) => {
    if (filter === "all") return true;
    if (filter === "pending") return review.reviewStatus === "pending" || review.reviewStatus === null;
    return review.reviewStatus === filter;
  });

  const stats = {
    total: reviews.length,
    pending: reviews.filter((r) => r.reviewStatus === "pending" || r.reviewStatus === null).length,
    approved: reviews.filter((r) => r.reviewStatus === "approved").length,
    rejected: reviews.filter((r) => r.reviewStatus === "rejected").length,
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "passed":
        return <CheckCircle2 className="size-4 text-green-500" />;
      case "failed":
        return <XCircle className="size-4 text-red-500" />;
      default:
        return <Clock className="size-4 text-yellow-500" />;
    }
  };

  const getReviewBadge = (reviewStatus: string | null) => {
    if (!reviewStatus || reviewStatus === "pending") {
      return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">Pending Review</Badge>;
    }
    if (reviewStatus === "approved") {
      return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Approved</Badge>;
    }
    return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">Rejected</Badge>;
  };

  return (
    <div className="p-8">
      <ToastContainer />
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary mb-2">QA Review Dashboard</h1>
        <p className="text-secondary">
          Review visual regression test results and approve or reject changes.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-card border-2 border-border-strong rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-secondary">Total Runs</span>
            <AlertCircle className="size-4 text-icon-muted" />
          </div>
          <p className="text-2xl font-bold text-primary">{stats.total}</p>
        </div>
        <div className="bg-card border-2 border-border-strong rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-primary">Pending</span>
            <Clock className="size-4 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.pending}</p>
        </div>
        <div className="bg-card border-2 border-border-strong rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-primary">Approved</span>
            <CheckCircle2 className="size-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.approved}</p>
        </div>
        <div className="bg-card border-2 border-border-strong rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-primary">Rejected</span>
            <XCircle className="size-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.rejected}</p>
        </div>
      </div>

      <div className="bg-card border-2 border-border-strong rounded-lg p-4 mb-6">
        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            variant={filter === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("pending")}
          >
            <Clock className="size-4" />
            Pending
          </Button>
          <Button
            variant={filter === "approved" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("approved")}
          >
            <CheckCircle2 className="size-4" />
            Approved
          </Button>
          <Button
            variant={filter === "rejected" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("rejected")}
          >
            <XCircle className="size-4" />
            Rejected
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Clock className="size-8 animate-spin mx-auto mb-4 text-icon-muted" />
          <p className="text-secondary">Loading reviews...</p>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="text-center py-16 bg-card border-2 border-border-strong rounded-lg">
          <AlertCircle className="size-16 mx-auto mb-4 text-icon-muted" />
          <h3 className="text-xl font-semibold text-primary mb-2">No reviews found</h3>
          <p className="text-secondary">
            {filter === "all"
              ? "No test runs have been submitted for review yet."
              : `No ${filter} reviews found.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReviews.map((review) => (
            <div
              key={review.id}
              className="bg-card border-2 border-border-strong rounded-lg p-6 hover:shadow-md transition-all cursor-pointer"
              onClick={() => navigate(`/reviews/${review.id}`)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getStatusIcon(review.status)}
                  <div>
                    <h3 className="text-lg font-semibold text-primary">
                      Run #{review.id} - {review.branch}
                    </h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-secondary">
                      <div className="flex items-center gap-1">
                        <GitBranch className="size-3" />
                        {review.branch}
                      </div>
                      <div className="flex items-center gap-1">
                        <GitCommit className="size-3" />
                        {review.commit.substring(0, 7)}
                      </div>
                      {review.pullRequest > 0 && (
                        <span>PR #{review.pullRequest}</span>
                      )}
                    </div>
                  </div>
                </div>
                {getReviewBadge(review.reviewStatus)}
              </div>

              <div className="mb-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-background rounded-lg p-3">
                    <p className="text-xs text-secondary mb-1">Total Screens</p>
                    <p className="text-xl font-bold text-primary">{review.totalScreens}</p>
                  </div>
                  <div className="bg-green-500/10 rounded-lg p-3">
                    <p className="text-xs text-green-600 mb-1">Passed</p>
                    <p className="text-xl font-bold text-green-600">{review.passedScreens}</p>
                  </div>
                  <div className="bg-yellow-500/10 rounded-lg p-3">
                    <p className="text-xs text-yellow-600 mb-1">Warnings</p>
                    <p className="text-xl font-bold text-yellow-600">{review.warnedScreens}</p>
                  </div>
                  <div className="bg-red-500/10 rounded-lg p-3">
                    <p className="text-xs text-red-600 mb-1">Screens Changed</p>
                    <p className="text-xl font-bold text-red-600">{review.failedScreens + review.warnedScreens}</p>
                  </div>
                </div>

                {review.worstScreenName && (
                  <div className="mt-3 bg-accent/50 border-2 border-border-strong rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge 
                          className={
                            review.worstScreenStatus === "failed" 
                              ? "bg-red-500/10 text-red-600 border-red-500/30"
                              : review.worstScreenStatus === "warned"
                              ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/30"
                              : "bg-green-500/10 text-green-600 border-green-500/30"
                          }
                        >
                          Biggest Change
                        </Badge>
                        <span className="text-sm font-semibold text-primary">
                          {review.worstScreenName}
                        </span>
                      </div>
                      {review.worstScreenOriginality !== undefined && (
                        <span className="text-sm font-semibold text-secondary">
                          {review.worstScreenOriginality.toFixed(1)}% similarity{" "}
                          {review.worstScreenStatus === "failed" 
                            ? "(major change)"
                            : review.worstScreenStatus === "warned"
                            ? "(minor change)"
                            : ""}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-sm text-secondary">
                <span>{new Date(review.timestamp).toLocaleString()}</span>
                {review.reviewedBy && (
                  <span>Reviewed by {review.reviewedBy} on {new Date(review.reviewedAt!).toLocaleString()}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
