#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ai-gatekeeper-ea724}"
ROOT_DIR="${ROOT_DIR:-$HOME/ai-gatekeeper}"
FUNCTIONS_DIR="${FUNCTIONS_DIR:-$ROOT_DIR/functions}"
INDEX_TS="${INDEX_TS:-$FUNCTIONS_DIR/src/index.ts}"

die(){ echo "ERROR: $*" >&2; exit 1; }
note(){ echo -e "\n== $* =="; }

[[ -d "$FUNCTIONS_DIR" ]] || die "Missing: $FUNCTIONS_DIR"
[[ -f "$INDEX_TS" ]] || die "Missing: $INDEX_TS"

note "Task 3B: Fix functions lint (no-multiple-empty-lines) + deploy functions:api"
echo "PROJECT_ID: $PROJECT_ID"
echo "INDEX_TS:   $INDEX_TS"

note "1) Backup index.ts"
TS="$(date +%Y%m%d-%H%M%S)"
cp -v "$INDEX_TS" "$INDEX_TS.bak.$TS"

note "2) Collapse excessive blank lines in index.ts (max 2 in a row)"
node - "$INDEX_TS" <<'NODE'
const fs = require("fs");
const file = process.argv[2];
let s = fs.readFileSync(file, "utf8");

// replace 3+ consecutive newlines with exactly 2
s = s.replace(/\n{3,}/g, "\n\n");

fs.writeFileSync(file, s, "utf8");
console.log("✅ Collapsed multiple empty lines.");
NODE

note "3) Run lint --fix (so predeploy lint passes)"
# add --fix to the existing lint script command
npm --prefix "$FUNCTIONS_DIR" run lint -- --fix

note "4) Verify lint is clean (this must pass or deploy will fail again)"
npm --prefix "$FUNCTIONS_DIR" run lint

note "5) Deploy functions:api"
npx -y firebase-tools deploy --only functions:api --project "$PROJECT_ID"

note "DONE ✅"
