
// __AGK_AUTH_HEADERS_V1__
async function __agkGetAuthHeaders() {
  try {
    const { getAuth } = await import("firebase/auth");
    const auth = getAuth();
    const deadline = Date.now() + 6000;
    while (!auth.currentUser && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 200));
    }
    if (!auth.currentUser) return {};
    const tok = await auth.currentUser.getIdToken();
    return { Authorization: "Bearer " + tok };
  } catch (e) {
    return {};
  }
}
import React, { useMemo, useState } from "react";
import { getAuthHeaders } from "../../firebaseAppCheck";

type NormalizedFile = {
  name?: string;
  filename?: string;
  originalName?: string;
  size?: number;
  contentType?: string;
  mime?: string;
  url?: string;
  downloadUrl?: string;
  href?: string;
  id?: string;
};

function asArray(v: any): any[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (Array.isArray(v.files)) return v.files;
  if (Array.isArray(v.items)) return v.items;
  if (Array.isArray(v.uploaded)) return v.uploaded;
  if (Array.isArray(v.results)) return v.results;
  return [];
}
  function pickUrl(f: NormalizedFile): string {
    const u = (f.downloadUrl || f.url || f.href || "").toString();
    if (!u) return "";
    if (/^https?:\/\//i.test(u)) return u;
    if (u.startsWith("/api/")) return u;
    if (u.startsWith("/")) return "/api" + u;
    return u;
  }
function pickName(f: NormalizedFile): string {
  return f.originalName || f.filename || f.name || f.id || "file";
}

export default function UploadPanel() {
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<NormalizedFile[]>([]);

  const selectedLabel = useMemo(() => {
    if (!files.length) return "No files selected";
    if (files.length === 1) return files[0].name;
    return `${files.length} files selected`;
  }, [files]);

  async function onUpload() {
    setError(null);
    setUploaded([]);

    if (!files.length) {
      setError("Select one or more files first.");
      return;
    }

    const form = new FormData();
    for (const f of files) form.append("files", f);

    setIsUploading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/upload-multi-fs", { method: "POST", body: form, headers });


      try {
        const listRes = await fetch("/api/baselines/fs?limit=200", { headers });
        const listJson = await listRes.json().catch(() => null);
        const items = normalizeFiles(listJson);
        if (Array.isArray(items)) setUploaded(items as any);
      } catch (e) {
        // ignore list failures here; upload already succeeded
      }



      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Upload failed (${res.status}). ${text}`.trim());
      }

      const json = await res.json().catch(() => ({}));
      const arr = asArray(json) as NormalizedFile[];
      setUploaded(arr.length ? arr : (json && typeof json === "object" ? [json as any] : []));
    } catch (e: any) {
      setError(e?.message || "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: 16 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Upload files</h2>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="file"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
          disabled={isUploading}
        />
        <button
          onClick={onUpload}
          disabled={isUploading || files.length === 0}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ccc",
            cursor: isUploading || files.length === 0 ? "not-allowed" : "pointer",
            fontWeight: 600
          }}
        >
          {isUploading ? "Uploading..." : "Upload"}
        </button>

        <span style={{ opacity: 0.8 }}>{selectedLabel}</span>
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #f3b4b4", borderRadius: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Error</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{error}</div>
        </div>
      )}

      {!!uploaded.length && (
        <div style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Uploaded</h3>
          <div style={{ border: "1px solid #ddd", borderRadius: 10, overflow: "hidden" }}>
            {uploaded.map((f, idx) => {
              const name = pickName(f);
              const url = pickUrl(f);
              const size = typeof f.size === "number" ? `${f.size.toLocaleString()} bytes` : "";
              const type = f.contentType || f.mime || "";
              return (
                <div
                  key={`${name}-${idx}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 12,
                    padding: 12,
                    borderTop: idx === 0 ? "none" : "1px solid #eee",
                    alignItems: "center"
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {name}
                    </div>
                    <div style={{ opacity: 0.75, fontSize: 13 }}>
                      {[type, size].filter(Boolean).join(" • ")}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {url ? (
                      <a href={url} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>
                        Download
                      </a>
                    ) : (
                      <span style={{ opacity: 0.6 }}>No link</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
