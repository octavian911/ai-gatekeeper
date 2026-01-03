ALTER TABLE runs ADD COLUMN run_data JSONB;
ALTER TABLE runs ADD COLUMN review_status TEXT CHECK (review_status IN ('pending', 'approved', 'rejected'));
ALTER TABLE runs ADD COLUMN reviewed_by TEXT;
ALTER TABLE runs ADD COLUMN reviewed_at TIMESTAMP;
ALTER TABLE runs ADD COLUMN review_notes TEXT;

CREATE INDEX idx_runs_review_status ON runs(review_status);
