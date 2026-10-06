-- =====================================================================
-- KMTAMS — Multi-day meetings: sign for past days, several at once
-- Run once in the Supabase SQL editor BEFORE deploying the matching backend.
-- =====================================================================

-- 1. The day a signature is FOR (not when it was submitted).
--    Lets a participant who missed Monday sign for it on Wednesday.
ALTER TABLE attendance_staff   ADD COLUMN IF NOT EXISTS session_date date;
ALTER TABLE attendance_visitor ADD COLUMN IF NOT EXISTS session_date date;

-- 2. Existing signatures were for the day they were submitted, in Kenya time.
UPDATE attendance_staff
   SET session_date = (submitted_at AT TIME ZONE 'Africa/Nairobi')::date
 WHERE session_date IS NULL;

UPDATE attendance_visitor
   SET session_date = (submitted_at AT TIME ZONE 'Africa/Nairobi')::date
 WHERE session_date IS NULL;

-- 3. The old rule allowed one signature per person per SUBMITTED day, which
--    blocks signing Monday and Tuesday together on Wednesday. The backend now
--    enforces "one signature per person per session day" itself. (No unique
--    index replaces it: older data may hold same-day duplicates that would make
--    creating one fail.) The plain indexes below keep those checks fast.
DROP INDEX IF EXISTS uq_staff_per_meeting_per_day;

CREATE INDEX IF NOT EXISTS idx_attendance_staff_session
  ON attendance_staff (meeting_id, session_date);
CREATE INDEX IF NOT EXISTS idx_attendance_visitor_session
  ON attendance_visitor (meeting_id, session_date);
