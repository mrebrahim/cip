-- RLS decides which rows a teacher may touch; it cannot decide which columns.
-- Everything except the title is written by the pipeline under the service
-- role, so a signed-in client has no reason to be able to overwrite a
-- transcript, a document, or a status. Column grants close that gap.
revoke update on public.lectures from authenticated;
grant update (title) on public.lectures to authenticated;
