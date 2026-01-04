import { Link } from "react-router-dom";
import { ArrowLeft, Terminal, Eye, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DemoPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <Link to="/" className="inline-flex items-center text-blue-400 hover:text-blue-300 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>

        <h1 className="text-4xl font-bold text-white mb-4">90-Second Demo</h1>
        <p className="text-lg text-gray-300 mb-8">
          Watch how AI Gatekeeper detects visual regressions in your CI pipeline
        </p>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Terminal className="w-6 h-6 text-blue-400" />
            Quick Demo Walkthrough
          </h2>
          
          <div className="space-y-6">
            <div className="bg-gray-900 border border-gray-600 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">
                  1
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-2">Run the demo app</h3>
                  <p className="text-gray-300 mb-3">
                    Start the included 20-route demo application to see AI Gatekeeper in action:
                  </p>
                  <div className="bg-gray-950 border border-gray-700 rounded p-3">
                    <code className="text-green-400 text-sm">pnpm demo:start</code>
                  </div>
                  <p className="text-gray-400 text-sm mt-2">
                    The app runs at <code className="bg-gray-700 px-2 py-1 rounded">http://localhost:5173</code>
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-600 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-2">Generate baselines</h3>
                  <p className="text-gray-300 mb-3">
                    Capture baseline screenshots of all 20 routes (takes ~20 seconds):
                  </p>
                  <div className="bg-gray-950 border border-gray-700 rounded p-3">
                    <code className="text-green-400 text-sm">pnpm demo:seed</code>
                  </div>
                  <p className="text-gray-400 text-sm mt-2">
                    Creates <code className="bg-gray-700 px-2 py-1 rounded">baselines/</code> folder with PNG screenshots
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-600 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">
                  3
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-2">Introduce UI drift</h3>
                  <p className="text-gray-300 mb-3">
                    Simulate an accidental UI change (like AI code gen might produce):
                  </p>
                  <div className="bg-gray-950 border border-gray-700 rounded p-3">
                    <code className="text-green-400 text-sm">pnpm demo:break-ui</code>
                  </div>
                  <p className="text-gray-400 text-sm mt-2">
                    Modifies button padding on one screen to trigger a visual diff
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-600 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">
                  4
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-2">Run the gate</h3>
                  <p className="text-gray-300 mb-3">
                    Execute visual regression testing to catch the drift:
                  </p>
                  <div className="bg-gray-950 border border-gray-700 rounded p-3">
                    <code className="text-green-400 text-sm">pnpm demo:run</code>
                  </div>
                  <p className="text-gray-400 text-sm mt-2">
                    Takes ~15 seconds. Watch it detect the visual regression!
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 border border-green-600 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <div className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                  <Eye className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-2">Review the evidence</h3>
                  <p className="text-gray-300 mb-3">
                    Open the generated HTML report to see side-by-side comparisons:
                  </p>
                  <div className="bg-gray-950 border border-gray-700 rounded p-3 mb-3">
                    <code className="text-green-400 text-sm">open .ai-gate/evidence/latest/index.html</code>
                  </div>
                  <p className="text-gray-300">
                    The report shows:
                  </p>
                  <ul className="list-disc list-inside text-gray-400 mt-2 space-y-1 ml-4">
                    <li>Which screens passed/warned/failed</li>
                    <li>Baseline vs current screenshots side-by-side</li>
                    <li>Diff overlay highlighting exact pixel changes</li>
                    <li>Originality % scores</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-900 to-purple-900 border border-blue-700 rounded-lg p-6">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-400" />
            What You'll See
          </h2>
          <div className="grid md:grid-cols-2 gap-4 text-gray-200">
            <div>
              <h4 className="font-bold text-white mb-2">Terminal Output:</h4>
              <ul className="space-y-1 text-sm">
                <li>✓ 19 screens PASS (unchanged)</li>
                <li>✗ 1 screen FAIL (button padding changed)</li>
                <li>📊 Summary with originality scores</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-2">Evidence Report:</h4>
              <ul className="space-y-1 text-sm">
                <li>Interactive HTML with filtering</li>
                <li>Side-by-side image comparisons</li>
                <li>Pink diff overlay showing changes</li>
                <li>Works offline (no external assets)</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link to="/docs/install">
            <Button className="bg-blue-600 hover:bg-blue-700 mr-4">
              Install in Your Repo
            </Button>
          </Link>
          <Link to="/docs/reviewers">
            <Button variant="outline" className="border-purple-600 text-purple-400 hover:bg-purple-950">
              Learn How to Review
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
