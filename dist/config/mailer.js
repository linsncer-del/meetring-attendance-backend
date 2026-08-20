import { Resend } from 'resend';
import 'dotenv/config';
const apiKey = process.env.RESEND_API_KEY || process.env.SMTP_PASS || '';
const resend = new Resend(apiKey);
const fromName = process.env.SMTP_FROM_NAME || 'Getkeja';
const fromEmail = process.env.SMTP_FROM_EMAIL || 'no-reply@getkeja.online';
const FROM = process.env.SMTP_FROM || `${fromName} <${fromEmail}>`;
export const sendMail = async (options) => {
    const { error } = await resend.emails.send({
        from: FROM,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
    });
    if (error) {
        console.error('[Resend Error]', error);
        throw new Error(`Failed to send email: ${error.message}`);
    }
};
// ── Email Templates ───────────────────────────────────────────────────
export const templates = {
    welcomeNewUser: (name, email, tempPassword) => ({
        subject: 'Welcome to KMTAMS — Your Account Details',
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
        <div style="background: #003087; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">KeNHA KMTAMS</h1>
          <p style="color: #cce0ff; margin: 5px 0 0;">Meeting & Training Attendance System</p>
        </div>
        <div style="background: #fff; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0;">
          <h2 style="color: #003087;">Welcome, ${name}!</h2>
          <p>Your KMTAMS account has been created. Please use the credentials below to log in:</p>
          <div style="background: #f0f4ff; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code style="background: #e0e8ff; padding: 2px 6px; border-radius: 4px;">${tempPassword}</code></p>
          </div>
          <p style="color: #d32f2f;"><strong>You will be required to change your password on first login.</strong></p>
          <a href="${process.env.FRONTEND_URL}/login" style="display: inline-block; background: #003087; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 10px;">Login to KMTAMS</a>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e0e0e0;">
          <p style="color: #888; font-size: 12px;">Kenya National Highways Authority &copy; ${new Date().getFullYear()}</p>
        </div>
      </div>
    `,
    }),
    passwordReset: (name, tempPassword) => ({
        subject: 'KMTAMS — Password Reset',
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
        <div style="background: #003087; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">KeNHA KMTAMS</h1>
        </div>
        <div style="background: #fff; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0;">
          <h2 style="color: #003087;">Password Reset — ${name}</h2>
          <p>Your password has been reset by an administrator.</p>
          <div style="background: #f0f4ff; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>New Temporary Password:</strong> <code style="background: #e0e8ff; padding: 2px 6px; border-radius: 4px;">${tempPassword}</code></p>
          </div>
          <p style="color: #d32f2f;"><strong>You must change this password on your next login.</strong></p>
          <a href="${process.env.FRONTEND_URL}/login" style="display: inline-block; background: #003087; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 10px;">Login Now</a>
        </div>
      </div>
    `,
    }),
    reportSubmittedToHR: (hrName, meetingTitle, organizer, totalAttendance, reportId) => ({
        subject: `KMTAMS — New Attendance Report: ${meetingTitle}`,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
        <div style="background: #003087; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">KeNHA KMTAMS</h1>
          <p style="color: #cce0ff; margin: 5px 0 0;">Attendance Report Submitted</p>
        </div>
        <div style="background: #fff; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0;">
          <h2 style="color: #003087;">Dear ${hrName},</h2>
          <p>A new attendance report has been submitted for your review.</p>
          <div style="background: #f0f4ff; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Meeting:</strong> ${meetingTitle}</p>
            <p style="margin: 5px 0;"><strong>Organizer:</strong> ${organizer}</p>
            <p style="margin: 5px 0;"><strong>Total Attendance:</strong> ${totalAttendance}</p>
          </div>
          <a href="${process.env.FRONTEND_URL}/hr/reports/${reportId}" style="display: inline-block; background: #003087; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 10px;">View Report</a>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e0e0e0;">
          <p style="color: #888; font-size: 12px;">Kenya National Highways Authority &copy; ${new Date().getFullYear()}</p>
        </div>
      </div>
    `,
    }),
    attendanceOpened: (organizerName, meetingTitle) => ({
        subject: `KMTAMS — Attendance Opened: ${meetingTitle}`,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #003087; padding: 20px; border-radius: 8px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">KeNHA KMTAMS</h1>
        </div>
        <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-radius: 8px; margin-top: 10px;">
          <p>Dear <strong>${organizerName}</strong>,</p>
          <p>Attendance for <strong>${meetingTitle}</strong> has been <span style="color: #1b7e1b; font-weight: bold;">OPENED</span>.</p>
          <p>Participants can now scan the QR code or use the attendance link to register.</p>
        </div>
      </div>
    `,
    }),
    attendanceClosed: (organizerName, meetingTitle, total) => ({
        subject: `KMTAMS — Attendance Closed: ${meetingTitle}`,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #003087; padding: 20px; border-radius: 8px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">KeNHA KMTAMS</h1>
        </div>
        <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-radius: 8px; margin-top: 10px;">
          <p>Dear <strong>${organizerName}</strong>,</p>
          <p>Attendance for <strong>${meetingTitle}</strong> has been <span style="color: #d32f2f; font-weight: bold;">CLOSED</span>.</p>
          <p><strong>Total attendees recorded: ${total}</strong></p>
          <p>You can now generate and download the attendance report from KMTAMS.</p>
          <a href="${process.env.FRONTEND_URL}/meetings" style="display: inline-block; background: #003087; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 10px;">Go to My Meetings</a>
        </div>
      </div>
    `,
    }),
    multiDayAttendanceReminder: (participantName, meetingTitle, dayLabel, dateStr, pin, attendanceUrl, venue) => ({
        subject: `Attendance Reminder: ${meetingTitle} — ${dayLabel} (${dateStr})`,
        html: `
      <div style="font-family: Arial, 'Helvetica Neue', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc;">
        <div style="background: #1e3a8a; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px; letter-spacing: 0.5px;">Kenya National Highways Authority</h1>
          <p style="color: #fde047; margin: 6px 0 0; font-size: 13px; font-weight: bold;">KeNHA Meeting &amp; Training Attendance System (KMTAMS)</p>
        </div>
        <div style="background: #ffffff; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
          <h2 style="color: #0f172a; font-size: 18px; margin-top: 0;">Daily Attendance Sign-In Reminder</h2>
          <p style="color: #334155; font-size: 14px; line-height: 1.5;">
            Dear <strong>${participantName || 'Participant'}</strong>,<br/>
            This is a reminder to sign your daily attendance for <strong>${meetingTitle}</strong> for <strong>${dayLabel} (${dateStr})</strong>.
          </p>
          <div style="background: #f1f5f9; border-left: 4px solid #2563eb; padding: 16px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 4px 0; font-size: 13px; color: #1e293b;"><strong>Meeting:</strong> ${meetingTitle}</p>
            <p style="margin: 4px 0; font-size: 13px; color: #1e293b;"><strong>Session Day:</strong> ${dayLabel} &mdash; ${dateStr}</p>
            ${venue ? `<p style="margin: 4px 0; font-size: 13px; color: #1e293b;"><strong>Venue:</strong> ${venue}</p>` : ''}
            <p style="margin: 8px 0 4px; font-size: 14px; color: #1e293b;">
              <strong>Meeting 6-Digit PIN:</strong> 
              <span style="display: inline-block; background: #e0e7ff; color: #1e40af; font-weight: 800; font-size: 16px; padding: 2px 8px; border-radius: 4px; letter-spacing: 2px; margin-left: 6px;">${pin}</span>
            </p>
          </div>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${attendanceUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; font-weight: 700; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-size: 14px; box-shadow: 0 2px 4px rgba(37,99,235,0.3);">
              Sign Today's Attendance Register &rarr;
            </a>
          </div>
          <p style="font-size: 12px; color: #64748b; line-height: 1.4; text-align: center;">
            You can also open the link on your mobile phone or tablet to provide your digital signature.
          </p>
          <hr style="margin: 24px 0 16px; border: none; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
            Kenya National Highways Authority &copy; ${new Date().getFullYear()} &bull; Quality Highways, Better Connections
          </p>
        </div>
      </div>
    `,
    }),
};
