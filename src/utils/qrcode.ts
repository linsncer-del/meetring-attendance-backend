import QRCode from 'qrcode'

/**
 * Generates a QR code as a base64-encoded PNG Data URL.
 * Can be stored in Supabase Storage or returned directly to the frontend.
 */
export const generateQRCodeBase64 = async (url: string): Promise<string> => {
  return await QRCode.toDataURL(url, {
    width: 400,
    margin: 2,
    color: {
      dark: '#003087',  // KeNHA dark blue
      light: '#FFFFFF',
    },
  })
}

/**
 * Generates a QR code as a Buffer (PNG).
 * Useful for uploading to Supabase Storage.
 */
export const generateQRCodeBuffer = async (url: string): Promise<Buffer> => {
  return await QRCode.toBuffer(url, {
    width: 400,
    margin: 2,
    color: {
      dark: '#003087',
      light: '#FFFFFF',
    },
  })
}

/**
 * Builds the public attendance URL for a meeting.
 */
export const buildAttendanceUrl = (meetingId: string): string => {
  const base = process.env.FRONTEND_URL || 'http://localhost:5173'
  return `${base}/attend/${meetingId}`
}
