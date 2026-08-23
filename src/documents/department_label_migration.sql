-- =====================================================================
-- KeNHA Meeting & Training Attendance Management System (KMTAMS)
-- Database Migration: Free-Text Department Label for Multi-Department Meetings
-- =====================================================================
-- Lets an organizer either pick one existing department (department_id,
-- unchanged) or type a free-text label when a meeting spans multiple
-- departments / doesn't belong to exactly one. The two are mutually
-- exclusive at the application layer — this column is simply nullable
-- and unrelated to the departments table.
-- =====================================================================

ALTER TABLE IF EXISTS meetings
  ADD COLUMN IF NOT EXISTS department_label varchar(200) DEFAULT NULL;
