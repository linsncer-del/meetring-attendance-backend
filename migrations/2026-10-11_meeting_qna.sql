-- =====================================================================
-- KMTAMS — Meeting Q&A: attendees ask questions by QR code / link
-- Run once in the Supabase SQL editor BEFORE deploying the matching backend.
-- =====================================================================

-- Whether a meeting is currently accepting questions.
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS qna_open boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS meeting_questions (
    question_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id         uuid NOT NULL REFERENCES meetings (meeting_id) ON DELETE CASCADE,
    question           text NOT NULL CHECK (char_length(question) BETWEEN 3 AND 1000),
    -- Both optional: attendees may ask anonymously.
    asker_name         varchar(150),
    asker_email        varchar(150),
    -- pending   → new / not yet answered
    -- answered  → has an answer (which may also have been emailed)
    -- dismissed → hidden everywhere except the organiser's "Dismissed" filter
    status             varchar(20) NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'answered', 'dismissed')),
    -- Shown on the presentation screen. Separate from status, so answering a
    -- question privately never puts it on the projector.
    on_screen          boolean NOT NULL DEFAULT false,
    -- The one question shown full-screen on the presentation view.
    is_highlighted     boolean NOT NULL DEFAULT false,
    answer             text,
    answered_by        uuid REFERENCES profiles (id) ON DELETE SET NULL,
    answered_at        timestamptz,
    answer_emailed_at  timestamptz,
    forwarded_to       varchar(150),
    forwarded_by       uuid REFERENCES profiles (id) ON DELETE SET NULL,
    forwarded_at       timestamptz,
    ip_address         inet,
    created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_questions_meeting
  ON meeting_questions (meeting_id, created_at);

-- Access goes through the backend (service role); no direct client access.
ALTER TABLE meeting_questions ENABLE ROW LEVEL SECURITY;
