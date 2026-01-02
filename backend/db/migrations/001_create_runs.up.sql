CREATE TABLE runs (
  id BIGSERIAL PRIMARY KEY,
  pull_request INTEGER NOT NULL,
  commit TEXT NOT NULL,
  branch TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'in_progress')),
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_runs_timestamp ON runs(timestamp DESC);
CREATE INDEX idx_runs_status ON runs(status);
