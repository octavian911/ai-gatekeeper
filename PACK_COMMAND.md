# Gate Pack Command

## Overview

The `gate pack` command generates a comprehensive evidence package from a gate run, bundled as a ZIP file for easy distribution and archival.

## Usage

```bash
gate pack --runId <id> --out evidence.zip
```

### Options

- `--runId <id>`: Specify which run to pack (default: `latest`)
- `--out <path>`: Output path for the evidence ZIP (default: `evidence.zip` in run directory)

### Examples

```bash
# Pack the latest run
gate pack

# Pack a specific run
gate pack --runId run-1234567890

# Pack to a custom location
gate pack --runId run-1234567890 --out /path/to/evidence.zip
```

## Evidence Package Contents

The evidence.zip file contains:

### 1. `report.html`
Interactive HTML report with visual comparisons and metrics.

### 2. `summary.json`
JSON summary of the gate run with all comparison results.

### 3. Per-Screen Files
- `actual/*.png` - Actual screenshots from the run
- `diff/*.png` - Diff images highlighting differences (for failed screens)
- `actual/*.result.json` - Per-screen result metadata (if available)
- `diff/*.result.json` - Per-diff result metadata (if available)

### 4. `MANIFEST.sha256`
SHA-256 hash listing for all files in the package. Each line follows the format:
```
<sha256-hash>  <file-path>
```

This allows verification of file integrity.

### 5. `DECISION.md`
Comprehensive decision document containing:

#### Run Metadata
- Run ID
- Timestamp
- Git SHA (if available)
- Git Branch (if available)

#### Thresholds
Global and per-screen threshold configuration used for the run.

#### Screen Results Table
| Screen ID | Route | Originality % | Status |
|-----------|-------|---------------|--------|
| screen-1  | /home | 99.95%        | PASS   |
| screen-2  | /about| 94.50%        | FAIL   |

#### Notes Section
Any errors encountered during the run are documented here.

## Verification

To verify the integrity of files in the evidence package:

```bash
# Extract the evidence package
unzip evidence.zip -d evidence/

# Verify hashes
cd evidence
sha256sum -c MANIFEST.sha256
```

All file hashes should match the manifest.

## Use Cases

1. **Archival**: Store evidence packages for compliance and audit purposes
2. **Sharing**: Share complete test results with team members or stakeholders
3. **CI/CD**: Archive evidence as build artifacts for traceability
4. **Debugging**: Package all relevant files for debugging failed gate runs

## Implementation Notes

- The pack command reads the run directory structure created by `gate run`
- Git information is automatically included if the command is run in a git repository
- Files are compressed using ZIP level 9 for maximum compression
- The manifest is always sorted alphabetically by file path for consistency
