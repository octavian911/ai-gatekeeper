import { api, APIError } from "encore.dev/api";
import { readBaselineImage } from "./filesystem";

export interface GetImageRequest {
  screenId: string;
}

export interface GetImageResponse {
  imageData: string;
}

export const getImageFs = api<GetImageRequest, GetImageResponse>(
  { expose: true, method: "GET", path: "/baselines/:screenId/image-fs" },
  async (req) => {
    const imageBuffer = await readBaselineImage(req.screenId);

    if (!imageBuffer) {
      throw APIError.notFound("Baseline image not found");
    }

    return {
      imageData: `data:image/png;base64,${imageBuffer.toString("base64")}`,
    };
  }
);
