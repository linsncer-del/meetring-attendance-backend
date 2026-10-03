import { Resend } from 'resend'
import { readFileSync } from 'node:fs'
import 'dotenv/config'

const apiKey = process.env.RESEND_API_KEY || process.env.SMTP_PASS || ''
const resend = new Resend(apiKey)

const fromName = process.env.SMTP_FROM_NAME || 'KeNHA KMTAMS'
const fromEmail = process.env.SMTP_FROM_EMAIL || 'no-reply@getkeja.online'
const FROM = process.env.SMTP_FROM || `${fromName} <${fromEmail}>`

const frontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:5173'

// ── Letterhead logo ──────────────────────────────────────────────────
// Sent as an inline (cid:) attachment rather than linked by URL, so it shows
// even when the frontend is on localhost or behind a firewall. Resolved from
// this file so it works from both src/ (dev) and dist/ (build).
const LOGO_CID = 'kenha-logo'
let logoContent: Buffer | null = null
try {
  logoContent = readFileSync(new URL('../../assets/kenha_email_logo.jpg', import.meta.url))
} catch {
  console.warn('[Mailer] assets/kenha_email_logo.jpg not found — emails will use a text header.')
}

// ── Helpers ──────────────────────────────────────────────────────────

export interface MailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
}

export const sendMail = async (options: MailOptions): Promise<void> => {
  const usesLogo = logoContent && options.html.includes(`cid:${LOGO_CID}`)
  const { error } = await resend.emails.send({
    from: FROM,
    to: Array.isArray(options.to) ? options.to : [options.to],
    subject: options.subject,
    html: options.html,
    text: options.text,
    attachments: usesLogo
      ? [{ filename: 'kenha-logo.jpg', content: logoContent!, contentType: 'image/jpeg', contentId: LOGO_CID }]
      : undefined,
  })

  if (error) {
    console.error('[Resend Error]', error)
    throw new Error(`Failed to send email: ${error.message}`)
  }
}

// Names and titles are typed by users, so they are escaped before going into HTML.
const esc = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

// ── Layout building blocks ───────────────────────────────────────────
// Table-based with inline styles: that is what Outlook and Gmail render reliably.

const FONT = "Arial, 'Helvetica Neue', Helvetica, sans-serif"

const detailsTable = (rows: Array<[string, string]>) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0; border: 1px solid #e5e7eb; border-left: 4px solid #f9d616; border-collapse: separate; border-radius: 4px;">
    ${rows
      .map(
        ([label, value], i) => `
    <tr>
      <td style="padding: 10px 16px; ${i ? 'border-top: 1px solid #f1f5f9;' : ''} font-family: ${FONT}; font-size: 13px; color: #6b7280; width: 38%; vertical-align: top;">${label}</td>
      <td style="padding: 10px 16px; ${i ? 'border-top: 1px solid #f1f5f9;' : ''} font-family: ${FONT}; font-size: 14px; color: #111827; font-weight: bold; vertical-align: top;">${value}</td>
    </tr>`
      )
      .join('')}
  </table>`

const button = (href: string, label: string) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0 8px;">
    <tr>
      <td style="background: #111111; border-radius: 4px;">
        <a href="${href}" style="display: inline-block; padding: 13px 28px; font-family: ${FONT}; font-size: 14px; font-weight: bold; color: #f9d616; text-decoration: none; letter-spacing: 0.3px;">${label}</a>
      </td>
    </tr>
  </table>`

const paragraph = (html: string) =>
  `<p style="margin: 0 0 14px; font-family: ${FONT}; font-size: 14px; line-height: 1.6; color: #374151;">${html}</p>`

const layout = (opts: { preheader: string; heading: string; body: string }) => {
  const header = logoContent
    ? `<img src="cid:${LOGO_CID}" width="520" alt="Kenya National Highways Authority" style="display: block; width: 100%; max-width: 520px; height: auto; border: 0;" />`
    : `<div style="font-family: ${FONT}; font-size: 20px; font-weight: bold; color: #111111;">Kenya National Highways Authority</div>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${opts.heading}</title>
</head>
<body style="margin: 0; padding: 0; background: #f3f4f6;">
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${opts.preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 28px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px; background: #ffffff; border: 1px solid #e5e7eb;">
          <tr>
            <td style="padding: 28px 40px 20px;">${header}</td>
          </tr>
          <tr>
            <td style="height: 4px; line-height: 4px; font-size: 0; background: #f9d616;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding: 32px 40px 12px;">
              <h1 style="margin: 0 0 18px; font-family: ${FONT}; font-size: 20px; line-height: 1.3; color: #111111;">${opts.heading}</h1>
              ${opts.body}
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 40px 32px;">
              <p style="margin: 0; font-family: ${FONT}; font-size: 14px; line-height: 1.6; color: #374151;">
                Regards,<br />
                <strong>KeNHA Meeting &amp; Training Attendance System</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background: #111111; padding: 20px 40px;">
              <p style="margin: 0 0 6px; font-family: ${FONT}; font-size: 12px; font-weight: bold; color: #f9d616;">Quality Highways, Better Connections</p>
              <p style="margin: 0; font-family: ${FONT}; font-size: 11px; line-height: 1.6; color: #d1d5db;">
                Kenya National Highways Authority &bull; Barabara Plaza, Block A &amp; C, JKIA, Off Airport South Road<br />
                P.O. Box 49712 - 00100 Nairobi &bull; Tel 020 4954000 / 0700 423 606 &bull; www.kenha.co.ke
              </p>
            </td>
          </tr>
        </table>
        <p style="margin: 14px 0 0; font-family: ${FONT}; font-size: 11px; color: #9ca3af;">
          This is an automated message from KMTAMS. Please do not reply to this email.<br />
          &copy; ${new Date().getFullYear()} Kenya National Highways Authority
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ── Email Templates ───────────────────────────────────────────────────

export const templates = {
  welcomeNewUser: (name: string, email: string, tempPassword: string) => ({
    subject: 'Welcome to KMTAMS — Your Account Details',
    html: layout({
      preheader: 'Your KMTAMS account has been created.',
      heading: 'Your KMTAMS Account Is Ready',
      body: `
        ${paragraph(`Dear ${esc(name)},`)}
        ${paragraph('An account has been created for you on the KeNHA Meeting &amp; Training Attendance Management System (KMTAMS). Please use the credentials below to sign in.')}
        ${detailsTable([
          ['Email address', esc(email)],
          ['Temporary password', `<span style="font-family: 'Courier New', monospace; letter-spacing: 1px;">${esc(tempPassword)}</span>`],
        ])}
        ${paragraph('For your security, you will be asked to set a new password the first time you sign in.')}
        ${button(`${frontendUrl()}/login`, 'Sign In to KMTAMS')}
      `,
    }),
  }),

  passwordReset: (name: string, tempPassword: string) => ({
    subject: 'KMTAMS — Your Password Has Been Reset',
    html: layout({
      preheader: 'Your KMTAMS password has been reset by an administrator.',
      heading: 'Password Reset',
      body: `
        ${paragraph(`Dear ${esc(name)},`)}
        ${paragraph('Your KMTAMS password has been reset by a system administrator. Please use the temporary password below to sign in.')}
        ${detailsTable([
          ['Temporary password', `<span style="font-family: 'Courier New', monospace; letter-spacing: 1px;">${esc(tempPassword)}</span>`],
        ])}
        ${paragraph('You will be asked to choose a new password when you sign in. If you did not expect this change, please contact ICT immediately.')}
        ${button(`${frontendUrl()}/login`, 'Sign In to KMTAMS')}
      `,
    }),
  }),

  reportSubmittedToHR: (
    hrName: string,
    meetingTitle: string,
    organizer: string,
    totalAttendance: number,
    reportId: string
  ) => ({
    subject: `KMTAMS — Attendance Report Submitted: ${meetingTitle}`,
    html: layout({
      preheader: `An attendance report for ${esc(meetingTitle)} is awaiting your review.`,
      heading: 'Attendance Report Submitted for Review',
      body: `
        ${paragraph(`Dear ${esc(hrName)},`)}
        ${paragraph('An attendance report has been submitted to Human Resources and is awaiting your review.')}
        ${detailsTable([
          ['Meeting / training', esc(meetingTitle)],
          ['Submitted by', esc(organizer)],
          ['Total attendance', esc(totalAttendance)],
        ])}
        ${button(`${frontendUrl()}/hr/reports/${encodeURIComponent(reportId)}`, 'Review Report')}
      `,
    }),
  }),

  attendanceOpened: (organizerName: string, meetingTitle: string) => ({
    subject: `KMTAMS — Attendance Opened: ${meetingTitle}`,
    html: layout({
      preheader: `Attendance for ${esc(meetingTitle)} is now open.`,
      heading: 'Attendance Register Opened',
      body: `
        ${paragraph(`Dear ${esc(organizerName)},`)}
        ${paragraph(`The attendance register for <strong>${esc(meetingTitle)}</strong> is now <strong style="color: #15803d;">open</strong>. Participants can sign in by scanning the meeting QR code or following the attendance link, then entering the meeting PIN.`)}
        ${detailsTable([
          ['Meeting / training', esc(meetingTitle)],
          ['Status', '<span style="color: #15803d;">Open for sign-in</span>'],
        ])}
        ${button(`${frontendUrl()}/meetings`, 'View Live Attendance')}
      `,
    }),
  }),

  attendanceClosed: (organizerName: string, meetingTitle: string, total: number) => ({
    subject: `KMTAMS — Attendance Closed: ${meetingTitle}`,
    html: layout({
      preheader: `Attendance for ${esc(meetingTitle)} has closed with ${esc(total)} sign-ins.`,
      heading: 'Attendance Register Closed',
      body: `
        ${paragraph(`Dear ${esc(organizerName)},`)}
        ${paragraph(`The attendance register for <strong>${esc(meetingTitle)}</strong> is now <strong style="color: #b91c1c;">closed</strong> and no further sign-ins will be accepted.`)}
        ${detailsTable([
          ['Meeting / training', esc(meetingTitle)],
          ['Total attendees recorded', esc(total)],
        ])}
        ${paragraph('You can now review the register, make any corrections and download the official attendance register.')}
        ${button(`${frontendUrl()}/meetings`, 'Go to My Meetings')}
      `,
    }),
  }),

  multiDayAttendanceReminder: (
    participantName: string,
    meetingTitle: string,
    dayLabel: string,
    dateStr: string,
    pin: string,
    attendanceUrl: string,
    venue?: string
  ) => ({
    subject: `Attendance Reminder: ${meetingTitle} — ${dayLabel} (${dateStr})`,
    html: layout({
      preheader: `Please sign today's attendance for ${esc(meetingTitle)}.`,
      heading: 'Daily Attendance Sign-In Reminder',
      body: `
        ${paragraph(`Dear ${esc(participantName || 'Participant')},`)}
        ${paragraph(`This is a reminder to sign the attendance register for <strong>${esc(meetingTitle)}</strong> for <strong>${esc(dayLabel)} (${esc(dateStr)})</strong>.`)}
        ${detailsTable([
          ['Meeting / training', esc(meetingTitle)],
          ['Session day', `${esc(dayLabel)} &mdash; ${esc(dateStr)}`],
          ...(venue ? ([['Venue', esc(venue)]] as Array<[string, string]>) : []),
          ['Meeting PIN', `<span style="font-family: 'Courier New', monospace; font-size: 18px; letter-spacing: 4px;">${esc(pin)}</span>`],
        ])}
        ${button(attendanceUrl, 'Sign Today&rsquo;s Attendance')}
        <p style="margin: 8px 0 0; font-family: ${FONT}; font-size: 12px; line-height: 1.5; color: #6b7280;">
          You can open this link on your phone or tablet to add your signature.
        </p>
      `,
    }),
  }),
}
