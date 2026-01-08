import "./style.css";

document.querySelector("#app").innerHTML = `
  <div class="wrap">
    <header class="hero">
      <h1>AI Gatekeeper</h1>
      <p>Block UI drift in CI and produce layman-readable evidence for QA.</p>

      <div class="cta">
        <a class="btn primary" href="https://app.ai-gatekeeper.ca">Open App</a>
        <a class="btn" href="#demo">Watch Demo</a>
      </div>
    </header>

    <section class="grid">
      <div class="card">
        <h3>Deterministic</h3>
        <p>Frozen time, blocked animations, stable diffs.</p>
      </div>
      <div class="card">
        <h3>Evidence-First</h3>
        <p>Side-by-side diffs + downloadable artifacts for review.</p>
      </div>
      <div class="card">
        <h3>Zero SaaS</h3>
        <p>Runs in your CI without forcing users into a new platform.</p>
      </div>
    </section>

    <section id="demo" class="footer">
      <p>Ready? <a href="https://app.ai-gatekeeper.ca">Launch the app</a></p>
    </section>
  </div>
`;