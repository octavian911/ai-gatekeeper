import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import backend from "~backend/client";
import type { ReviewDetail, ScreenResult } from "~backend/runs/get_review";
import { CheckCircle2, XCircle, AlertTriangle, ArrowLeft, Eye, FileText, ThumbsUp, ThumbsDown, Layers } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { useToast } from "../hooks/useToast";
import { FlakeVisualization } from "../components/FlakeVisualization";
import { ConfirmationDialog } from "../components/ConfirmationDialog";
import { ScreenDiffCard } from "../components/ScreenDiffCard";

export function ReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { showToast, ToastContainer } = useToast();
  const navigate = useNavigate();
  const [review, setReview] = useState<ReviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedScreen, setSelectedScreen] = useState<ScreenResult | null>(null);
  const [reviewerName, setReviewerName] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showFlakeView, setShowFlakeView] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | null>(null);

  useEffect(() => {
    if (id) {
      fetchReview(parseInt(id));
    }
  }, [id]);

  const fetchReview = async (reviewId: number) => {
    setLoading(true);
    try {
      const response = await backend.runs.getReview({ id: reviewId });
      setReview(response);
      setReviewNotes(response.reviewNotes || "");
    } catch (error) {
      console.error("Failed to fetch review:", error);
      showToast("Failed to load review", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!reviewerName.trim()) {
      showToast("Please enter your name", "warning");
      return;
    }
    setConfirmAction("approve");
  };

  const confirmApprove = async () => {
    setSubmitting(true);
    try {
      await backend.runs.updateReview({
        id: parseInt(id!),
        reviewStatus: "approved",
        reviewedBy: reviewerName,
        reviewNotes: reviewNotes || undefined,
      });
      showToast("Review approved successfully", "success");
      await fetchReview(parseInt(id!));
    } catch (error) {
      console.error("Failed to approve:", error);
      showToast("Failed to approve review", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!reviewerName.trim()) {
      showToast("Please enter your name", "warning");
      return;
    }
    setConfirmAction("reject");
  };

  const confirmReject = async () => {
    setSubmitting(true);
    try {
      await backend.runs.updateReview({
        id: parseInt(id!),
        reviewStatus: "rejected",
        reviewedBy: reviewerName,
        reviewNotes: reviewNotes || undefined,
      });
      showToast("Review rejected", "success");
      await fetchReview(parseInt(id!));
    } catch (error) {
      console.error("Failed to reject:", error);
      showToast("Failed to reject review", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PASS":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/30">PASS</Badge>;
      case "WARN":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">WARN</Badge>;
      case "FAIL":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/30">FAIL</Badge>;
      default:
        return null;
    }
  };

  const getOriginalityColor = (percent: number) => {
    if (percent >= 99.95) return "text-green-600";
    if (percent >= 99.5) return "text-yellow-600";
    return "text-red-600";
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <div className="size-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-secondary">Loading review...</p>
        </div>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="p-8">
        <div className="text-center py-16">
          <XCircle className="size-16 mx-auto mb-4 text-red-500" />
          <h3 className="text-xl font-semibold text-primary mb-2">Review not found</h3>
          <Button onClick={() => navigate("/reviews")} className="mt-4">
            <ArrowLeft className="size-4" />
            Back to Reviews
          </Button>
        </div>
      </div>
    );
  }

  const isPending = !review.reviewStatus || review.reviewStatus === "pending";

  return (
    <div className="p-8">
      <ToastContainer />
      
      <div className="mb-6">
        <Button variant="outline" size="sm" onClick={() => navigate("/reviews")} className="mb-4">
          <ArrowLeft className="size-4" />
          Back to Reviews
        </Button>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary mb-2">
              Review #{review.id} - {review.branch}
            </h1>
            <div className="flex items-center gap-4 text-sm text-secondary">
              <span>Commit: {review.commit.substring(0, 7)}</span>
              {review.pullRequest > 0 && <span>PR #{review.pullRequest}</span>}
              <span>{new Date(review.timestamp).toLocaleString()}</span>
            </div>
          </div>
          {review.reviewStatus === "approved" && (
            <Badge className="bg-green-500/10 text-green-600 border-green-500/30 text-base px-4 py-2">
              <CheckCircle2 className="size-5" />
              Approved by {review.reviewedBy}
            </Badge>
          )}
          {review.reviewStatus === "rejected" && (
            <Badge className="bg-red-500/10 text-red-600 border-red-500/30 text-base px-4 py-2">
              <XCircle className="size-5" />
              Rejected by {review.reviewedBy}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-card border-2 border-border-strong rounded-lg p-4">
          <p className="text-sm text-secondary mb-1">Total Screens</p>
          <p className="text-2xl font-bold text-primary">{review.totalScreens}</p>
        </div>
        <div className="bg-green-500/10 border-2 border-green-500/30 rounded-lg p-4">
          <p className="text-sm text-green-600 mb-1">Passed</p>
          <p className="text-2xl font-bold text-green-600">{review.passedScreens}</p>
        </div>
        <div className="bg-yellow-500/10 border-2 border-yellow-500/30 rounded-lg p-4">
          <p className="text-sm text-yellow-600 mb-1">Warnings</p>
          <p className="text-2xl font-bold text-yellow-600">{review.warnedScreens}</p>
        </div>
        <div className="bg-red-500/10 border-2 border-red-500/30 rounded-lg p-4">
          <p className="text-sm text-red-600 mb-1">Failed</p>
          <p className="text-2xl font-bold text-red-600">{review.failedScreens}</p>
        </div>
      </div>

      <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-lg p-4 mb-6">
        <p className="text-lg font-semibold text-blue-700">
          {review.failedScreens > 0 
            ? `⚠️ ${review.failedScreens} screen${review.failedScreens > 1 ? 's' : ''} changed beyond thresholds — approve to replace baseline or reject to investigate.`
            : review.warnedScreens > 0
            ? `✓ ${review.warnedScreens} minor change${review.warnedScreens > 1 ? 's' : ''} within thresholds — review recommended.`
            : '✓ All screens match baseline — no action needed.'}
        </p>
      </div>

      {isPending && (
        <div className="bg-card border-2 border-border-strong rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-primary mb-4">Review Actions</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">Reviewer Name</label>
              <Input
                placeholder="Enter your name"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">Notes (optional)</label>
              <Input
                placeholder="Add review notes"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleApprove}
              disabled={submitting || !reviewerName.trim()}
              className="bg-orange-600 hover:bg-orange-700 text-white font-semibold"
            >
              ⚠️ Approve (Permanent — Replaces Baseline for All)
            </Button>
            <Button
              onClick={handleReject}
              disabled={submitting || !reviewerName.trim()}
              variant="destructive"
            >
              <ThumbsDown className="size-4" />
              Reject Changes
            </Button>
          </div>
        </div>
      )}

      {review.reviewNotes && (
        <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <FileText className="size-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-600 mb-1">Review Notes</p>
              <p className="text-sm text-foreground">{review.reviewNotes}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold text-primary">Screen Results</h2>
        <Button
          variant="outline"
          onClick={() => setShowFlakeView(!showFlakeView)}
        >
          <Layers className="size-4" />
          {showFlakeView ? "Show Results" : "Show Flake Analysis"}
        </Button>
      </div>
      {showFlakeView ? (
        <div className="space-y-6">
          {review.screens.map((screen) => (
            <FlakeVisualization
              key={screen.screenId}
              screenId={screen.screenId}
              screenName={screen.name}
              baselineImage={screen.expectedPath || ""}
              masks={[]}
              diffPixels={screen.diffPixels}
              totalPixels={screen.diffPixels / (screen.diffPixelRatio || 0.0001)}
              maskCoveragePercent={0}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {review.screens.map((screen, index) => (
            <ScreenDiffCard key={screen.screenId} screen={screen} index={index} />
          ))}
        </div>
      )}

      <ConfirmationDialog
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={confirmAction === "approve" ? confirmApprove : confirmReject}
        action={confirmAction || "approve"}
        screenCount={review.totalScreens}
        failedCount={review.failedScreens}
      />

      {selectedScreen && (
        <div
          className="fixed inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center z-50 p-8"
          onClick={() => setSelectedScreen(null)}
        >
          <div
            className="bg-card border-2 border-border-strong rounded-lg max-w-7xl w-full max-h-[90vh] overflow-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold text-primary">{selectedScreen.name}</h3>
                <p className="text-sm text-secondary">{selectedScreen.url}</p>
              </div>
              <Button variant="outline" onClick={() => setSelectedScreen(null)}>
                Close
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-semibold text-secondary mb-2">Expected</p>
                <div className="border-2 border-border-strong rounded-lg overflow-hidden">
                  <img src={selectedScreen.expectedPath} alt="Expected" className="w-full" />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-secondary mb-2">Actual</p>
                <div className="border-2 border-border-strong rounded-lg overflow-hidden">
                  <img src={selectedScreen.actualPath} alt="Actual" className="w-full" />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-secondary mb-2">Diff</p>
                <div className="border-2 border-red-500/50 rounded-lg overflow-hidden">
                  <img src={selectedScreen.diffPath} alt="Diff" className="w-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
