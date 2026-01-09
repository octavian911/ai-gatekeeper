#!/usr/bin/env bash
set -euo pipefail

TARGET="https://ai-gatekeeper.ca"
OUTDIR="security-reports/ai-gatekeeper-ca"
mkdir -p "$OUTDIR"

echo "==> 1) Final URL + headers (follow redirects)"
curl -sIL "$TARGET" | tee "$OUTDIR/headers.txt" >/dev/null

echo
echo "==> 2) Security headers snapshot"
curl -sIL "$TARGET" | egrep -i \
"^http/|^location:|content-security-policy|strict-transport-security|x-frame-options|x-content-type-options|referrer-policy|permissions-policy|cross-origin|cache-control" \
| tee "$OUTDIR/security-headers-only.txt" >/dev/null || true

echo
echo "==> 3) TLS certificate info"
echo | openssl s_client -connect ai-gatekeeper.ca:443 -servername ai-gatekeeper.ca 2>/dev/null \
  | openssl x509 -noout -issuer -subject -dates \
  | tee "$OUTDIR/tls-cert.txt" >/dev/null

echo
echo "==> 4) TLS scan (testssl) - can take a bit"
testssl --quiet --warnings batch ai-gatekeeper.ca | tee "$OUTDIR/testssl.txt" >/dev/null || true

echo
echo "==> 5) Nmap TLS scripts (ssl-cert + ciphers)"
nmap -Pn -p 443 --script ssl-cert,ssl-enum-ciphers ai-gatekeeper.ca \
  | tee "$OUTDIR/nmap-ssl.txt" >/dev/null || true

echo
echo "==> 6) Nikto web scan (lightweight web misconfig checks)"
nikto -h "$TARGET" -Tuning x 2>&1 | tee "$OUTDIR/nikto.txt" >/dev/null || true

echo
echo "DONE. Reports in: $OUTDIR"
