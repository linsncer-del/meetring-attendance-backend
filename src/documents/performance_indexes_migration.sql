-- =====================================================================
-- KeNHA Meeting & Training Attendance Management System (KMTAMS)
-- Database Migration: Performance Indexes for Meeting & Document Creation
-- =====================================================================
-- Speeds up the two hot paths flagged as slow:
--   1. Meeting creation (createMeeting) — duplicate-title check
--   2. Document creation (getMeetingDocumentData / renderDocument) —
--      attendance lookups + template version lookups
-- All statements are additive / idempotent (IF NOT EXISTS) — safe to
-- run against a live database with no downtime.
-- =====================================================================

-- 1. Duplicate-title check in createMeeting() does:
--      .ilike('title', title).eq('meeting_date', date)
--    A plain ILIKE on `title` can't use a normal btree index. This
--    functional index makes that check a single index lookup instead
--    of a date-range scan + row-by-row filter.
CREATE INDEX IF NOT EXISTS idx_meetings_title_lower_date
  ON meetings (lower(title), meeting_date);

-- 2. Attendance lookups are always "WHERE meeting_id = X ORDER BY
--    submitted_at" (organizer views, report generation, document
--    generation). The existing idx_attendance_staff_meeting /
--    idx_attendance_visitor_meeting only cover the filter, not the
--    sort — these composite indexes let Postgres satisfy both in one
--    index scan.
CREATE INDEX IF NOT EXISTS idx_attendance_staff_meeting_submitted
  ON attendance_staff (meeting_id, submitted_at);

CREATE INDEX IF NOT EXISTS idx_attendance_visitor_meeting_submitted
  ON attendance_visitor (meeting_id, submitted_at);

-- 3. attendance_staff.department_id is joined/filtered in report and
--    document generation but was never indexed.
CREATE INDEX IF NOT EXISTS idx_attendance_staff_department
  ON attendance_staff (department_id);

-- 4. getTemplateFile() — called on every single document render —
--    does ".eq('template_id', X).order('version_number', desc).limit(1)".
--    This composite index turns that into a direct index lookup for
--    the latest version instead of a scan + sort.
CREATE INDEX IF NOT EXISTS idx_template_versions_template_version_desc
  ON template_versions (template_id, version_number DESC);

-- 5. generated_documents was only indexed on meeting_id; template_id
--    and generated_by are also filtered (template usage stats,
--    "my generated documents" views).
CREATE INDEX IF NOT EXISTS idx_generated_documents_template
  ON generated_documents (template_id);

CREATE INDEX IF NOT EXISTS idx_generated_documents_generated_by
  ON generated_documents (generated_by);
