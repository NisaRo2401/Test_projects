-- ============================================================
-- IHK Exam Trainer — Datenbank-Schema
-- Ausführen im Supabase-SQL-Editor NACH supabase-setup.sql
-- ============================================================

-- ── Fragen-Bank (öffentlich lesbar für eingeloggte User) ─────
CREATE TABLE IF NOT EXISTS public.questions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_part        TEXT NOT NULL CHECK (exam_part IN ('AP1','GA1','GA2','WiSo')),
  exam_year        INT,
  exam_season      TEXT CHECK (exam_season IN ('Sommer','Winter')),
  topic            TEXT NOT NULL,
  subtopic         TEXT,
  question         TEXT NOT NULL,
  options          JSONB NOT NULL,          -- z.B. ["A…","B…","C…","D…"]
  correct_indices  INT[] NOT NULL,          -- Single- ODER Multi-Select
  hint             TEXT,
  solution         TEXT NOT NULL,
  difficulty       TEXT CHECK (difficulty IN ('leicht','mittel','schwer')),
  has_diagram      BOOLEAN DEFAULT FALSE,
  diagram_url      TEXT,
  source_pdf       TEXT,
  source_page      INT,
  source_hash      TEXT UNIQUE,             -- deterministische Signatur für Idempotenz
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS questions_part_topic_idx
  ON public.questions (exam_part, topic);
CREATE INDEX IF NOT EXISTS questions_topic_idx
  ON public.questions (topic);

-- ── Fortschritt pro User pro Frage ──────────────────────────
CREATE TABLE IF NOT EXISTS public.user_progress (
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id       UUID REFERENCES public.questions(id) ON DELETE CASCADE,
  attempts          INT DEFAULT 0,
  correct_count     INT DEFAULT 0,
  last_answered_at  TIMESTAMPTZ,
  last_correct      BOOLEAN,
  PRIMARY KEY (user_id, question_id)
);
CREATE INDEX IF NOT EXISTS user_progress_user_idx
  ON public.user_progress (user_id);

-- ── Prüfungs-Sessions ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exam_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_part         TEXT NOT NULL CHECK (exam_part IN ('AP1','GA1','GA2','WiSo')),
  started_at        TIMESTAMPTZ DEFAULT NOW(),
  finished_at       TIMESTAMPTZ,
  duration_sec      INT,
  total_questions   INT,
  correct_count     INT,
  score_pct         NUMERIC,
  grade             TEXT,                    -- '1'…'6' nach IHK-Schlüssel
  answers           JSONB                    -- [{question_id, selected, correct}]
);
CREATE INDEX IF NOT EXISTS exam_sessions_user_idx
  ON public.exam_sessions (user_id, finished_at DESC);

-- ── Row-Level Security ──────────────────────────────────────
ALTER TABLE public.questions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_sessions  ENABLE ROW LEVEL SECURITY;

-- Fragen: jeder eingeloggte User darf lesen
DROP POLICY IF EXISTS "questions readable by auth" ON public.questions;
CREATE POLICY "questions readable by auth"
  ON public.questions FOR SELECT
  USING (auth.role() = 'authenticated');

-- user_progress: nur eigene Einträge
DROP POLICY IF EXISTS "progress select own" ON public.user_progress;
CREATE POLICY "progress select own"
  ON public.user_progress FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "progress upsert own" ON public.user_progress;
CREATE POLICY "progress upsert own"
  ON public.user_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "progress update own" ON public.user_progress;
CREATE POLICY "progress update own"
  ON public.user_progress FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "progress delete own" ON public.user_progress;
CREATE POLICY "progress delete own"
  ON public.user_progress FOR DELETE
  USING (auth.uid() = user_id);

-- exam_sessions: nur eigene
DROP POLICY IF EXISTS "sessions select own" ON public.exam_sessions;
CREATE POLICY "sessions select own"
  ON public.exam_sessions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "sessions insert own" ON public.exam_sessions;
CREATE POLICY "sessions insert own"
  ON public.exam_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "sessions update own" ON public.exam_sessions;
CREATE POLICY "sessions update own"
  ON public.exam_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Aggregat-View: Fortschritt pro Thema für eingeloggten User ─
CREATE OR REPLACE VIEW public.topic_progress AS
SELECT
  q.topic,
  q.exam_part,
  COUNT(q.id)                                                AS total,
  COUNT(up.question_id)                                      AS answered,
  COALESCE(SUM(CASE WHEN up.last_correct THEN 1 ELSE 0 END), 0) AS correct
FROM public.questions q
LEFT JOIN public.user_progress up
       ON up.question_id = q.id
      AND up.user_id = auth.uid()
GROUP BY q.topic, q.exam_part;

-- ── Hinweis Storage-Bucket ───────────────────────────────────
-- Bucket 'ihk-diagrams' (public) bitte manuell im Supabase-Dashboard
-- unter Storage anlegen. Dateien werden mit Pfad
-- <exam_part>-<year>-<season>/<page>.png hochgeladen.
