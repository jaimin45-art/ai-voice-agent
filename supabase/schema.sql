
-- Dialoft AI — Supabase Schema
-- Run this in the Supabase SQL editor to set up all tables.


-- ── calls
CREATE TABLE IF NOT EXISTS calls (
  id                  BIGSERIAL PRIMARY KEY,
  call_id             TEXT UNIQUE NOT NULL,       -- Retell call ID

  -- Dynamic variables (injected at call time)
  owner_name          TEXT NOT NULL,
  property_address    TEXT NOT NULL,
  lead_source         TEXT,
  agent_name          TEXT,
  to_number           TEXT,

  -- Call lifecycle
  status              TEXT DEFAULT 'initiated',   -- initiated | in_progress | completed | analyzed
  started_at          TIMESTAMPTZ,
  ended_at            TIMESTAMPTZ,
  duration_seconds    INTEGER,
  disconnection_reason TEXT,

  -- Post-call analysis (auto-filled by Retell LLM)
  qualified           TEXT,                       -- yes | no | maybe
  sell_timeline       TEXT,                       -- asap | 3_to_6_months | 6_to_12_months | just_exploring
  motivation          TEXT,
  objections          TEXT,
  follow_up_required  BOOLEAN,
  call_sentiment      TEXT,                       -- positive | neutral | negative
  agent_sentiment     TEXT,
  call_summary        TEXT,

  analyzed_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS calls_created_at_idx ON calls (created_at DESC);
CREATE INDEX IF NOT EXISTS calls_qualified_idx  ON calls (qualified);
CREATE INDEX IF NOT EXISTS calls_status_idx     ON calls (status);

-- ── transcripts 
CREATE TABLE IF NOT EXISTS transcripts (
  id         BIGSERIAL PRIMARY KEY,
  call_id    TEXT NOT NULL REFERENCES calls(call_id) ON DELETE CASCADE,
  sequence   INTEGER NOT NULL,
  role       TEXT NOT NULL,    -- agent | user
  content    TEXT NOT NULL,
  words      JSONB,            -- word-level timing from Retell (optional)
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (call_id, sequence)
);

CREATE INDEX IF NOT EXISTS transcripts_call_id_idx ON transcripts (call_id);

-- ── tool_calls
CREATE TABLE IF NOT EXISTS tool_calls (
  id               BIGSERIAL PRIMARY KEY,
  call_id          TEXT,           -- nullable — tool might fire before call row exists
  tool_name        TEXT NOT NULL,
  property_address TEXT,
  response         JSONB,
  called_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tool_calls_call_id_idx ON tool_calls (call_id);

-- ── Row-level security (optional — enable for production) ────
-- ALTER TABLE calls       ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tool_calls  ENABLE ROW LEVEL SECURITY;