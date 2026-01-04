import { Link } from "react-router-dom";
import { CheckCircle, FileText, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-white mb-4">
            🛡️ AI Gatekeeper
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-8">
            Block UI drift in CI and produce layman-readable evidence
          </p>
          <p className="text-lg text-gray-400 max-w-3xl mx-auto">
            Visual regression testing that catches unintended UI changes from AI-generated code.
            Deterministic screenshots, pixel-diff analysis, and actionable evidence for QA reviewers.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-16">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 hover:border-blue-500 transition-colors">
            <div className="flex items-center mb-4">
              <FileText className="w-8 h-8 text-blue-400 mr-3" />
              <h2 className="text-2xl font-bold text-white">Install in Your Repo</h2>
            </div>
            <p className="text-gray-300 mb-6">
              Get started in 5 minutes. Add visual regression testing to your CI pipeline with a single command.
            </p>
            <Link to="/docs/install">
              <Button className="w-full bg-blue-600 hover:bg-blue-700">
                View Installation Guide
              </Button>
            </Link>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 hover:border-green-500 transition-colors">
            <div className="flex items-center mb-4">
              <Play className="w-8 h-8 text-green-400 mr-3" />
              <h2 className="text-2xl font-bold text-white">Watch the Demo</h2>
            </div>
            <p className="text-gray-300 mb-6">
              See how AI Gatekeeper detects visual regressions and produces evidence in 90 seconds.
            </p>
            <Link to="/demo">
              <Button className="w-full bg-green-600 hover:bg-green-700">
                Watch 90-Second Demo
              </Button>
            </Link>
          </div>
        </div>

        <div className="max-w-4xl mx-auto mb-16">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-8">
            <div className="flex items-center mb-4">
              <CheckCircle className="w-8 h-8 text-purple-400 mr-3" />
              <h2 className="text-2xl font-bold text-white">For QA Reviewers</h2>
            </div>
            <p className="text-gray-300 mb-6">
              Learn how to review visual diffs and understand green/yellow/red status indicators.
            </p>
            <Link to="/docs/reviewers">
              <Button variant="outline" className="w-full border-purple-600 text-purple-400 hover:bg-purple-950">
                How to Review Diffs
              </Button>
            </Link>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-white mb-6 text-center">Why AI Gatekeeper?</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h4 className="font-bold text-white mb-2">🎯 Deterministic</h4>
              <p className="text-gray-400 text-sm">
                Frozen time, blocked animations, network isolation. ≤1% flake rate across 200+ runs.
              </p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h4 className="font-bold text-white mb-2">📦 Evidence-First</h4>
              <p className="text-gray-400 text-sm">
                HTML reports with side-by-side diffs, originality scores, and downloadable ZIP artifacts.
              </p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h4 className="font-bold text-white mb-2">🚀 Zero SaaS</h4>
              <p className="text-gray-400 text-sm">
                Run entirely in your own CI. No mandatory sign-in, no external dependencies.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
