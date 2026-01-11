import * as functions from "firebase-functions/v2/https";
import express from "express";
import cors from "cors";
import Busboy from "busboy";
import { Storage } from "@google-cloud/storage";
import { initializeApp as initAdmin } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import path from "path";

// Admin SDK
initAdmin();
const auth = getAuth();

// Storage
const storage = new Storage();

function getProjectId(): string {
  const cfg = process.env.FIREBASE_CONFIG;
  if (cfg) {
    try {
      const j = JSON.parse(cfg);
      if (j && typeof j.projectId === "string") return j.projectId;
    } catch {}
  }
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  if (process.env.GCP_PROJECT) return process.env.GCP_PROJECT;
  return "unknown";
}

function getUploadBucket(): string {
  const env = (process.env.UPLOAD_BUCKET || "").trim();
  if (env) return env;
  return `${getProjectId()}-uploads`;
}

function safeFileName(name: string): string {
  const base = path.basename(name || "file").replace(/[^\w.\-]/g, "_");
  return base.slice(0, 120) || "file";
}

type AuthedReq = express.Request & { uid?: string };

async function requireAuth(req: AuthedReq, res: express.Response, next: express.NextFunction) {
  try {
    const h = String(req.headers.authorization || "");
    const m = h.match(/^Bearer\s+(.+)$/i);
    if (!m) return res.status(401).json({ ok: false, error: "unauthorized" });

    const decoded = await auth.verifyIdToken(m[1]);
    req.uid = decoded.uid;
    return next();
  } catch {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
}

const app = express();

// CORS (keep permissive for now; tighten later)
app.use(cors({ origin: true, credentials: true }));

/**
 * CRITICAL:
 * Do NOT run express.json() on multipart requests, or Busboy will see zero files.
 */
const jsonParser = express.json({ limit: "10mb" });
app.use((req, res, next) => {
  const ct = String(req.headers["content-type"] || "");
  if (ct.startsWith("multipart/form-data")) return next();
  return jsonParser(req, res, next);
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/debug/headers", requireAuth, (req: AuthedReq, res) => {
  res.json({
    ok: true,
    uid: req.uid,
    method: req.method,
    url: req.originalUrl,
    contentType: req.headers["content-type"] || null,
    contentLength: req.headers["content-length"] || null,
    userAgent: req.headers["user-agent"] || null,
  });
});

app.get("/api/debug/env", requireAuth, (req: AuthedReq, res) => {
  res.json({
    ok: true,
    uid: req.uid,
    uploadBucket: getUploadBucket(),
    apiRegion: process.env.API_REGION || null,
    projectId: getProjectId(),
  });
});

// Conservative allowlist (expand later if needed)
const ALLOWED_MIME = new Set<string>([
  "text/plain",
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/json",
]);

app.post("/api/upload-multi-fs", requireAuth, (req: any, res) => {
  const uid = String((req as AuthedReq).uid || "");
  const ct = String(req.headers["content-type"] || "");

  if (!ct.startsWith("multipart/form-data")) {
    res.status(400).json({ ok: false, error: "bad_multipart", message: "Expected multipart/form-data", contentType: ct });
    return;
  }

  const bucketName = getUploadBucket();
  const bucket = storage.bucket(bucketName);

  const bb = Busboy({ headers: req.headers });

  let sawFileEvent = false;
  const uploads: Array<{ object: string; filename: string; mimeType: string; bytes: number; downloadPath: string }> = [];
  const rejected: any[] = [];
  const tasks: Promise<void>[] = [];

  bb.on("file", (fieldname: string, file: any, info: any) => {
    sawFileEvent = true;

    // Accept both "files" and "file"
    if (!(fieldname === "files" || fieldname === "file")) {
      file.resume();
      rejected.push({ reason: "bad_fieldname", fieldname });
      return;
    }

    const original = safeFileName(String(info?.filename || "file"));
    const mimeType = String(info?.mimeType || "application/octet-stream").toLowerCase();

    if (!ALLOWED_MIME.has(mimeType)) {
      file.resume();
      rejected.push({ reason: "mime_not_allowed", filename: original, mimeType, allowed: Array.from(ALLOWED_MIME) });
      return;
    }

    const object = `uploads/${uid}/${Date.now()}_${original}`;
    const gcsFile = bucket.file(object);

    let bytes = 0;
    file.on("data", (d: Buffer) => { bytes += d.length; });

    const writeStream = gcsFile.createWriteStream({
      resumable: false,
      metadata: { contentType: mimeType },
    });

    const task = new Promise<void>((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };

      writeStream.on("finish", () => {
        uploads.push({
          object,
          filename: original,
          mimeType,
          bytes,
          downloadPath: `/api/download?object=${encodeURIComponent(object)}`,
        });
        finish();
      });

      writeStream.on("error", (e: any) => {
        rejected.push({ reason: "gcs_write_error", filename: original, mimeType, message: String(e?.message || e) });
        finish();
      });

      file.on("error", (e: any) => {
        rejected.push({ reason: "file_stream_error", filename: original, mimeType, message: String(e?.message || e) });
        finish();
      });
    });

    tasks.push(task);
    file.pipe(writeStream);
  });

  bb.on("error", (e: any) => {
    res.status(400).json({ ok: false, error: "bad_multipart", message: String(e?.message || e) });
  });

  bb.on("finish", async () => {
    await Promise.all(tasks);

    if (!sawFileEvent) {
      res.status(400).json({
        ok: false,
        error: "no_files_parsed",
        message: "Busboy saw no file events. This usually means a body parser consumed the stream before Busboy.",
        contentType: ct,
      });
      return;
    }

    if (!uploads.length) {
      res.status(400).json({
        ok: false,
        error: "no_files_accepted",
        message: "Files were rejected (fieldname/mime) or empty/failed to write.",
        rejected,
      });
      return;
    }

    res.json({ ok: true, count: uploads.length, files: uploads, rejected });
  });

  // Prefer rawBody if present (Cloud Functions provides it)
  const raw = req.rawBody;
  if (raw && Buffer.isBuffer(raw) && raw.length) {
    bb.end(raw);
    return;
  }

  // Fallback: stream
  req.pipe(bb);
});

app.get("/api/download", requireAuth, async (req: any, res) => {
  const uid = String((req as AuthedReq).uid || "");
  const object = String(req.query.object || "");

  if (!object) {
    res.status(400).json({ ok: false, error: "missing_object" });
    return;
  }

  // Enforce UID scope
  const prefix = `uploads/${uid}/`;
  if (!object.startsWith(prefix)) {
    res.status(403).json({ ok: false, error: "forbidden" });
    return;
  }

  const bucket = storage.bucket(getUploadBucket());
  const f = bucket.file(object);

  try {
    const [meta] = await f.getMetadata();
    const ct = String(meta?.contentType || "application/octet-stream");
    res.setHeader("Content-Type", ct);

    const dl = safeFileName(path.basename(object));
    res.setHeader("Content-Disposition", `attachment; filename="${dl}"`);

    f.createReadStream()
      .on("error", () => res.status(404).json({ ok: false, error: "not_found" }))
      .pipe(res);
  } catch {
    res.status(404).json({ ok: false, error: "not_found" });
  }
});

export const api = functions.onRequest(
  { region: process.env.API_REGION || "us-central1" },
  app
);
