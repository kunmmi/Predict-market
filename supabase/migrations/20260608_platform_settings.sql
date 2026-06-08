-- Simple key/value store for runtime platform settings toggled from the admin panel.
CREATE TABLE IF NOT EXISTS platform_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only admins (service role) can read or write this table.
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON platform_settings USING (false);

-- Seed defaults
INSERT INTO platform_settings (key, value)
VALUES ('market_maker_enabled', 'true')
ON CONFLICT (key) DO NOTHING;
