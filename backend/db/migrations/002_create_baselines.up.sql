CREATE TABLE baselines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  route TEXT,
  tags TEXT[] DEFAULT '{}',
  viewport_width INTEGER NOT NULL DEFAULT 1280,
  viewport_height INTEGER NOT NULL DEFAULT 720,
  hash TEXT,
  status TEXT NOT NULL CHECK (status IN ('validated', 'invalid', 'missing')) DEFAULT 'missing',
  status_message TEXT,
  has_image BOOLEAN NOT NULL DEFAULT FALSE,
  file_size INTEGER,
  masks JSONB DEFAULT '[]',
  thresholds JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_baselines_status ON baselines(status);
CREATE INDEX idx_baselines_tags ON baselines USING GIN(tags);
CREATE INDEX idx_baselines_route ON baselines(route);
