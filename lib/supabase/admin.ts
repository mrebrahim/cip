import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. It bypasses RLS, so it is used only where there is no
 * user session to run under: the background pipeline writing stage output and
 * the cron sweeper. Never build one from a user-supplied identifier without
 * checking access first.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
