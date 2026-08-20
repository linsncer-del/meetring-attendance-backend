-- =====================================================================
-- KeNHA Meeting & Training Attendance Management System (KMTAMS)
-- Database Migration: Multi-Day Meetings & Dynamic Custom Fields
-- =====================================================================

-- 1. ADD CUSTOM_RESPONSES JSONB COLUMN TO ATTENDANCE TABLES
-- This allows storing dynamic/unique form columns created by organizers
ALTER TABLE IF EXISTS attendance_staff
  ADD COLUMN IF NOT EXISTS custom_responses jsonb DEFAULT '{}'::jsonb;

ALTER TABLE IF EXISTS attendance_visitor
  ADD COLUMN IF NOT EXISTS custom_responses jsonb DEFAULT '{}'::jsonb;

-- 2. UPDATE UNIQUE CONSTRAINT ON ATTENDANCE_STAFF
-- For Multi-Day meetings, allow participants to sign once PER DAY rather than once per entire multi-day meeting
ALTER TABLE IF EXISTS attendance_staff
  DROP CONSTRAINT IF EXISTS uq_staff_per_meeting;

-- Create unique index per meeting, participant, and session date (UTC day)
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_per_meeting_per_day
  ON attendance_staff (meeting_id, full_name, (COALESCE(department_id, '00000000-0000-0000-0000-000000000000'::uuid)), ((submitted_at AT TIME ZONE 'UTC')::date));

-- 3. OPTIONAL FORM_CONFIG JSONB & SESSION_DATES ON MEETINGS
-- (The system serializes metadata into description for zero-migration compatibility,
--  but having direct columns provides optimal query performance)
ALTER TABLE IF EXISTS meetings
  ADD COLUMN IF NOT EXISTS session_dates text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_multi_day boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS form_config jsonb DEFAULT NULL;

-- 4. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_attendance_staff_submitted_date 
  ON attendance_staff (((submitted_at AT TIME ZONE 'UTC')::date));

CREATE INDEX IF NOT EXISTS idx_attendance_visitor_submitted_date 
  ON attendance_visitor (((submitted_at AT TIME ZONE 'UTC')::date));

CREATE INDEX IF NOT EXISTS idx_meetings_is_multi_day 
  ON meetings (is_multi_day);
