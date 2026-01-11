import React, { useMemo, useState } from "react";
import { getIdTokenOrNull } from "../../firebaseAppCheck";

type UploadFile = {
  fieldname: string;
  originalname: string;
  mimetype: string;
  size: number;
  object: string;
  downloadPath: string;
};

type UploadResponse =
  | { ok: true; count: number; files: UploadFile[] }
  | { ok: false; error: string; message?: string };

export default function UploadPanel() {
  const [picked, setPicked] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<UploadFile[]>([]);

  // If VITE_API_BASE is "", it uses same-origin (good for Hosting rewrite /api/*)
  const apiBase = useMemo(() => ((import.meta as any).env?.VITE_API_BASE || ""), []);

  const onPick: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const list = e.target.files ? Array.from(e.target.files) : [];
    setPicked(list);
    setErr(null);
  };

  async function requireToken(): Promise<string> {
    const token = await getIdTokenOrNull();
    if (!token) {
      throw new Error(
        "Missing Firebase Auth token. Enable Anonymous Auth (Firebase Console → Auth → Sign-in method) or implement real sign-in."
      );
    }
    return token;
  }

  const doUpload = async () => {
    setErr(null);
    setBusy(true);
    try {
      if (!picked.length) {
        setErr("Pick at least one file.");
        return;
      }

      const token = await requireToken();

      const fd = new FormData();
      for (const f of picked) fd.append("files", f);

      const res = await fetch(`${apiBase}/api/upload-multi-fs`, {
        method: "POST",
        body: fd,
        credentials: "include",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = (await res.json()) as UploadResponse;

      if (!data || (data as any).ok !== true) {
        const msg = (data as any)?.message || (data as any)?.error || "Upload failed";
        throw new Error(`${res.status} ${msg}`);
      }

      setUploaded((data as any).files);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const doDownload = async (downloadPath: string, filename?: string) => {
    setErr(null);
    setBusy(true);
    try {
      const token = await requireToken();
      const url = `${apiBase}${downloadPath}`;

      const res = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`${res.status} download failed ${txt}`);
      }

      const blob = await res.blob();
      const a = document.createElement("a");
      const objUrl = URL.createObjectURL(blob);
      a.href = objUrl;
      a.download = filename || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, maxWidth: 720 }}>
      <h3 style={{ marginTop: 0 }}>Upload baseline files</h3>

      <input type="file" multiple onChange={onPick} />

      <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
        <button onClick={doUpload} disabled={busy || picked.length === 0}>
          {busy ? "Working..." : "Upload"}
        </button>

        <div style={{ fontSize: 12, opacity: 0.8 }}>
          Endpoint: <code>{apiBase || "(same-origin)"}/api/upload-multi-fs</code>
        </div>
      </div>

      {err && (
        <div style={{ marginTop: 12, color: "crimson", whiteSpace: "pre-wrap" }}>
          {err}
        </div>
      )}

      {uploaded.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4>Uploaded</h4>
          <ul style={{ paddingLeft: 18 }}>
            {uploaded.map((f) => (
              <li key={f.object} style={{ marginBottom: 10 }}>
                <div>
                  <strong>{f.originalname}</strong>{" "}
                  <span style={{ opacity: 0.7, fontSize: 12 }}>
                    ({f.mimetype}, {f.size} bytes)
                  </span>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button onClick={() => doDownload(f.downloadPath, f.originalname)} disabled={busy}>
                    Download
                  </button>
                  <code style={{ fontSize: 12, opacity: 0.8 }}>{f.object}</code>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
