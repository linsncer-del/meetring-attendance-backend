/**
 * KMTAMS — First Admin Seed (REST version)
 * Uses Supabase Admin REST API directly with fetch.
 * Run: node seed-admin.mjs
 */

const SUPABASE_URL         = 'https://vsvmacohgjfhnlumbvvk.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzdm1hY29oZ2pmaG5sdW1idnZrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjQ2OTc4NiwiZXhwIjoyMDk4MDQ1Nzg2fQ.exEgkQsM89sMOwVAiJHB-ryXoJt4z2YheRrJslDXuH8'

const ADMIN_EMAIL     = 'admin@kenha.co.ke'
const ADMIN_PASSWORD  = 'Admin@12345'
const ADMIN_FULL_NAME = 'System Administrator'

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'apikey': SUPABASE_SERVICE_KEY,
}

async function adminFetch(path, method = 'GET', body = null) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = { _raw: text } }
  return { ok: res.ok, status: res.status, data: json }
}

async function seed() {
  console.log('\n🌱  KMTAMS Admin Seed Script')
  console.log('─────────────────────────────────────')

  // ── Step 1: Create auth user via Admin API ────────────────────────────────
  console.log(`\n1. Creating auth user: ${ADMIN_EMAIL} …`)
  let userId

  const create = await adminFetch('/auth/v1/admin/users', 'POST', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: ADMIN_FULL_NAME },
  })

  if (create.ok) {
    userId = create.data.id
    console.log(`   ✅ Auth user created  (id: ${userId})`)
  } else {
    const msg = create.data?.msg || create.data?.message || JSON.stringify(create.data)

    // User already exists — search by email to get the id
    if (msg.toLowerCase().includes('already') || create.status === 422) {
      console.log('   ℹ️  User already exists — searching by email …')

      const search = await adminFetch(
        `/auth/v1/admin/users?email=${encodeURIComponent(ADMIN_EMAIL)}&per_page=10`,
      )

      if (search.ok && search.data.users?.length > 0) {
        userId = search.data.users[0].id
        console.log(`   ✅ Found existing user  (id: ${userId})`)

        // Reset password so we know what it is
        console.log('   🔑 Resetting password …')
        const upd = await adminFetch(`/auth/v1/admin/users/${userId}`, 'PUT', {
          password: ADMIN_PASSWORD,
          email_confirm: true,
        })
        if (upd.ok) {
          console.log('   ✅ Password reset OK')
        } else {
          console.error('   ⚠️  Password reset warning:', JSON.stringify(upd.data))
        }
      } else {
        console.error('   ❌ Could not find existing user. Search response:', JSON.stringify(search.data))
        return
      }
    } else {
      console.error('   ❌ Auth creation failed:', msg)
      console.error('      Full response:', JSON.stringify(create.data))
      return
    }
  }

  // ── Step 2: Upsert profiles row ────────────────────────────────────────────
  console.log('\n2. Upserting profile row in database …')
  const profile = await adminFetch('/rest/v1/profiles', 'POST', {
    id: userId,
    full_name: ADMIN_FULL_NAME,
    email: ADMIN_EMAIL,
    role: 'ict_admin',
    is_active: true,
    must_change_password: false,
  })

  // 201 = created, 409 = conflict (already exists) — both are fine; update on conflict
  if (profile.ok || profile.status === 409) {
    if (profile.status === 409) {
      // PATCH to update existing row
      const patch = await adminFetch(`/rest/v1/profiles?id=eq.${userId}`, 'PATCH', {
        full_name: ADMIN_FULL_NAME,
        role: 'ict_admin',
        is_active: true,
        must_change_password: false,
      })
      if (!patch.ok) {
        console.error('   ❌ Profile patch failed:', JSON.stringify(patch.data))
        return
      }
    }
    console.log('   ✅ Profile row ready')
  } else {
    console.error('   ❌ Profile error:', JSON.stringify(profile.data))
    return
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────')
  console.log('✅  Seed complete! Login with:')
  console.log(`   Email    : ${ADMIN_EMAIL}`)
  console.log(`   Password : ${ADMIN_PASSWORD}`)
  console.log('─────────────────────────────────────\n')

  // Verify login works
  console.log('🔍 Verifying login …')
  const verify = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_SERVICE_KEY },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  })
  const verifyData = await verify.json()
  if (verify.ok && verifyData.access_token) {
    console.log('✅  Login verified — you can now sign in!\n')
  } else {
    console.log('⚠️  Login test failed:', verifyData.error_description || verifyData.msg || JSON.stringify(verifyData))
    console.log('    Try logging in manually with the credentials above.\n')
  }
}

seed()
