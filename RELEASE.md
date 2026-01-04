# AI Gatekeeper - Release Checklist

This document outlines the process for creating a new release of the AI Gatekeeper CLI.

## Pre-Release Checklist

- [ ] All tests passing (`npm test` in packages/cli and packages/core)
- [ ] CHANGELOG.md updated with new version and changes
- [ ] Version bumped in `packages/cli/package.json`
- [ ] Documentation reviewed and updated if needed
- [ ] Local build and pack successful (`./scripts/release-cli.sh`)
- [ ] Manual verification completed:
  - [ ] Install from local tarball in a test project
  - [ ] Run `npx ai-gate --help` and verify output
  - [ ] Run `npx ai-gate run` against demo app or test fixture
  - [ ] Verify all CLI commands work as expected

## Release Process

### 1. Create and Push Git Tag

```bash
# Ensure you're on main branch with latest changes
git checkout main
git pull origin main

# Create annotated tag (replace X.Y.Z with version number)
git tag -a vX.Y.Z -m "Release vX.Y.Z"

# Push tag to trigger release workflow
git push origin vX.Y.Z
```

### 2. Monitor GitHub Actions

- Navigate to **Actions** tab in GitHub repository
- Watch the **Release CLI** workflow execution
- Verify all steps complete successfully:
  - Checkout code
  - Setup Node.js
  - Install dependencies
  - Build and pack CLI
  - Create GitHub Release

### 3. Verify GitHub Release

- Navigate to **Releases** page in GitHub repository
- Confirm new release is created with:
  - Correct version tag (vX.Y.Z)
  - Auto-generated release notes
  - Attached tarball artifact (`ai-gate-cli-X.Y.Z.tgz`)

### 4. Test Release Artifact

Download and test the released tarball:

```bash
# Create test directory
mkdir /tmp/test-ai-gate-release
cd /tmp/test-ai-gate-release

# Initialize npm project
npm init -y

# Install from GitHub Release (replace X.Y.Z and ORG/REPO)
npm install -D https://github.com/YOUR-ORG/ai-gatekeeper/releases/download/vX.Y.Z/ai-gate-cli-X.Y.Z.tgz

# Verify installation
npx ai-gate --version
npx ai-gate --help

# Test against a real project
npx ai-gate run --baseURL http://localhost:3000
```

### 5. Update Documentation (if needed)

If release introduces breaking changes or new features:

- [ ] Update CUSTOMER_INSTALL.md
- [ ] Update README.md
- [ ] Update examples/repo-b-template/README.md
- [ ] Update any relevant guides or tutorials

### 6. Announce Release (optional)

- [ ] Post in team Slack/Discord
- [ ] Update project README with latest version number
- [ ] Notify users via email/newsletter (if applicable)

## Post-Release Verification

Within 24 hours of release:

- [ ] Check GitHub Release download count
- [ ] Monitor GitHub Issues for installation problems
- [ ] Verify CI workflows using new release in customer repositories
- [ ] Test installation on multiple platforms (macOS, Linux, Windows)

## Rollback Procedure

If critical issues are found:

### Option 1: Delete Release and Tag

```bash
# Delete local tag
git tag -d vX.Y.Z

# Delete remote tag
git push origin :refs/tags/vX.Y.Z

# Delete GitHub Release manually via UI
```

### Option 2: Mark as Pre-release

- Edit the GitHub Release
- Check "Set as a pre-release"
- Add warning message to release notes

### Option 3: Hotfix Release

- Fix critical issue in new branch
- Bump version to vX.Y.Z+1
- Create new tag and release following normal process

## Common Issues

### Build Fails in CI

**Problem:** TypeScript compilation errors or test failures

**Solution:**
- Run `./scripts/release-cli.sh` locally to reproduce
- Fix build errors
- Delete tag and re-release with fixed version

### Tarball Not Attached to Release

**Problem:** GitHub Actions completes but no tarball artifact

**Solution:**
- Check workflow logs for `pack` step errors
- Verify `packages/cli/ai-gate-cli-*.tgz` is created
- Ensure `softprops/action-gh-release` has correct permissions

### Version Mismatch

**Problem:** Tarball filename doesn't match package.json version

**Solution:**
- Ensure `packages/cli/package.json` version is updated before tagging
- Tag name should match package version (v1.2.3 → 1.2.3 in package.json)

### Installation Fails from GitHub Release

**Problem:** `npm install` fails with tarball URL

**Solution:**
- Verify tarball URL is publicly accessible (check GitHub Release page)
- Ensure repository is public or user has access
- Check tarball integrity: download manually and inspect contents

## Emergency Contacts

- **Release Manager:** [Name/Email]
- **DevOps Lead:** [Name/Email]
- **GitHub Repository:** https://github.com/YOUR-ORG/ai-gatekeeper

## Release Frequency

- **Patch releases (vX.Y.Z):** As needed for critical bugs
- **Minor releases (vX.Y.0):** Monthly or when new features are ready
- **Major releases (vX.0.0):** Quarterly or for breaking changes
