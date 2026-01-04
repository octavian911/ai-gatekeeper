import { CheckCircle, AlertTriangle, XCircle, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function ReviewerDocsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <button
          onClick={() => navigate("/baselines")}
          className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-950 rounded px-2 py-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Baselines</span>
        </button>
        <h1 className="text-4xl font-bold text-white mb-6">Reviewer Guide</h1>
        <p className="text-lg text-gray-300 mb-8">
          How to review visual diffs and understand AI Gatekeeper results
        </p>

        <div className="space-y-8">
          <section className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-4">Understanding Status Indicators</h2>
            <p className="text-gray-300 mb-6">
              AI Gatekeeper uses a three-tier system to classify visual differences:
            </p>

            <div className="space-y-4">
              <div className="bg-green-900 border border-green-600 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                  <h3 className="text-xl font-bold text-green-200">Green (PASS)</h3>
                </div>
                <p className="text-green-100 mb-2">
                  <strong>Meaning:</strong> No significant visual changes detected. The UI matches the baseline.
                </p>
                <p className="text-green-200 text-sm">
                  <strong>Action:</strong> No review needed. Changes are purely backend/logic or have no visual impact.
                </p>
                <p className="text-green-300 text-sm mt-2">
                  <strong>Threshold:</strong> Less than 0.02% pixel difference (typically &lt;250 pixels on standard screens)
                </p>
              </div>

              <div className="bg-yellow-900 border border-yellow-600 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <AlertTriangle className="w-6 h-6 text-yellow-400" />
                  <h3 className="text-xl font-bold text-yellow-200">Yellow (WARN)</h3>
                </div>
                <p className="text-yellow-100 mb-2">
                  <strong>Meaning:</strong> Minor visual differences detected. May be intentional or a subtle bug.
                </p>
                <p className="text-yellow-200 text-sm">
                  <strong>Action:</strong> Review the diff images. If changes are intentional (e.g., spacing tweaks, color adjustments), approve the PR and update baselines. If unintended, request fixes.
                </p>
                <p className="text-yellow-300 text-sm mt-2">
                  <strong>Threshold:</strong> Between 0.02% and 0.05% pixel difference (250-600 pixels on standard screens)
                </p>
              </div>

              <div className="bg-red-900 border border-red-600 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <XCircle className="w-6 h-6 text-red-400" />
                  <h3 className="text-xl font-bold text-red-200">Red (FAIL)</h3>
                </div>
                <p className="text-red-100 mb-2">
                  <strong>Meaning:</strong> Significant visual drift detected. Likely unintended changes from AI code generation.
                </p>
                <p className="text-red-200 text-sm">
                  <strong>Action:</strong> Review the diff carefully. This usually indicates a bug, broken layout, or major styling regression. Request fixes unless the changes are intentional redesigns.
                </p>
                <p className="text-red-300 text-sm mt-2">
                  <strong>Threshold:</strong> 0.05% or more pixel difference (≥600 pixels on standard screens)
                </p>
              </div>
            </div>
          </section>

          <section className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-4">What is "Originality %"?</h2>
            <p className="text-gray-300 mb-4">
              Originality shows how similar the current screenshot is to the baseline:
            </p>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">•</span>
                <span><strong className="text-white">100%</strong> = Perfect match, no visual changes</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400 mt-1">•</span>
                <span><strong className="text-white">99.95%</strong> = Very minor differences (WARN range)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-1">•</span>
                <span><strong className="text-white">99.90% or lower</strong> = Significant changes (FAIL range)</span>
              </li>
            </ul>
            <div className="bg-gray-900 border border-gray-600 rounded-lg p-4 mt-4">
              <p className="text-gray-400 text-sm">
                <strong>Example:</strong> A screen showing 99.92% originality means 0.08% of pixels changed.
                On a 1280×720 screen (921,600 total pixels), this equals approximately 737 different pixels.
              </p>
            </div>
          </section>

          <section className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-4">How to Download Evidence from GitHub</h2>
            <p className="text-gray-300 mb-4">
              When a PR triggers the visual gate, evidence is uploaded as a GitHub Actions artifact:
            </p>
            <ol className="list-decimal list-inside text-gray-300 space-y-3 ml-4">
              <li>
                <strong className="text-white">Go to the PR's "Checks" tab</strong>
                <p className="text-sm text-gray-400 ml-6 mt-1">
                  Click on the "Checks" tab at the top of the pull request page
                </p>
              </li>
              <li>
                <strong className="text-white">Find the workflow that ran visual tests</strong>
                <p className="text-sm text-gray-400 ml-6 mt-1">
                  Look for a workflow named "Visual Regression Gate" or similar
                </p>
              </li>
              <li>
                <strong className="text-white">Scroll to the "Artifacts" section</strong>
                <p className="text-sm text-gray-400 ml-6 mt-1">
                  At the bottom of the workflow run details, find the "Artifacts" section
                </p>
              </li>
              <li>
                <strong className="text-white">Download the "ai-gate-evidence" artifact</strong>
                <p className="text-sm text-gray-400 ml-6 mt-1">
                  Click to download a ZIP file containing all evidence
                </p>
              </li>
              <li>
                <strong className="text-white">Unzip and open index.html or report.html</strong>
                <p className="text-sm text-gray-400 ml-6 mt-1">
                  The HTML report shows side-by-side comparisons of all screens with status and diff overlays
                </p>
              </li>
            </ol>
          </section>

          <section className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-4">Reviewing the Evidence Report</h2>
            <p className="text-gray-300 mb-4">
              The HTML evidence report contains:
            </p>
            <div className="space-y-3 text-gray-300">
              <div className="bg-gray-900 border border-gray-600 rounded-lg p-4">
                <h4 className="font-bold text-white mb-2">1. Run Summary</h4>
                <p className="text-sm text-gray-400">
                  Shows the commit SHA, run ID, total screens tested, and counts for PASS/WARN/FAIL.
                </p>
              </div>
              <div className="bg-gray-900 border border-gray-600 rounded-lg p-4">
                <h4 className="font-bold text-white mb-2">2. Screen Table</h4>
                <p className="text-sm text-gray-400">
                  Lists all tested screens with their status and originality percentage. Click to expand details.
                </p>
              </div>
              <div className="bg-gray-900 border border-gray-600 rounded-lg p-4">
                <h4 className="font-bold text-white mb-2">3. Per-Screen View</h4>
                <p className="text-sm text-gray-400">
                  For WARN and FAIL screens, shows three images:
                </p>
                <ul className="list-disc list-inside text-sm text-gray-400 ml-4 mt-2 space-y-1">
                  <li><strong className="text-white">Baseline:</strong> The original approved screenshot</li>
                  <li><strong className="text-white">Current:</strong> The new screenshot from this PR</li>
                  <li><strong className="text-white">Diff:</strong> Highlighted differences (pink overlay)</li>
                </ul>
              </div>
              <div className="bg-gray-900 border border-gray-600 rounded-lg p-4">
                <h4 className="font-bold text-white mb-2">4. What Changed Bullets</h4>
                <p className="text-sm text-gray-400">
                  Textual summary of detected changes (if available), such as "Text content changed in header" or "Layout shift detected in sidebar".
                </p>
              </div>
            </div>
          </section>

          <section className="bg-blue-900 border border-blue-600 rounded-lg p-6">
            <h2 className="text-xl font-bold text-blue-200 mb-3">Quick Reference</h2>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-bold text-blue-100 mb-2">If status is GREEN:</h4>
                <p className="text-blue-200">
                  ✓ No action needed, approve PR
                </p>
              </div>
              <div>
                <h4 className="font-bold text-blue-100 mb-2">If status is YELLOW:</h4>
                <p className="text-blue-200">
                  ⚠ Review diffs, approve if intentional, otherwise request fixes
                </p>
              </div>
              <div>
                <h4 className="font-bold text-blue-100 mb-2">If status is RED:</h4>
                <p className="text-blue-200">
                  ✗ Carefully review diffs, likely needs fixes unless major redesign
                </p>
              </div>
              <div>
                <h4 className="font-bold text-blue-100 mb-2">To update baselines:</h4>
                <p className="text-blue-200">
                  Add "approve-baseline" label to PR (if changes are intentional)
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
