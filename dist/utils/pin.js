import { supabaseAdmin } from '../config/supabase.js';
/**
 * Generates a random 6-digit numeric PIN.
 */
export const generateRawPin = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};
/**
 * Generates a PIN that is unique for the given meeting date.
 * Retries up to 10 times before throwing.
 */
export const generateUniquePinForDate = async (meetingDate) => {
    for (let attempt = 0; attempt < 10; attempt++) {
        const pin = generateRawPin();
        const { data, error } = await supabaseAdmin
            .from('meetings')
            .select('meeting_id')
            .eq('meeting_pin', pin)
            .eq('meeting_date', meetingDate)
            .maybeSingle();
        if (error)
            throw new Error(`PIN uniqueness check failed: ${error.message}`);
        if (!data)
            return pin; // PIN is unique for this date
    }
    throw new Error('Unable to generate a unique PIN after 10 attempts');
};
