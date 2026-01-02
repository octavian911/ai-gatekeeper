import { api, APIError } from "encore.dev/api";
import db from "../db";

export interface GetBaselineRequest {
  screenId: string;
}

export interface GetBaselineResponse {
  screenId: string;
  name: string;
  route: string | null;
  tags: string[];
  viewportWidth: number;
  viewportHeight: number;
  hash: string | null;
  status: string;
  statusMessage: string | null;
  hasImage: boolean;
  fileSize: number | null;
  masks: Array<{ type: string; selector?: string; x?: number; y?: number; width?: number; height?: number }>;
  thresholds: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export const get = api<GetBaselineRequest, GetBaselineResponse>(
  { expose: true, method: "GET", path: "/baselines/:screenId" },
  async (req) => {
    const row = await db.queryRow<{
      id: string;
      name: string;
      route: string | null;
      tags: string[];
      viewport_width: number;
      viewport_height: number;
      hash: string | null;
      status: string;
      status_message: string | null;
      has_image: boolean;
      file_size: number | null;
      masks: any;
      thresholds: any;
      created_at: Date;
      updated_at: Date;
    }>`
      SELECT 
        id, name, route, tags, viewport_width, viewport_height, hash,
        status, status_message, has_image, file_size, masks, thresholds,
        created_at, updated_at
      FROM baselines
      WHERE id = ${req.screenId}
    `;

    if (!row) {
      throw APIError.notFound("Baseline not found");
    }

    return {
      screenId: row.id,
      name: row.name,
      route: row.route,
      tags: row.tags,
      viewportWidth: row.viewport_width,
      viewportHeight: row.viewport_height,
      hash: row.hash,
      status: row.status,
      statusMessage: row.status_message,
      hasImage: row.has_image,
      fileSize: row.file_size,
      masks: row.masks || [],
      thresholds: row.thresholds || {},
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
);
