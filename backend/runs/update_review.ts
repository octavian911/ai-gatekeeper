import { api, APIError } from "encore.dev/api";
import db from "../db";

export interface UpdateReviewRequest {
  id: number;
  reviewStatus: "approved" | "rejected";
  reviewedBy: string;
  reviewNotes?: string;
}

export interface UpdateReviewResponse {
  success: boolean;
  message: string;
}

export const updateReview = api<UpdateReviewRequest, UpdateReviewResponse>(
  { expose: true, method: "PUT", path: "/runs/reviews/:id" },
  async (req) => {
    const existing = await db.queryRow<{ id: number }>`
      SELECT id FROM runs WHERE id = ${req.id}
    `;

    if (!existing) {
      throw APIError.notFound("run not found");
    }

    await db.exec`
      UPDATE runs
      SET
        review_status = ${req.reviewStatus},
        reviewed_by = ${req.reviewedBy},
        reviewed_at = NOW(),
        review_notes = ${req.reviewNotes || null}
      WHERE id = ${req.id}
    `;

    return {
      success: true,
      message: `Review ${req.reviewStatus} by ${req.reviewedBy}`,
    };
  }
);
