import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase environment variables. ' +
        'Ensure SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are set in .env');
}
/**
 * Service-role client — bypasses RLS.
 * Use ONLY in server-side code (never expose to clients).
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});
/**
 * Anon client — respects RLS.
 * Used for verifying user JWTs.
 */
export const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});
/**
 * Verifies connection to the database by making a query.
 * Throws if the connection fails, credentials are invalid, or the
 * expected schema isn't reachable — in every case the caller should
 * treat this as "not safe to start the server".
 */
export const verifyDbConnection = async () => {
    try {
        const { error, status } = await supabaseAdmin.from('profiles').select('id').limit(1);
        if (error) {
            // Any error here means we cannot confidently serve traffic:
            // - 401/403/PGRST301: invalid or missing credentials
            // - "fetch failed": network/URL misconfiguration
            // - anything else (e.g. relation "profiles" does not exist):
            //   the schema hasn't been applied yet — still not safe to start.
            throw new Error(`${error.message} (status: ${status ?? 'unknown'}, code: ${error.code ?? 'none'})`);
        }
    }
    catch (err) {
        throw new Error(`Could not establish connection to Supabase database. Please check SUPABASE_URL and key settings, and confirm the schema has been applied. Error: ${err.message}`);
    }
};
