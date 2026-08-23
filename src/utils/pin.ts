import { supabaseAdmin } from '../config/supabase.js'

/**
 * Generates a random 6-digit numeric PIN.
 */
export const generateRawPin = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Generates a PIN that is unique for the given meeting date.
 *
 * Fetches every PIN already used on this date in a single round-trip,
 * then picks random candidates in memory until one isn't taken. This
 * replaces the old "generate one, ask the DB, repeat up to 10 times"
 * loop — which cost up to 10 sequential network round-trips per
 * meeting creation — with exactly one.
 */
export const generateUniquePinForDate = async (
  meetingDate: string
): Promise<string> => {
  const { data, error } = await supabaseAdmin
    .from('meetings')
    .select('meeting_pin')
    .eq('meeting_date', meetingDate)

  if (error) throw new Error(`PIN uniqueness check failed: ${error.message}`)

  const usedPins = new Set((data ?? []).map(row => row.meeting_pin))

  for (let attempt = 0; attempt < 50; attempt++) {
    const pin = generateRawPin()
    if (!usedPins.has(pin)) return pin
  }

  throw new Error('Unable to generate a unique PIN after 50 attempts')
}
