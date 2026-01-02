# Complete File Tree

```
ai-output-gate/
├── .editorconfig
├── .eslintrc.json
├── .github/
│   └── workflows/
│       ├── baseline-approval.yml
│       ├── ci.yml
│       ├── nightly-flake.yml
│       └── pr-gate.yml
├── .gitignore
├── .nvmrc
├── .prettierignore
├── .prettierrc.json
├── CHANGELOG.md
├── CONTRIBUTING.md
├── FILE_TREE.md
├── LICENSE
├── README.md
├── SCAFFOLD_COMPLETE.md
├── VERIFICATION.md
├── baselines/
│   ├── README.md
│   ├── manifest.json
│   ├── screen-01/
│   │   ├── baseline.png
│   │   └── screen.json
│   ├── screen-02/
│   │   ├── baseline.png
│   │   └── screen.json
│   └── ... (screen-03 through screen-20)
├── examples/
│   └── demo-app/
│       ├── ai-gate.config.json
│       ├── index.html
│       ├── package.json
│       ├── postcss.config.js
│       ├── screens.json
│       ├── src/
│       │   ├── App.tsx
│       │   ├── components/
│       │   │   ├── Banner.tsx
│       │   │   ├── Clock.tsx
│       │   │   ├── Layout.tsx
│       │   │   └── QuoteBlock.tsx
│       │   ├── index.css
│       │   ├── main.tsx
│       │   └── pages/
│       │       └── ScreenPage.tsx
│       ├── tailwind.config.js
│       ├── tsconfig.json
│       ├── tsconfig.node.json
│       └── vite.config.ts
├── package.json
├── packages/
│   ├── cli/
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── commands/
│   │   │   │   ├── baseline.test.ts
│   │   │   │   ├── baseline.ts
│   │   │   │   ├── gate.ts
│   │   │   │   └── masks.ts
│   │   │   ├── config.ts
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   └── core/
│       ├── package.json
│       ├── src/
│       │   ├── baseline.ts
│       │   ├── comparison.test.ts
│       │   ├── comparison.ts
│       │   ├── evidence.ts
│       │   ├── index.ts
│       │   ├── mask-suggester.ts
│       │   ├── policy.test.ts
│       │   ├── policy.ts
│       │   ├── report.ts
│       │   ├── screenshot.ts
│       │   └── types.ts
│       ├── tsconfig.json
│       └── vitest.config.ts
├── playwright.config.ts
├── pnpm-workspace.yaml
├── scripts/
│   ├── create-placeholder-baselines.ts
│   ├── generate-baselines.sh
│   ├── generate-demo-baselines.ts
│   ├── generate-screen-configs.ts
│   └── verify-setup.sh
├── tsconfig.base.json
└── tsconfig.json

runs/ (gitignored - created at runtime)
```

## File Count Summary

- **Root config files**: 11
- **Documentation files**: 7
- **GitHub Actions workflows**: 4
- **Core package files**: 12
- **CLI package files**: 9
- **Demo app files**: 27
- **Total**: ~70 files

## Key Files by Purpose

### Configuration & Setup
- `package.json` - Root workspace config
- `pnpm-workspace.yaml` - Workspace definition
- `tsconfig.json` / `tsconfig.base.json` - TypeScript config
- `.eslintrc.json` / `.prettierrc.json` - Code quality
- `playwright.config.ts` - Browser testing
- `.nvmrc` / `.editorconfig` - Environment setup

### Documentation
- `README.md` - Main documentation
- `VERIFICATION.md` - Setup checklist
- `CONTRIBUTING.md` - Contributor guide
- `SCAFFOLD_COMPLETE.md` - Completion summary
- `CHANGELOG.md` - Version history
- `FILE_TREE.md` - This file

### Core Implementation (Placeholders)
- `packages/core/src/screenshot.ts` - Playwright capture
- `packages/core/src/comparison.ts` - Pixelmatch diffing
- `packages/core/src/baseline.ts` - Baseline management
- `packages/core/src/policy.ts` - Threshold enforcement
- `packages/core/src/report.ts` - Report generation
- `packages/core/src/evidence.ts` - Evidence packs
- `packages/core/src/mask-suggester.ts` - Mask analysis

### CLI Commands
- `packages/cli/src/index.ts` - CLI entry point
- `packages/cli/src/commands/baseline.ts` - Baseline commands
- `packages/cli/src/commands/gate.ts` - Gate commands
- `packages/cli/src/commands/masks.ts` - Mask commands
- `packages/cli/src/config.ts` - Config loader

### CI/CD
- `.github/workflows/ci.yml` - Lint/test/build
- `.github/workflows/pr-gate.yml` - Visual regression
- `.github/workflows/baseline-approval.yml` - Baseline updates
- `.github/workflows/nightly-flake.yml` - Flake tracking
