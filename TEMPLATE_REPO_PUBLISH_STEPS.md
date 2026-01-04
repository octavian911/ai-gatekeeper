# Template Repository Publishing Steps

This document contains step-by-step instructions for manually publishing the AI Gatekeeper Next.js template to GitHub.

## Repository Details

- **Organization**: AI-Gatekeeper
- **Repository Name**: ai-gate-template-nextjs
- **Visibility**: Public
- **Template Repository**: Enabled
- **URL**: https://github.com/AI-Gatekeeper/ai-gate-template-nextjs

## Publishing Steps

### Method 1: GitHub Web UI (Easiest)

#### Step 1: Create the Repository

1. Go to https://github.com/organizations/AI-Gatekeeper/repositories/new
2. Set **Repository name**: `ai-gate-template-nextjs`
3. Set **Description**: `Next.js template with AI Gatekeeper visual regression testing pre-configured`
4. Set visibility to **Public**
5. **Do NOT** initialize with README, .gitignore, or license (we'll upload our own)
6. Click **"Create repository"**

#### Step 2: Enable Template Repository

1. Go to repository **Settings** → **General**
2. Scroll to **Template repository** section
3. Check ✅ **"Template repository"**
4. Save changes

#### Step 3: Upload Files via Web UI

1. On the repository home page, click **"uploading an existing file"** link
2. Drag and drop ALL files from `examples/repo-b-template/` including:
   - `README.md`
   - `ai-gate.config.json`
   - `package.json`
   - `next.config.js`
   - `tsconfig.json`
   - `app/` folder (with all subfolders)
   - `baselines/` folder (with all subfolders and PNG files)
   - `scripts/` folder (with all scripts)
   - `.github/workflows/ai-gate.yml` (note: `.github` is hidden, you may need to create this path manually)

3. For the `.github/workflows/ai-gate.yml` file:
   - Click **"Add file"** → **"Create new file"**
   - Name it `.github/workflows/ai-gate.yml`
   - Copy contents from `examples/repo-b-template/.github/workflows/ai-gate.yml`
   - Commit

4. Commit message: `Initial commit: Next.js template with AI Gatekeeper`
5. Click **"Commit changes"**

### Method 2: Git Command Line (Recommended)

#### Step 1: Create the Repository

1. Go to https://github.com/organizations/AI-Gatekeeper/repositories/new
2. Set **Repository name**: `ai-gate-template-nextjs`
3. Set **Description**: `Next.js template with AI Gatekeeper visual regression testing pre-configured`
4. Set visibility to **Public**
5. **Do NOT** initialize with README
6. Click **"Create repository"**

#### Step 2: Use the Export Script

Run the provided export script from this repository:

```bash
# From the ai-gatekeeper repository root
./scripts/export-template-repo.sh
```

This will:
- Create `/tmp/ai-gate-template-nextjs/` with all template files
- Print the exact commands to initialize git and push

#### Step 3: Initialize Git and Push

Follow the commands printed by the export script (or run these manually):

```bash
cd /tmp/ai-gate-template-nextjs

# Initialize git
git init
git add .
git commit -m "Initial commit: Next.js template with AI Gatekeeper"

# Add remote and push
git remote add origin https://github.com/AI-Gatekeeper/ai-gate-template-nextjs.git
git branch -M main
git push -u origin main
```

#### Step 4: Enable Template Repository

1. Go to https://github.com/AI-Gatekeeper/ai-gate-template-nextjs/settings
2. Scroll to **Template repository** section
3. Check ✅ **"Template repository"**
4. Save changes

## Verification Checklist

After publishing, verify the following:

### ✅ Repository Configuration
- [ ] Repository is public at https://github.com/AI-Gatekeeper/ai-gate-template-nextjs
- [ ] **"Use this template"** button appears at the top of the repository
- [ ] Repository description is set correctly
- [ ] Template repository option is enabled in settings

### ✅ File Structure
- [ ] README.md is displayed on repository home page
- [ ] `.github/workflows/ai-gate.yml` exists and is visible
- [ ] `baselines/manifest.json` exists
- [ ] `baselines/login/baseline.png` exists
- [ ] `baselines/pricing/baseline.png` exists
- [ ] `scripts/break-ui.sh` exists and is executable
- [ ] `scripts/restore-ui.sh` exists and is executable
- [ ] `scripts/run-visual-test.sh` exists and is executable
- [ ] `ai-gate.config.json` exists
- [ ] `app/login/page.tsx` exists
- [ ] `app/pricing/page.tsx` exists
- [ ] `app/layout.tsx` exists
- [ ] `package.json` exists
- [ ] `next.config.js` exists
- [ ] `tsconfig.json` exists

### ✅ README Quality
- [ ] "Use this template" badge is visible
- [ ] Quick start instructions are clear
- [ ] Installation steps are complete
- [ ] "Test a Failure" section works
- [ ] GitHub Actions section explains how to view artifacts
- [ ] No broken links

### ✅ GitHub Actions Workflow
- [ ] Workflow file exists at `.github/workflows/ai-gate.yml`
- [ ] Workflow is valid YAML (check Actions tab)
- [ ] No secrets required
- [ ] Artifact upload is configured

### ✅ Test the Template
- [ ] Click **"Use this template"** button
- [ ] Create a test repository from the template
- [ ] Clone the test repository
- [ ] Run `npm ci` successfully
- [ ] Run `npx playwright install chromium --with-deps` successfully
- [ ] Run `npm run build` successfully
- [ ] Run `npm run test:visual` and verify it passes
- [ ] Run `./scripts/break-ui.sh` and `npm run test:visual` to verify failure detection
- [ ] Run `./scripts/restore-ui.sh` and verify tests pass again
- [ ] Delete the test repository

### ✅ App Integration
- [ ] Open AI Gatekeeper app at the preview URL
- [ ] Click **"Docs"** dropdown in top navigation
- [ ] Click **"Template repo"** menu item
- [ ] Verify it opens https://github.com/AI-Gatekeeper/ai-gate-template-nextjs in a new tab
- [ ] Verify no 404 error
- [ ] Navigate to **"Install in your repo"** docs page
- [ ] Verify the template repo is referenced correctly (if applicable)

## Post-Publishing Tasks

### Add Topics/Tags (Optional)

1. Go to repository home page
2. Click ⚙️ icon next to "About"
3. Add topics:
   - `nextjs`
   - `visual-regression-testing`
   - `ai-gatekeeper`
   - `playwright`
   - `template`
   - `github-actions`
   - `ci-cd`

### Add License (Optional)

If not already included:
1. Create new file `LICENSE`
2. Choose MIT License (or appropriate license)
3. Commit

### Pin Repository (Optional)

1. Go to https://github.com/AI-Gatekeeper
2. Click **"Customize your pins"**
3. Select `ai-gate-template-nextjs`
4. Save

## Troubleshooting

### "Use this template" button doesn't appear
- Ensure "Template repository" is enabled in Settings → General
- Refresh the page after enabling

### .github folder not visible when uploading via web UI
- Create the file path manually: `.github/workflows/ai-gate.yml`
- GitHub will automatically create the folders

### Images not displaying in README
- Ensure PNG files are uploaded to correct paths
- Verify file names match manifest.json entries

### Workflow doesn't run
- Check Actions tab is enabled in Settings → Actions
- Verify YAML syntax at https://www.yamllint.com/
- Check indentation (use 2 spaces, not tabs)

### Permission denied when running scripts
- Scripts may need executable permissions
- Add note in README to run `chmod +x scripts/*.sh`

## Support

If you encounter issues during publishing:
1. Check repository settings carefully
2. Verify all files are in the correct locations
3. Test the template by using it to create a new repository
4. Update this document with any missing steps or issues encountered
