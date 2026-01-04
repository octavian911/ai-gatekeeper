import { useState } from "react";
import { Copy, Check, AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export function InstallDocsPage() {
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [copiedWorkflow, setCopiedWorkflow] = useState(false);
  const navigate = useNavigate();

  const copyToClipboard = (text: string, type: "command" | "workflow") => {
    navigator.clipboard.writeText(text);
    if (type === "command") {
      setCopiedCommand(true);
      setTimeout(() => setCopiedCommand(false), 2000);
    } else {
      setCopiedWorkflow(true);
      setTimeout(() => setCopiedWorkflow(false), 2000);
    }
  };

  const runCommand = "npx ai-gate run --baseURL http://localhost:3000";
  
  const githubWorkflow = `name: Visual Regression Gate
on:
  pull_request:
    branches: [main]

jobs:
  visual-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm install
      
      - name: Install Playwright browsers
        run: npx playwright install chromium --with-deps
      
      - name: Start application
        run: npm run dev &
        
      - name: Wait for app
        run: npx wait-on http://localhost:3000
      
      - name: Run visual regression gate
        run: npx ai-gate run --baseURL http://localhost:3000 --ci
      
      - name: Upload evidence
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: ai-gate-evidence
          path: .ai-gate/evidence/
          retention-days: 30`;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6 text-gray-300 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
        <h1 className="text-4xl font-bold text-white mb-6">Installation Guide</h1>
        <p className="text-lg text-gray-300 mb-8">
          Add AI Gatekeeper to your repository in 5 minutes
        </p>

        <div className="space-y-8">
          <section className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-4">1. Run Locally First</h2>
            <p className="text-gray-300 mb-4">
              Test AI Gatekeeper against your running application to ensure everything works correctly:
            </p>
            <div className="bg-gray-900 border border-gray-600 rounded-lg p-4 relative">
              <pre className="text-sm text-green-400 overflow-x-auto">
                <code>{runCommand}</code>
              </pre>
              <button
                onClick={() => copyToClipboard(runCommand, "command")}
                className="absolute top-2 right-2 p-2 bg-gray-700 hover:bg-gray-600 rounded"
              >
                {copiedCommand ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
              </button>
            </div>
            <p className="text-gray-400 text-sm mt-3">
              Replace <code className="bg-gray-700 px-2 py-1 rounded">http://localhost:3000</code> with your application's URL.
            </p>
          </section>

          <section className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-4">2. Create Baseline Screenshots</h2>
            <p className="text-gray-300 mb-4">
              Before running the gate, you need baseline images. Your baselines folder should look like this:
            </p>
            <div className="bg-gray-900 border border-gray-600 rounded-lg p-4">
              <pre className="text-sm text-gray-300">
{`baselines/
├── manifest.json
├── login/
│   ├── baseline.png
│   └── screen.json
├── dashboard/
│   ├── baseline.png
│   └── screen.json
└── pricing/
    ├── baseline.png
    └── screen.json`}
              </pre>
            </div>
            <p className="text-gray-300 mt-4 mb-2">
              <strong>manifest.json example:</strong>
            </p>
            <div className="bg-gray-900 border border-gray-600 rounded-lg p-4">
              <pre className="text-sm text-gray-300">
{`{
  "baselines": [
    {
      "screenId": "login",
      "name": "Login Page",
      "url": "/login",
      "hash": "abc123..."
    },
    {
      "screenId": "pricing",
      "name": "Pricing Page",
      "url": "/pricing",
      "hash": "def456..."
    }
  ]
}`}
              </pre>
            </div>
          </section>

          <section className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-4">3. Add GitHub Actions Workflow</h2>
            <p className="text-gray-300 mb-4">
              Create <code className="bg-gray-700 px-2 py-1 rounded">.github/workflows/ai-gate.yml</code> in your repository:
            </p>
            <div className="bg-gray-900 border border-gray-600 rounded-lg p-4 relative max-h-96 overflow-y-auto">
              <pre className="text-sm text-gray-300">
                <code>{githubWorkflow}</code>
              </pre>
              <button
                onClick={() => copyToClipboard(githubWorkflow, "workflow")}
                className="sticky top-2 float-right p-2 bg-gray-700 hover:bg-gray-600 rounded"
              >
                {copiedWorkflow ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
              </button>
            </div>
            <p className="text-gray-400 text-sm mt-3">
              Update the workflow to match your application's build and start commands.
            </p>
          </section>

          <section className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-4">4. Use the Template Repo</h2>
            <p className="text-gray-300 mb-4">
              For a complete working example, see the template repository:
            </p>
            <div className="bg-gray-900 border border-gray-600 rounded-lg p-4">
              <pre className="text-sm text-gray-300">
{`examples/repo-b-template/
├── ai-gate.config.json
├── baselines/
│   ├── manifest.json
│   ├── login/
│   │   └── baseline.png
│   └── pricing/
│       └── baseline.png
└── scripts/
    └── run-visual-test.sh`}
              </pre>
            </div>
            <p className="text-gray-300 mt-4">
              Steps to use:
            </p>
            <ol className="list-decimal list-inside text-gray-300 space-y-2 ml-4">
              <li>Copy the template folder to your repository</li>
              <li>Update <code className="bg-gray-700 px-2 py-1 rounded">ai-gate.config.json</code> with your routes</li>
              <li>Generate baselines for your application</li>
              <li>Commit baselines to version control</li>
            </ol>
          </section>

          <section className="bg-yellow-900 border border-yellow-600 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-yellow-400 mt-1 flex-shrink-0" />
              <div>
                <h2 className="text-xl font-bold text-yellow-200 mb-3">Troubleshooting</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-bold text-yellow-100 mb-1">1. baseURL not reachable</h3>
                    <p className="text-yellow-200 text-sm">
                      Ensure your application is running and accessible at the specified URL before running the gate.
                      Use <code className="bg-yellow-950 px-2 py-1 rounded">curl http://localhost:3000</code> to verify.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-bold text-yellow-100 mb-1">2. Missing baselines/manifest.json</h3>
                    <p className="text-yellow-200 text-sm">
                      The gate requires baseline screenshots to compare against. Create the <code className="bg-yellow-950 px-2 py-1 rounded">baselines/</code> folder
                      with a <code className="bg-yellow-950 px-2 py-1 rounded">manifest.json</code> file and baseline PNGs before running.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-bold text-yellow-100 mb-1">3. Playwright browser install missing</h3>
                    <p className="text-yellow-200 text-sm">
                      Run <code className="bg-yellow-950 px-2 py-1 rounded">npx playwright install chromium --with-deps</code> to install
                      the required browser binaries. This is needed both locally and in CI.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
