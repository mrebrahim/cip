-- A lecture the teacher stopped on purpose is not the same as one that failed:
-- it carries no error, and nothing should pick it back up on its own. The cron
-- sweep only looks at the in-flight statuses, so 'stopped' is left alone by
-- construction.
alter type public.lecture_status add value if not exists 'stopped';
