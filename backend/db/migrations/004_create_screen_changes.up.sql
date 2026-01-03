CREATE TABLE screen_changes (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  screen_id TEXT NOT NULL,
  change_type TEXT NOT NULL,
  selector TEXT,
  description TEXT NOT NULL,
  confidence REAL NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_screen_changes_run_id ON screen_changes(run_id);
CREATE INDEX idx_screen_changes_screen_id ON screen_changes(screen_id);
