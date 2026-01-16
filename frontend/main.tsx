
// __AGK_FETCH_SHIM_V1__
// Global fetch shim to (1) normalize "/api/api/..." -> "/api/..."
// and (2) auto-attach Firebase Bearer token for same-origin "/api/*" requests.
(function installAgkFetchShim(){
  try {
    const _fetch = window.fetch.bind(window);

    const normalizeUrl = (u) => {
      if (typeof u !== "string") return u;
      // Only touch same-origin path requests
      if (u.startsWith("/api/api/")) return u.replace(/^\/api\/api\//, "/api/");
      return u;
    };

    const getBearer = async () => {
      try {
        const mod = await import("firebase/auth");
        const auth = mod.getAuth();
        const deadline = Date.now() + 6000;
        while (!auth.currentUser && Date.now() < deadline) {
          await new Promise(r => setTimeout(r, 200));
        }
        if (!auth.currentUser) return null;
        const tok = await auth.currentUser.getIdToken();
        return tok ? ("Bearer " + tok) : null;
      } catch (e) {
        return null;
      }
    };

    window.fetch = async (input, init) => {
      try {
        // Normalize URL whether string or Request
        let url = input;
        let req = null;

        if (input instanceof Request) {
          url = normalizeUrl(input.url);
          req = input;
        } else if (typeof input === "string") {
          url = normalizeUrl(input);
        }

        // Only attach auth for same-origin "/api/" calls
        const isApi =
          (typeof url === "string" && url.startsWith("/api/")) ||
          (typeof url === "string" && url.includes(location.origin + "/api/"));

        if (!isApi) return _fetch(input, init);

        // Merge headers safely
        const headers = new Headers((init && init.headers) || (req && req.headers) || {});
        if (!headers.get("Authorization")) {
          const bearer = await getBearer();
          if (bearer) headers.set("Authorization", bearer);
        }

        // Rebuild request/init
        if (req) {
          const newReq = new Request(url, req);
          return _fetch(newReq, { ...(init || {}), headers });
        }
        return _fetch(url, { ...(init || {}), headers });
      } catch (e) {
        return _fetch(input, init);
      }
    };

    console.log("[AGK] fetch shim installed");
  } catch (e) {}
})();
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { initAppCheck, ensureSignedIn } from "./firebaseAppCheck";

if (import.meta.env.DEV) {
  (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

try {
  initAppCheck();
} catch (e) {
  console.warn("initAppCheck failed:", e);
}

ensureSignedIn()
  .catch((e) =>
    console.warn("Anonymous sign-in failed (enable it in Firebase Console):", e)
  )
  .finally(() => {
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  });
