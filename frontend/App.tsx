import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { LandingPage } from "./pages/LandingPage";
import { InstallDocsPage } from "./pages/InstallDocsPage";
import { ReviewerDocsPage } from "./pages/ReviewerDocsPage";
import { DemoPage } from "./pages/DemoPage";
import { BaselinesPage } from "./pages/BaselinesPage";
import { ReviewsPage } from "./pages/ReviewsPage";
import { ReviewDetailPage } from "./pages/ReviewDetailPage";
import "./index-overrides.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/docs/install" element={<Layout><InstallDocsPage /></Layout>} />
        <Route path="/docs/reviewers" element={<Layout><ReviewerDocsPage /></Layout>} />
        <Route path="/demo" element={<DemoPage />} />
        <Route path="/baselines" element={<Layout><BaselinesPage /></Layout>} />
        <Route path="/reviews" element={<Layout><ReviewsPage /></Layout>} />
        <Route path="/reviews/:id" element={<Layout><ReviewDetailPage /></Layout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
