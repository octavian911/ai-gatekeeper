# Template Repository Setup Guide

This guide provides exact steps to create `ai-gate-template-nextjs` as a standalone public repository from the existing `repo-b-template` example.

## Overview

The template repository serves as a turnkey starting point for developers who want to add AI Gatekeeper visual regression testing to their Next.js projects. It includes:
- Working Next.js application with 2 sample routes
- Pre-configured baselines and manifest
- GitHub Actions workflow for CI integration
- Shell scripts for automated testing
- Complete documentation

## Prerequisites

- GitHub account with permissions to create public repositories
- Git CLI installed locally
- Node.js 20+ installed (for verification)

## Step 1: Create New Repository on GitHub

1. Go to https://github.com/new
2. Set repository name: `ai-gate-template-nextjs`
3. Set description: `Next.js template with AI Gatekeeper visual regression testing pre-configured`
4. Set visibility: **Public**
5. **Do NOT** initialize with README, .gitignore, or license
6. Click **Create repository**
7. Note the repository URL: `https://github.com/YOUR-ORG/ai-gate-template-nextjs.git`

## Step 2: Prepare Source Directory

Navigate to the existing `repo-b-template` in your AI Gatekeeper monorepo:

```bash
cd /path/to/ai-gatekeeper/examples/repo-b-template
```

Verify all required files exist:

```bash
ls -la
# Should show: app/, baselines/, scripts/, ai-gate.config.json, package.json, README.md
```

## Step 3: Initialize Git in Template Directory

**Important:** Initialize a fresh Git repository in this directory (separate from the monorepo):

```bash
# Create temporary staging directory
cd ..
cp -r repo-b-template ai-gate-template-nextjs-staging
cd ai-gate-template-nextjs-staging

# Initialize new Git repository
git init
```

## Step 4: Copy Required Files

Ensure the following structure exists:

```
.
├── .github/
│   └── workflows/
│       └── ai-gate.yml
├── app/
│   ├── layout.tsx
│   ├── login/
│   │   └── page.tsx
│   └── pricing/
│       └── page.tsx
├── baselines/
│   ├── manifest.json
│   ├── login/
│   │   └── baseline.png
│   └── pricing/
│       └── baseline.png
├── scripts/
│   ├── break-ui.sh
│   ├── restore-ui.sh
│   └── run-visual-test.sh
├── .gitignore
├── ai-gate.config.json
├── next.config.js
├── package.json
├── README.md
└── tsconfig.json
```

Create `.github/workflows/` directory:

```bash
mkdir -p .github/workflows
```

Copy the GitHub Actions workflow:

```bash
cp /path/to/ai-gatekeeper/docs/github-actions/ai-gate.yml .github/workflows/
```

Create `.gitignore` file:

```bash
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
package-lock.json

# Next.js
.next/
out/
build/

# AI Gatekeeper
.ai-gate/

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/

# Logs
*.log
npm-debug.log*

# Temporary files
tmp/
.tmp/
EOF
```

Make scripts executable:

```bash
chmod +x scripts/*.sh
```

## Step 5: Update package.json

Edit `package.json` to reflect standalone repository:

```json
{
  "name": "ai-gate-template-nextjs",
  "version": "1.0.0",
  "description": "Next.js template with AI Gatekeeper visual regression testing",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test:visual": "./scripts/run-visual-test.sh"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.12.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.4.0",
    "wait-on": "^7.2.0"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

## Step 6: Update README.md

Replace placeholder URLs in `README.md`:

```bash
# Replace YOUR-ORG with your actual GitHub organization/username
sed -i 's/YOUR-ORG/your-github-org/g' README.md
```

Verify the following sections are customer-facing:
- Installation instructions (MODE A, MODE B, MODE C)
- Quick Start (5 steps)
- GitHub Actions integration
- Testing CI failures demo
- Troubleshooting

## Step 7: Create LICENSE File

Add MIT license:

```bash
cat > LICENSE << 'EOF'
MIT License

Copyright (c) 2026 AI Gatekeeper

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF
```

## Step 8: Commit All Files

```bash
git add .
git commit -m "Initial commit: Next.js template with AI Gatekeeper visual regression testing"
```

## Step 9: Push to GitHub

```bash
git remote add origin https://github.com/YOUR-ORG/ai-gate-template-nextjs.git
git branch -M main
git push -u origin main
```

## Step 10: Configure Repository Settings

On GitHub repository page:

### General Settings
1. Go to **Settings** → **General**
2. Under **Features**, enable:
   - ✅ Issues
   - ✅ Discussions (optional)
3. Under **Pull Requests**, enable:
   - ✅ Allow squash merging
   - ✅ Automatically delete head branches

### About Section
1. Click the ⚙️ icon next to **About**
2. Add description: `Next.js template with AI Gatekeeper visual regression testing pre-configured`
3. Add website: `https://ai-gatekeeper.dev` (or your docs site)
4. Add topics: `nextjs`, `visual-regression`, `testing`, `ai`, `template`
5. Check **Use this template** → **Template repository** ✅
6. Save changes

### Topics/Tags
Add these topics to improve discoverability:
- `nextjs`
- `visual-regression-testing`
- `visual-testing`
- `ai-gatekeeper`
- `screenshot-testing`
- `ui-testing`
- `github-actions`
- `template-repository`

## Step 11: Add Repository README Badge

Add status badge at the top of `README.md`:

```markdown
# AI Gatekeeper - Next.js Template

[![CI](https://github.com/YOUR-ORG/ai-gate-template-nextjs/actions/workflows/ai-gate.yml/badge.svg)](https://github.com/YOUR-ORG/ai-gate-template-nextjs/actions/workflows/ai-gate.yml)

This is a standalone Next.js application demonstrating...
```

Commit and push:

```bash
git add README.md
git commit -m "Add CI status badge"
git push
```

## Step 12: Verify Template Works

Test the "Use this template" flow:

1. Click **Use this template** → **Create a new repository**
2. Name it: `test-ai-gate-template`
3. Clone the new repository locally
4. Follow the Quick Start instructions from README:

```bash
cd test-ai-gate-template
npm ci
npx playwright install chromium --with-deps
npm run build
npm run test:visual
```

Expected output:
```
✓ login passed
✓ pricing passed
All 2 screens passed
```

5. Delete the test repository if verification succeeds

## Step 13: Create Release (Optional)

Tag the initial release:

```bash
git tag -a v1.0.0 -m "Initial release: Next.js template with AI Gatekeeper"
git push origin v1.0.0
```

On GitHub:
1. Go to **Releases** → **Draft a new release**
2. Choose tag: `v1.0.0`
3. Title: `v1.0.0 - Initial Release`
4. Description:
```markdown
## 🚀 Initial Release

Next.js template with AI Gatekeeper visual regression testing pre-configured.

### Features
- ✅ Next.js 14 with TypeScript
- ✅ 2 sample routes (login, pricing)
- ✅ Pre-configured baselines and manifest
- ✅ GitHub Actions workflow for CI
- ✅ Automated test runner script
- ✅ Complete documentation

### Quick Start
See [README.md](README.md) for installation and usage instructions.

### Installation Modes
- **MODE A**: Published npm package (recommended)
- **MODE B**: GitHub release tarball
- **MODE C**: Local development

For details, see the Installation section in README.md.
```
5. Check **Set as the latest release**
6. Click **Publish release**

## Step 14: Update Main Repository Documentation

Add reference to template in main AI Gatekeeper repository README:

```markdown
## Quick Start Templates

Get started instantly with our pre-configured templates:

- **Next.js**: [ai-gate-template-nextjs](https://github.com/YOUR-ORG/ai-gate-template-nextjs)
- More frameworks coming soon...
```

## Post-Setup Checklist

After completing all steps, verify:

- ✅ Repository is public and visible
- ✅ "Use this template" button appears
- ✅ README renders correctly with all sections
- ✅ GitHub Actions workflow file exists at `.github/workflows/ai-gate.yml`
- ✅ Baseline images exist in `baselines/login/` and `baselines/pricing/`
- ✅ Scripts are executable (`chmod +x scripts/*.sh`)
- ✅ Topics/tags are set for discoverability
- ✅ License file exists
- ✅ CI badge appears in README
- ✅ Template creation test passed (Step 12)

## Maintenance

### Updating the Template

When AI Gatekeeper has breaking changes or improvements:

1. Clone the template repository
2. Make necessary updates (config, dependencies, scripts)
3. Test locally using `npm run test:visual`
4. Update README with migration notes if needed
5. Commit and push changes
6. Create new release with changelog

### Syncing from Monorepo

If `repo-b-template` receives updates:

```bash
# In monorepo
cd examples/repo-b-template

# Copy changes to template staging
rsync -av --exclude='.git' --exclude='node_modules' ./ /path/to/ai-gate-template-nextjs-staging/

# Review changes
cd /path/to/ai-gate-template-nextjs-staging
git status
git diff

# Commit if appropriate
git add .
git commit -m "Sync updates from monorepo repo-b-template"
git push
```

## Support

For questions about template repository setup, see the main AI Gatekeeper documentation or open an issue.

## Reference URLs

- Main Repository: `https://github.com/YOUR-ORG/ai-gatekeeper`
- Template Repository: `https://github.com/YOUR-ORG/ai-gate-template-nextjs`
- Documentation Site: `https://ai-gatekeeper.dev`
- npm Package: `https://www.npmjs.com/package/@ai-gate/cli`
