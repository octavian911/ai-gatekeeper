import { api } from "encore.dev/api";
import db from "../db";

export interface BaselineMetadata {
  screenId: string;
  name: string;
  url: string;
  hash: string;
  tags?: string[];
  imageUrl?: string;
  hasImage: boolean;
  validated?: boolean;
  size?: number;
  uploadedAt?: string;
  status: string;
  statusMessage?: string;
  viewportWidth: number;
  viewportHeight: number;
  masks?: Array<{ type: string; selector?: string; x?: number; y?: number; width?: number; height?: number }>;
  thresholds?: Record<string, number>;
}

export interface ListBaselinesResponse {
  baselines: BaselineMetadata[];
}

export const list = api<void, ListBaselinesResponse>(
  { expose: true, method: "GET", path: "/baselines" },
  async () => {
    const rows = await db.queryAll<{
      id: string;
      name: string;
      route: string;
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
      ORDER BY created_at DESC
    `;

    const baselines: BaselineMetadata[] = rows.map((row) => ({
      screenId: row.id,
      name: row.name,
      url: row.route || "",
      hash: row.hash || "",
      tags: row.tags,
      hasImage: row.has_image,
      validated: row.status === "validated",
      size: row.file_size || undefined,
      uploadedAt: row.updated_at.toISOString(),
      status: row.status,
      statusMessage: row.status_message || undefined,
      viewportWidth: row.viewport_width,
      viewportHeight: row.viewport_height,
      masks: row.masks || [],
      thresholds: row.thresholds || {},
    }));

    return { baselines };
  }
);
