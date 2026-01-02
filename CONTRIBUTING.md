# Contributing to AI Output Gate

## Development Setup

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Build packages:**
   ```bash
   pnpm build
   ```

3. **Run tests:**
   ```bash
   pnpm test
   ```

4. **Start demo app:**
   ```bash
   cd examples/demo-app
   pnpm dev
   ```

## Project Structure

```
├── packages/core       # Screenshot comparison engine
├── packages/cli        # Command-line interface
├── examples/demo-app   # Test harness with 20 routes
├── baselines/          # Baseline screenshots (checked in)
└── runs/               # Test runs (gitignored)
```

## Code Quality

- **Linting:** Run `pnpm lint` before committing
- **Formatting:** Run `pnpm format` to auto-format code
- **Type checking:** Run `pnpm typecheck` to verify TypeScript
- **Tests:** Add tests for new features in `*.test.ts` files

## TypeScript Project References

This monorepo uses TypeScript project references:
- `packages/cli` references `packages/core`
- Root `tsconfig.json` orchestrates all packages
- Run `pnpm typecheck` to verify all references

## Pull Request Guidelines

1. Fork the repo and create a feature branch
2. Make changes and add tests
3. Run `pnpm lint && pnpm typecheck && pnpm test`
4. Submit PR with clear description
5. CI will run visual gate and post results

## Commit Messages

Follow conventional commits:
- `feat: add new baseline command`
- `fix: correct threshold calculation`
- `docs: update README quickstart`
- `chore: update dependencies`

## Testing

- **Unit tests:** `pnpm test` (vitest)
- **Integration:** Run gate against demo app
- **Flake testing:** See `.github/workflows/nightly-flake.yml`

## Release Process

1. Update version in `package.json` files
2. Update `CHANGELOG.md`
3. Create git tag: `git tag v1.0.0`
4. Push tag: `git push --tags`
5. CI will publish packages
