#!/bin/bash

set -e

echo "📝 Creating placeholder baseline.png files..."

cd "$(dirname "$0")/.."

for i in {01..20}; do
  screen_dir="baselines/screen-$i"
  mkdir -p "$screen_dir"
  
  if [ ! -f "$screen_dir/baseline.png" ]; then
    convert -size 1280x720 xc:gray "$screen_dir/baseline.png" 2>/dev/null || \
    printf '\x89\x50\x4e\x47\x0d\x0a\x1a\x0a\x00\x00\x00\x0d\x49\x48\x44\x52\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90\x77\x53\xde\x00\x00\x00\x0c\x49\x44\x41\x54\x08\x99\x63\x60\x60\x60\x00\x00\x00\x04\x00\x01\x27\x6f\xb0\x67\x00\x00\x00\x00\x49\x45\x4e\x44\xae\x42\x60\x82' > "$screen_dir/baseline.png"
    echo "  ✓ Created $screen_dir/baseline.png"
  fi
done

echo "✅ All placeholder baseline.png files created"
echo "📌 Run 'pnpm generate:baselines' to capture actual screenshots"
