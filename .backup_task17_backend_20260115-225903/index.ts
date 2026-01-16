import * as functions from "firebase-functions/v2/https";
import express from "express";
import cors from "cors";
import Busboy from "busboy";
import { Storage } from "@google-cloud/storage";
import { initializeApp as initAdmin } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import path from "path";
import * as admin from "firebase-admin";


// Firebase Admin init (required for admin.storage())
admin.initializeApp();

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


// ===== AI_GATEKEEPER_API_HEALTH_ALIAS =====
// Always respond on /api/__health even if prefix stripping is broken.

// ===== AI_GATEKEEPER_PUBLIC_DEBUG_HEADERS =====
// TEMP: public endpoint to confirm what headers arrive via Hosting rewrite.
// Remove after debugging.
app.all("/__debug/headers", (req, res) => {
  const auth = req.headers["authorization"] || "";
  res.json({
    ok: true,
    method: req.method,
    originalUrl: req.originalUrl,
    url: req.url,
    hasAuth: !!auth,
    authPrefix: typeof auth === "string" ? auth.slice(0, 24) : "",
    host: req.headers["host"] || "",
    origin: req.headers["origin"] || "",
  });
});
app.get(["/__debug/verify", "/__debug/verify"], async (req, res) => {
  try {
    const auth = String(req.get("authorization") || "");
    const m = auth.match(/^Bearer\s+(.+)$/i);
    const idToken = m?.[1] || "";
    if (!idToken) return res.status(200).json({ ok: false, error: "missing_bearer" });

    const decoded = await admin.auth().verifyIdToken(idToken);
    return res.status(200).json({
      ok: true,
      uid: decoded.uid,
      aud: decoded.aud,
      iss: decoded.iss,
      iat: decoded.iat,
      exp: decoded.exp,
      firebase: (decoded as any).firebase || null,
    });
  } catch (e) {
    const err: any = e;
    return res.status(200).json({
      ok: false,
      error: String(err?.code || err?.name || "verify_failed"),
      message: String(err?.message || err),
    });
  }
});
// ===== /AI_GATEKEEPER_PUBLIC_DEBUG_VERIFY =====
app.get(["/api/__debug/verify", "/__debug/verify"], async (req, res) => {
  try {
    const authHeader = String(req.get("authorization") || "");
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!idToken) return res.status(200).json({ ok: false, error: "missing_bearer" });

    const decoded = await admin.auth().verifyIdToken(idToken);
    return res.status(200).json({
      ok: true,
      uid: decoded.uid,
      aud: decoded.aud,
      iss: decoded.iss,
      iat: decoded.iat,
      exp: decoded.exp,
      email: (decoded as any).email || null,
      firebase: (decoded as any).firebase || null,
    });
  } catch (e) {
    const err = (e || {}) as any;
    return res.status(200).json({
      ok: false,
      error: String(err.code || err.name || "verify_failed"),
      message: String(err.message || err),
    });
  }
});
// ===== /AI_GATEKEEPER_PUBLIC_DEBUG_VERIFY =====

// ===== /AI_GATEKEEPER_PUBLIC_DEBUG_HEADERS =====

app.get("/api/__health", (_req, res) => res.status(200).json({ ok: true, via: "/api/__health" }));
// Also keep the canonical health endpoint:
app.get("/__health", (_req, res) => res.status(200).json({ ok: true, via: "/__health" }));
// ===== /AI_GATEKEEPER_API_HEALTH_ALIAS =====

// ===== AI_GATEKEEPER_API_PREFIX_STRIPPER =====
// Hosting rewrites /api/** to this function.
// Strip "/api" so we can define routes as "/baselines/..." etc.
app.use((req, _res, next) => {
  const u = req.url || "";
  if (u === "/api" || u.startsWith("/api/")) {
    req.url = u === "/api" ? "/" : u.slice(4) || "/";
  }
  next();
});
// ===== /AI_GATEKEEPER_API_PREFIX_STRIPPER =====

app.get("/__health", (req, res) => {
  res.status(200).json({
    ok: true,
    method: req.method,
    originalUrl: (req && req.originalUrl) || null,
    url: (req && req.url) || null,
  });

  // AI_GATEKEEPER_BASELINES_UPLOAD_FALLBACK
  // AI_GATEKEEPER_HEALTH_ENDPOINT
  // AI_GATEKEEPER_API_PREFIX_STRIPPER
  // Firebase Hosting rewrite sends /api/** to this function; normalize so app routes can be defined without /api prefix.
  app.use((req, _res, next) => {
    if (req.url === "/api" || req.url.startsWith("/api/")) {
      req.url = req.url.replace(/^\/api(\/|$)/, "/");
    }
    next();
  });

  /** AI-GATEKEEPER_API_PREFIX_STRIPPER
 * Normalize URLs when Firebase Hosting rewrites "/api/**" to the function.
 * If requests reach Express as "/api/...", strip that prefix so routes can be written as "/baselines/..."
 */
  app.use((req, _res, next) => {
    const u = req.url || "";
    if (u === "/api" || u === "/api/") req.url = "/";
    else if (u.startsWith("/api/")) req.url = u.slice(4) || "/";
    next();
  });
  /** end AI-GATEKEEPER_API_PREFIX_STRIPPER */

/** AI-GATEKEEPER_HEALTH_ENDPOINT
 * Probe endpoint (via Hosting): GET /api/__health
 */
});
/** end AI-GATEKEEPER_HEALTH_ENDPOINT */
// ---- AI Gatekeeper: strip /api prefix (so Firebase Hosting rewrite /api/** works) ----
app.use((req, _res, next) => {
  // strip /api prefix
  if (typeof req.url === "string" && req.url.startsWith("/api/")) {
    req.url = req.url.slice(4) || "/";
  }
  next();
});
// ---- end strip /api prefix ----
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

// AI_GATEKEEPER_UPLOAD_MULTI_HANDLER
const uploadMultiFsHandler = (req: any, res: any) => {
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
};

// Requests hit this function via Hosting rewrite /api/**.
// We strip "/api" earlier, so define routes WITHOUT "/api" prefix.
app.post("/upload-multi-fs", requireAuth, uploadMultiFsHandler);

app.post("/baselines/upload-multi-fs", requireAuth, uploadMultiFsHandler);
// Baselines page calls this:

app.get("/download", requireAuth, async (req: any, res) => {
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

/**
 * Baselines FS endpoints (GCS-backed)
 * Objects live under: uploads/<uid>/
 */

// alias in case it wasn't inserted earlier

// List files for current user
app.get("/baselines/fs", requireAuth, async (req: any, res: any) => {
  try {
    const uid = (req as any)?.user?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });

    const bucket = admin.storage().bucket(getUploadBucket());
    const prefix = `uploads/${uid}/`;

    const [files] = await bucket.getFiles({ prefix });
    const out = (files || [])
      .filter((f: any) => f?.name && !String(f.name).endsWith("/"))
      .map((f: any) => {
        const object = String(f.name);
        const filename = object.startsWith(prefix) ? object.slice(prefix.length) : object;
        return {
          object,
          filename,
          downloadPath: `/api/download?object=${encodeURIComponent(object)}`,
        };
      });

    return res.json({ ok: true, count: out.length, files: out });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: "list_failed", message: String(e?.message || e) });
  }
});

// Delete all objects whose *filename* starts with screenId (prefix match)
app.delete("/baselines/:screenId/fs", requireAuth, async (req: any, res: any) => {
  try {
    const uid = (req as any)?.user?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });

    const screenId = String(req.params.screenId || "").trim();
    if (!screenId) return res.status(400).json({ ok: false, error: "missing_screenId" });

    const bucket = admin.storage().bucket(getUploadBucket());
    const userPrefix = `uploads/${uid}/`;

    // We stored as: uploads/<uid>/<timestamp>_<originalfilename>
    // So we can't strictly prefix by screenId unless you encode screenId into filename.
    // We'll do a contains match on the filename part to be safer.
    const [files] = await bucket.getFiles({ prefix: userPrefix });
    const targets = (files || []).filter((f: any) => {
      const object = String(f?.name || "");
      if (!object || object.endsWith("/")) return false;
      const filename = object.startsWith(userPrefix) ? object.slice(userPrefix.length) : object;
      return filename.startsWith(screenId);
    });

    if (!targets.length) return res.json({ ok: true, removed: 0, objects: [] });

    const objects: string[] = [];
    for (const f of targets) {
      const object = String(f.name);
      objects.push(object);
      await bucket.file(object).delete({ ignoreNotFound: true }).catch(() => {});
    }

    return res.json({ ok: true, removed: objects.length, objects });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: "delete_failed", message: String(e?.message || e) });
  }
});

// Return an image (first match) by redirecting to /api/download
app.get("/baselines/:screenId/image-fs", requireAuth, async (req: any, res: any) => {
  try {
    const uid = (req as any)?.user?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: "unauthorized" });

    const screenId = String(req.params.screenId || "").trim();
    if (!screenId) return res.status(400).json({ ok: false, error: "missing_screenId" });

    const bucket = admin.storage().bucket(getUploadBucket());
    const userPrefix = `uploads/${uid}/`;

    const [files] = await bucket.getFiles({ prefix: userPrefix });
    const first = (files || []).find((f: any) => {
      const object = String(f?.name || "");
      if (!object || object.endsWith("/")) return false;
      const filename = object.startsWith(userPrefix) ? object.slice(userPrefix.length) : object;
      return filename.startsWith(screenId);
    });

    if (!first?.name) return res.status(404).json({ ok: false, error: "not_found" });

    const object = String(first.name);
    return res.redirect(302, `/api/download?object=${encodeURIComponent(object)}`);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: "image_failed", message: String(e?.message || e) });
  }
});

export const api = functions.onRequest(
  { region: process.env.API_REGION || "us-central1" },
  app
);
