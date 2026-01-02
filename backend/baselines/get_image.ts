import { api, APIError } from "encore.dev/api";
import { baselineImages } from "./storage";
import db from "../db";

export interface GetImageRequest {
  screenId: string;
}

export interface GetImageResponse {
  imageData: string;
  hash: string;
}

export const getImage = api<GetImageRequest, GetImageResponse>(
  { expose: true, method: "GET", path: "/baselines/:screenId/image" },
  async (req) => {
    const baseline = await db.queryRow<{ hash: string | null; has_image: boolean }>`
      SELECT hash, has_image FROM baselines WHERE id = ${req.screenId}
    `;

    if (!baseline) {
      throw APIError.notFound("Baseline not found");
    }

    if (!baseline.has_image || !baseline.hash) {
      throw APIError.notFound("Baseline image not found");
    }

    const objectName = `${req.screenId}/${baseline.hash}.png`;
    const imageBuffer = await baselineImages.download(objectName);
    const base64 = imageBuffer.toString("base64");

    return {
      imageData: base64,
      hash: baseline.hash,
    };
  }
);
