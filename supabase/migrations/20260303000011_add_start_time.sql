-- Add optional start_time to time_entries.
-- duration_hours remains the billing source of truth.
-- When start_time is NULL the entry is treated as all-day (legacy behaviour).
ALTER TABLE time_entries ADD COLUMN start_time TIME;
