# Baselines Directory

This directory contains baseline screenshots for visual regression testing.

## Structure

```
baselines/
├── manifest.json              # Index of all baselines with metadata
├── screen-01/
│   ├── baseline.png          # Reference screenshot
│   └── screen.json           # Screen config (masks, thresholds, etc.)
├── screen-02/
│   ├── baseline.png
│   └── screen.json
└── ...
```

## Generating Baselines

To generate actual baseline screenshots, run:

```bash
# From repository root
pnpm install
pnpm build
pnpm generate:baselines
```

This will:
1. Start the demo app on http://localhost:5173
2. Capture screenshots of all 20 routes
3. Create baseline.png files in each screen directory
4. Update manifest.json with actual SHA-256 hashes
5. Stop the demo app

## Placeholder Files

The current baseline.png files are placeholders. To generate real screenshots:
- Run `pnpm generate:baselines` from the repository root
- This requires Node.js 18+ and pnpm 8+

## Mask Configuration

Each screen.json file can include:
- `masks`: Array of CSS selectors to mask dynamic content (clock, quotes, etc.)
- `viewport`: Override default viewport dimensions
- `thresholds`: Custom pixel diff thresholds
- `tags`: Categorization tags

Example screen.json:
```json
{
  "name": "Screen 01",
  "url": "/screen-01",
  "tags": ["with-banner"],
  "masks": [
    {
      "type": "css",
      "selector": "[data-testid=\"clock\"]"
    }
  ]
}
```
