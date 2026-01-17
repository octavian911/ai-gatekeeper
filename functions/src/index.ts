import * as functions from "firebase-functions/v2/https";
import express from "express";
import cors from "cors";
import Busboy from "busboy";
import { Storage } from "@google-cloud/storage";
import path from "path";
import * as admin from "firebase-admin";


// Firebase Admin init (required for admin.storage())
admin.initializeApp();

/**
 * __AGK_EARLY_NORMALIZERS__
 * Fix two production blockers:
 *  (1) normalize /api/api/* -> /api/* before routing
 *  (2) normalize Authorization header access so middleware doesn't miss it
 */
try {
  // NOTE: Express lowercases req.headers keys. Always use req.get('authorization') / req.headers.authorization.
  // Also, requests can arrive as /api/api/... due to frontend drift; normalize early.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const _agkInstall = (app: any) => {
    app.use((req: any, _res: any, next: any) => {
      try {
        // Normalize /api/api/... -> /api/...
        if (typeof req.url === "string") {
          req.url = req.url.replace(/^\/api\/api\//, "/api/");
          req.url = req.url.replace(/^\/api\/api(?=\/|$)/, "/api");
        }
        if (typeof req.originalUrl === "string") {
          req.originalUrl = req.originalUrl.replace(/^\/api\/api\//, "/api/");
          req.originalUrl = req.originalUrl.replace(/^\/api\/api(?=\/|$)/, "/api");
        }

        // Normalize Authorization header into req.headers.authorization
        const a = (req.get && (req.get("authorization") || req.get("Authorization"))) || req.headers?.authorization;
        if (a && !req.headers.authorization) req.headers.authorization = a;
      } catch (e: any) {}
      next();
    });
  };

  // Attempt to hook into the common "app" variable if it exists
  // If your app variable name differs, the middleware below is still harmless (no throw).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis as any;
  if (typeof (g as any).app !== "undefined") {
    _agkInstall((g as any).app);
  }
} catch (e: any) {}


// Admin SDK
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


function agkReadAuthHeader(req: any): string {
  const h =
    (req?.headers?.authorization as string) ||
    (req?.headers?.Authorization as string) ||
    (typeof req?.get === "function" ? (req.get("authorization") || req.get("Authorization")) : "") ||
    "";
  return typeof h === "string" ? h : "";
}

function agkExtractBearer(req: any): string | null {
  const raw = agkReadAuthHeader(req).trim();
  if (!raw) return null;
  const m = raw.match(/^Bearer\s+(.+)$/i);
  const tok = (m ? m[1] : raw).trim();
  return tok.replace(/^"+|"+$/g, "") || null; // strip accidental quotes
}


function agkTokenMeta(tok: string | null) {
  const t = (tok || "").trim();
  const dots = (t.match(/\./g) || []).length;
  const len = t.length;
  const head = t.slice(0, 12);
  const tail = t.slice(Math.max(0, len - 12));
  return { len, dots, head, tail };
}

async function requireAuth(req: AuthedReq, res: express.Response, next: express.NextFunction) {
  const tok = agkExtractBearer(req);
  try {
    if (!tok) {
      return res.status(401).json({ ok: false, error: "unauthorized", detail: "missing_token", meta: agkTokenMeta(tok) });
    }
    const decoded = await admin.auth().verifyIdToken(tok);
    req.uid = decoded.uid;
    (req as any).signInProvider = (decoded && decoded.firebase && decoded.firebase.sign_in_provider) ? decoded.firebase.sign_in_provider : null;
    return next();
  } catch (e: any) {
    return res.status(401).json({
      ok: false,
      error: "unauthorized",
      detail: String((e as any)?.message || e),
      meta: agkTokenMeta(tok),
    });
  }
}

const app = express();


/** __AGK_AUTH_V2__
 * Use ONE canonical way to read/verify ID tokens.
 * (whoami already works — match that exact behavior)
 */

function agkReadAuthHeaderV2(req: any) {
  const h =
    (req && req.headers && req.headers.authorization) ||
    (req && req.headers && req.headers.Authorization) ||
    (typeof req?.get === "function" ? (req.get("authorization") || req.get("Authorization")) : "") ||
    "";
  return typeof h === "string" ? h : "";
}

function agkExtractBearerV2(req: any) {
  const raw = agkReadAuthHeaderV2(req).trim();
  if (!raw) return null;
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return (m ? m[1] : raw).trim() || null;
}

async function requireAuthV2(req: any, res: any, next: any) {
  const tok = agkExtractBearerV2(req);
  if (!tok) {
    return res.status(401).json({ ok: false, error: "unauthorized", detail: "missing_token", meta: agkTokenMeta(tok) });
  }
  try {
    // Use SAME verifier as whoami does.
    const decoded = await admin.auth().verifyIdToken(tok);
    req.uid = decoded.uid;
    return; // Propagate UID consistently for downstream handlers
    (req as any).uid = (req as any).uid || (req as any).user?.uid;
    (req as any).user = (req as any).user || { uid: (req as any).uid };
    next();
  } catch (e) {
    return res.status(401).json({
      ok: false,
      error: "unauthorized",
      detail: String((e as any)?.message || e),
      meta: agkTokenMeta(tok),
    });
  }
}

// Debug: shows what FS auth middleware sees (meta only — not the full token)
app.get("/api/baselines/fs_debug", async (req, res) => {
  const tok = agkExtractBearerV2(req);
  try {
    const decoded = tok ? await admin.auth().verifyIdToken(tok) : null;
    return res.json({ ok: true, meta: agkTokenMeta(tok), uid: decoded ? decoded.uid : null });
  } catch (e) {
    return res.status(401).json({ ok: false, meta: agkTokenMeta(tok), detail: String((e as any)?.message || e) });
  }
});


/**
 * TEMP DEBUG: inspect request headers + token shape for fs auth troubleshooting
 * Remove after confirming the failing gate.
 */
app.get("/baselines/fs_debug", requireAuthV2, async (req: any, res: any) => {
  try {
    const h = String(req.headers.authorization || "");
    const tok = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
    return res.json({
      ok: true,
      hasAuth: !!h,
      authHead: h.slice(0, 20),
      authLen: h.length,
      tokenLen: tok.length,
      tokenDots: (tok.match(/\./g) || []).length,
      hasAppCheck: !!req.headers["x-firebase-appcheck"],
      hasCookie: !!req.headers.cookie,
      path: req.path,
      url: req.url,
      method: req.method,
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: "debug_failed", detail: String((e as any)?.message || e) });
  }
});

/* AGK_FIX_START */
/**
 * AGK FIX:
 * - Normalize accidental /api/api/* requests -> /api/*
 * - Read Authorization header case-insensitively (Node lowercases headers)
 * - Add /api/baselines/whoami to confirm auth works
 */


// Normalize paths early (fix /api/api issue coming from frontend/base-url mistakes)
app.use((req: any, _res: any, next: any) => {
  try {
    const u = String(req.url || "");
    if (u.startsWith("/api/api/")) req.url = u.replace(/^\/api\/api\//, "/api/");
  } catch {}
  next();
});

// Debug endpoint: proves token is being read + verified
app.get("/api/baselines/whoami", async (req: any, res: any) => {
  try {
    const tok = agkExtractBearer(req);
    if (!tok) return res.status(401).json({ ok: false, error: "unauthorized", detail: "missing_token" });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const admin = require("firebase-admin");
    const decoded = await admin.auth().verifyIdToken(tok);
    return res.json({ ok: true, uid: decoded?.uid || null });
  } catch (e: any) {
    return res.status(401).json({ ok: false, error: "unauthorized", detail: String((e as any)?.message || e) });
  }
});
/* AGK_FIX_END */

// __AGK_NORMALIZE_APIAPI__
app.use((req, _res, next) => {
  try {
    if (typeof req.url === "string") {
      req.url = req.url.replace(/^\/api\/api\//, "/api/");
      req.url = req.url.replace(/^\/api\/api(?=\/|$)/, "/api");
    }
    if (typeof req.originalUrl === "string") {
      req.originalUrl = req.originalUrl.replace(/^\/api\/api\//, "/api/");
      req.originalUrl = req.originalUrl.replace(/^\/api\/api(?=\/|$)/, "/api");
    }

    const raw = (req.get && (req.get("authorization") || req.get("Authorization"))) || req.headers?.authorization;
    if (raw && !req.headers.authorization) req.headers.authorization = raw;
  } catch (e: any) {
    // ignore
  }
  next();
});


/** __AGK_GIT_STATUS_ROUTE_V2__
 * Baselines health endpoint used by UI (git status / build info).
 * Returns JSON (never HTML 404).
 */
app.get(["/baselines/git-status"], async (_req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const sha =
      process.env.GIT_SHA ||
      process.env.COMMIT_SHA ||
      process.env.SOURCE_VERSION ||
      "unknown";
    return res.status(200).json({ ok: true, sha });
  } catch (_e) {
    return res.status(200).json({ ok: true, sha: "unknown" });
  }
});
/** __AGK_BASELINES_PREFIX_NORMALIZER__
 * Normalize Hosting rewrite prefixes so route matching works:
 *  - /api/api/baselines/* -> /baselines/*
 *  - /api/baselines/*     -> /baselines/*
 */
app.use((req, _res, next) => {
  try {
    const u = String(req.url || "");
    if (u.startsWith("/api/api/baselines/")) req.url = u.replace(/^\/api\/api\/baselines\//, "/baselines/");
    else if (u.startsWith("/api/baselines/")) req.url = u.replace(/^\/api\/baselines\//, "/baselines/");
  } catch (e: any) {}
  next();
});
// ===== AI_GATEKEEPER_API_HEALTH_ALIAS =====
// Always respond on /api/__health even if prefix stripping is broken.

// ===== AI_GATEKEEPER_PUBLIC_
/** __AGK_GIT_STATUS_ROUTE__
 * Health endpoint used by UI (git status / build info)
 * Public on purpose (returns JSON, never 404/HTML).
 */
app.get(["/baselines/git-status"], async (_req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    // If you have envs like GIT_SHA / COMMIT_SHA set in build, expose them:
    const sha = process.env.GIT_SHA || process.env.COMMIT_SHA || process.env.SOURCE_VERSION || "unknown";
    return res.status(200).json({ ok: true, sha });
  } catch (e: any) {
    return res.status(200).json({ ok: true, sha: "unknown" });
  }
});
// DEBUG_HEADERS =====
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
  } catch (e: any) {
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
  } catch (e: any) {
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
        rejected.push({ reason: "gcs_write_error", filename: original, mimeType, message: String((e as any)?.message || e) });
        finish();
      });

      file.on("error", (e: any) => {
        rejected.push({ reason: "file_stream_error", filename: original, mimeType, message: String((e as any)?.message || e) });
        finish();
      });
    });

    tasks.push(task);
    file.pipe(writeStream);
  });

  bb.on("error", (e: any) => {
    res.status(400).json({ ok: false, error: "bad_multipart", message: String((e as any)?.message || e) });
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

app.post(["/api/baselines/upload-multi-fs", "/baselines/upload-multi-fs"], requireAuth, uploadMultiFsHandler);
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
// List files for current user
app.get(["/api/baselines/fs", "/baselines/fs"], requireAuthV2, async (req: any, res: any) => {
  const startedAt = Date.now();

  try {
    const uid = (req as any)?.uid || (req as any)?.user?.uid;
    if (!uid) {
      return res.status(401).json({
        ok: false,
        error: "unauthorized",
        reason: "fs_handler_denied",
        uid: (req as any)?.uid || null,
        provider: (req as any).signInProvider || null,
      });
    }

    const bucket = admin.storage().bucket(getUploadBucket());
    const prefix = `uploads/${uid}/`;

    // Query controls
    const limitRaw = (req.query as any)?.limit;
    const limitNum = Number(limitRaw);
    const limit = Number.isFinite(limitNum) ? Math.min(Math.max(limitNum, 1), 200) : 50;

    const pageTokenRaw = (req.query as any)?.pageToken;
    const pageTokenStr = pageTokenRaw ? String(pageTokenRaw).trim() : "";
    const pageToken = pageTokenStr ? pageTokenStr : undefined;

    const opts: any = { prefix, maxResults: limit, autoPaginate: false };
    if (pageToken) opts.pageToken = pageToken;

    // @google-cloud/storage getFiles returns: [files, nextQuery, apiResponse]
    const result: any = await bucket.getFiles(opts);
    const files: any[] = (result && result[0]) ? result[0] : [];
    const nextQuery: any = (result && result[1]) ? result[1] : null;
    const nextPageToken: string | undefined =
        nextQuery && nextQuery.pageToken ? String(nextQuery.pageToken) : undefined;

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

    const elapsedMs = Date.now() - startedAt;
    console.log(JSON.stringify({ tag: "FS_LIST", uid, prefix, limit, hasPageToken: !!pageToken, count: out.length, hasNextPageToken: !!nextPageToken, elapsedMs }));
    return res.json({ ok: true, count: out.length, files: out, nextPageToken });
  } catch (e: any) {
    console.error("FS_LIST_ERR", { message: String(e?.message || e) });
    return res.status(500).json({ ok: false, error: "list_failed", message: String(e?.message || e) });
  }
});


// Delete all objects whose *filename* starts with screenId (prefix match)
app.delete(["/api/baselines/:screenId/fs", "/baselines/:screenId/fs"], requireAuth, async (req: any, res: any) => {
  try {
    const uid = (req as any)?.uid || (req as any)?.user?.uid;
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
    return res.status(500).json({ ok: false, error: "delete_failed", message: String((e as any)?.message || e) });
  }
});

// Return an image (first match) by redirecting to /api/download
app.get(["/api/baselines/:screenId/image-fs", "/baselines/:screenId/image-fs"], requireAuth, async (req: any, res: any) => {
  try {
    const uid = (req as any)?.uid || (req as any)?.user?.uid;
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
    return res.status(500).json({ ok: false, error: "image_failed", message: String((e as any)?.message || e) });
  }
});

export const api = functions.onRequest(
  { region: process.env.API_REGION || "us-central1" },
  app
);
