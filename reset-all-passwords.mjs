/**
 * KMTAMS — Bulk Password Reset Script
 * ─────────────────────────────────────────────────────────────────
 * Fetches users from the profiles table (avoids the broken
 * /auth/v1/admin/users listing endpoint on Supabase) then resets
 * each auth password and sets must_change_password = true.
 *
 * Usage:
 *   node reset-all-passwords.mjs
 *
 * Reset specific emails only:
 *   node reset-all-passwords.mjs user1@kenha.co.ke user2@kenha.co.ke
 * ─────────────────────────────────────────────────────────────────
 */

const SUPABASE_URL         = 'https://vsvmacohgjfhnlumbvvk.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzdm1hY29oZ2pmaG5sdW1idnZrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjQ2OTc4NiwiZXhwIjoyMDk4MDQ1Nzg2fQ.exEgkQsM89sMOwVAiJHB-ryXoJt4z2YheRrJslDXuH8'

const TEMP_PASSWORD  = 'Kenha@2025!'
const TARGET_EMAILS  = process.argv.slice(2).map(e => e.toLowerCase())

const headers = {
  'Content-Type':  'application/json',
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'apikey':        SUPABASE_SERVICE_KEY,
}

async function apiFetch(path, method = 'GET', body = null) {
  const res  = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = { _raw: text } }
  return { ok: res.ok, status: res.status, data: json }
}

// ── Fetch users from profiles table (REST API — always works) ─────────────────
async function getUsersFromProfiles() {
  const url = TARGET_EMAILS.length > 0
    ? `/rest/v1/profiles?select=id,email,full_name,role,is_active&email=in.(${TARGET_EMAILS.join(',')})`
    : `/rest/v1/profiles?select=id,email,full_name,role,is_active`

  const res = await apiFetch(url)

  if (!res.ok) {
    console.error('Failed to fetch profiles:', JSON.stringify(res.data))
    process.exitCode = 1
    return []
  }

  return Array.isArray(res.data) ? res.data : []
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function resetAll() {
  console.log('\nKMTAMS Bulk Password Reset')
  console.log('==========================================')
  console.log(`  Temp password : ${TEMP_PASSWORD}`)
  console.log(`  Target        : ${TARGET_EMAILS.length > 0 ? TARGET_EMAILS.join(', ') : 'ALL users'}`)
  console.log('==========================================\n')

  // 1. Get users from profiles table
  console.log('Fetching users from profiles table ...')
  const profiles = await getUsersFromProfiles()

  if (profiles.length === 0) {
    console.log('No users found.')
    return
  }

  console.log(`  Found ${profiles.length} user(s)\n`)
  console.log(`Resetting ${profiles.length} user(s) ...\n`)

  const results = { success: [], failed: [] }

  for (const profile of profiles) {
    const email = profile.email ?? '(no email)'
    const label = `  ${email.padEnd(42)}`
    process.stdout.write(label)

    // 2. Reset Supabase Auth password using profile id (= auth user id)
    const authRes = await apiFetch(`/auth/v1/admin/users/${profile.id}`, 'PUT', {
      password:      TEMP_PASSWORD,
      email_confirm: true,
    })

    if (!authRes.ok) {
      const errMsg = authRes.data?.msg || authRes.data?.message || JSON.stringify(authRes.data)
      console.log(`FAILED: ${errMsg}`)
      results.failed.push({ email, reason: errMsg })
      continue
    }

    // 3. Set must_change_password = true in profiles table
    const patchRes = await apiFetch(
      `/rest/v1/profiles?id=eq.${profile.id}`,
      'PATCH',
      { must_change_password: true }
    )

    if (!patchRes.ok && patchRes.status !== 204) {
      console.log(`OK  (warning: profile flag not set, status ${patchRes.status})`)
    } else {
      console.log('OK')
    }
    results.success.push(email)
  }

  // 4. Summary
  console.log('\n==========================================')
  console.log(`Successfully reset : ${results.success.length} user(s)`)
  if (results.failed.length > 0) {
    console.log(`Failed             : ${results.failed.length} user(s)`)
    results.failed.forEach(f => console.log(`  - ${f.email}  ->  ${f.reason}`))
  }
  console.log('\nAll reset users will be prompted to change')
  console.log('their password on next login.')
  console.log(`Temporary password : ${TEMP_PASSWORD}`)
  console.log('==========================================\n')
}

resetAll().catch(err => {
  console.error('\nUnexpected error:', err.message)
  process.exitCode = 1
})
