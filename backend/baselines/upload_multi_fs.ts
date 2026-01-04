import { api, APIError } from "encore.dev/api";
import {
  readManifest,
  writeManifest,
  writeBaselineImage,
  writeScreenConfig,
  getImageHash,
} from "./filesystem";

export interface BaselineInput {
  screenId: string;
  name: string;
  route?: string;
  tags?: string[];
  viewportWidth: number;
  viewportHeight: number;
  imageData: string;
}

export interface UploadMultiRequest {
  baselines: BaselineInput[];
}

export interface UploadedBaseline {
  screenId: string;
  hash: string;
  size: number;
  status: "created" | "updated" | "no_change";
}

export interface UploadMultiResponse {
  success: boolean;
  uploaded: UploadedBaseline[];
  errors: Array<{ screenId: string; message: string }>;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_BATCH_SIZE = 25;
const CONCURRENCY_LIMIT = 3;

const screenLocks = new Map<string, Promise<void>>();

async function acquireScreenLock(screenId: string): Promise<() => void> {
  while (screenLocks.has(screenId)) {
    await screenLocks.get(screenId);
  }
  
  let release: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    release = resolve;
  });
  
  screenLocks.set(screenId, lockPromise);
  
  return () => {
    screenLocks.delete(screenId);
    release!();
  };
}

async function processBatchWithConcurrency<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  const queue = [...items];
  const workers: Promise<void>[] = [];
  
  for (let i = 0; i < Math.min(concurrency, items.length); i++) {
    workers.push(
      (async () => {
        while (queue.length > 0) {
          const item = queue.shift();
          if (item) {
            results.push(await processor(item));
          }
        }
      })()
    );
  }
  
  await Promise.all(workers);
  return results;
}

function validateImageSignature(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  
  const isPNG = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  const isJPEG = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  const isWEBP = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
                 buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
  
  return isPNG || isJPEG || isWEBP;
}

export const uploadMultiFs = api<UploadMultiRequest, UploadMultiResponse>(
  { expose: true, method: "POST", path: "/baselines/upload-multi-fs" },
  async (req) => {
    if (req.baselines.length > MAX_BATCH_SIZE) {
      throw APIError.resourceExhausted(`Maximum ${MAX_BATCH_SIZE} files per upload`);
    }
    
    const manifest = await readManifest();
    const uploaded: UploadedBaseline[] = [];
    const errors: Array<{ screenId: string; message: string }> = [];

    const baselineMap = new Map(
      manifest.baselines.map((b) => [b.screenId, b])
    );
    const incomingIds = new Set<string>();

    type ProcessResult = { type: "success"; data: UploadedBaseline } | { type: "error"; error: { screenId: string; message: string } };

    const results = await processBatchWithConcurrency<BaselineInput, ProcessResult>(
      req.baselines,
      async (input) => {
        if (incomingIds.has(input.screenId)) {
          return {
            type: "error",
            error: {
              screenId: input.screenId,
              message: "Duplicate screen ID in upload batch",
            },
          };
        }
        incomingIds.add(input.screenId);

        const release = await acquireScreenLock(input.screenId);
        
        try {
          const imageBuffer = Buffer.from(input.imageData, "base64");

          if (imageBuffer.length > MAX_FILE_SIZE) {
            return {
              type: "error",
              error: {
                screenId: input.screenId,
                message: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
              },
            };
          }

          if (!validateImageSignature(imageBuffer)) {
            return {
              type: "error",
              error: {
                screenId: input.screenId,
                message: "Expected: Rejected (file signature check), not just extension",
              },
            };
          }

          const hash = await getImageHash(imageBuffer);
          const existingBaseline = baselineMap.get(input.screenId);
          
          let uploadStatus: "created" | "updated" | "no_change";
          
          if (existingBaseline && existingBaseline.hash === hash) {
            uploadStatus = "no_change";
          } else {
            await writeBaselineImage(input.screenId, imageBuffer);
            uploadStatus = existingBaseline ? "updated" : "created";
          }

          const hasOverrides =
            input.tags && input.tags.length > 0;

          if (hasOverrides || input.viewportWidth !== 1280 || input.viewportHeight !== 720) {
            const screenConfig: any = {
              name: input.name,
            };

            if (input.route) {
              screenConfig.url = input.route;
            }

            if (input.tags && input.tags.length > 0) {
              screenConfig.tags = input.tags;
            }

            if (input.viewportWidth !== 1280 || input.viewportHeight !== 720) {
              screenConfig.viewport = {
                width: input.viewportWidth,
                height: input.viewportHeight,
              };
            }

            await writeScreenConfig(input.screenId, screenConfig);
          }

          if (uploadStatus !== "no_change") {
            baselineMap.set(input.screenId, {
              screenId: input.screenId,
              name: input.name,
              url: input.route,
              hash,
              tags: input.tags,
            });
          }

          return {
            type: "success",
            data: {
              screenId: input.screenId,
              hash,
              size: imageBuffer.length,
              status: uploadStatus,
            },
          };
        } catch (error) {
          return {
            type: "error",
            error: {
              screenId: input.screenId,
              message: error instanceof Error ? error.message : "Upload failed",
            },
          };
        } finally {
          release();
        }
      },
      CONCURRENCY_LIMIT
    );

    for (const result of results) {
      if (result.type === "success") {
        uploaded.push(result.data);
      } else {
        errors.push(result.error);
      }
    }

    if (uploaded.length > 0) {
      manifest.baselines = Array.from(baselineMap.values()).sort((a, b) => 
        a.screenId.localeCompare(b.screenId)
      );
      await writeManifest(manifest);
    }

    return {
      success: errors.length === 0,
      uploaded,
      errors,
    };
  }
);
