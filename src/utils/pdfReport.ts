import type { AttendanceStaff, AttendanceVisitor, Meeting, Profile } from '../types/index.js'

// ─────────────────────────────────────────────────────────────────────────────
// HTML helpers
// ─────────────────────────────────────────────────────────────────────────────

const row = (cells: string[], isEven: boolean) =>
  `<tr style="${isEven ? 'background-color:#f9f9f9;' : ''}">${cells.map((c, i) => `<td style="${i === 0 ? 'text-align:center;width:40px;' : ''}">${c}</td>`).join('')}</tr>`

const headerRow = (headers: string[]) =>
  `<tr>${headers.map((h, i) => `<th style="${i === 0 ? 'width:40px;' : ''}">${h}</th>`).join('')}</tr>`

const formatDate = (d: string) => {
  if (!d) return 'N/A'
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return d }
}

const formatTime = (t: string | null | undefined) => {
  if (!t) return 'N/A'
  try { return new Date(`1970-01-01T${t}`).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) } catch { return t }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main report HTML builder
// ─────────────────────────────────────────────────────────────────────────────

export interface ReportData {
  meeting: Meeting
  organizer: Profile
  departmentName: string
  staffList: AttendanceStaff[]
  visitorList: AttendanceVisitor[]
  staffDeptMap: Record<string, string>   // department_id → name
}

export const buildReportHtml = (data: ReportData): string => {
  const { meeting, staffList, visitorList, staffDeptMap } = data

  const allRows: string[] = []
  let currentSno = 1

  // Staff rows
  for (let i = 0; i < staffList.length; i++) {
    const s = staffList[i]
    const dept = staffDeptMap[s.department_id ?? ''] ?? 'KeNHA'
    const sig = s.signature_data 
      ? `<img src="${s.signature_data}" style="height:35px;max-width:120px;" alt="sig"/>` 
      : ''
    allRows.push(row([String(currentSno), s.full_name, s.designation || 'Staff', dept, sig], currentSno % 2 === 0))
    currentSno++
  }

  // Visitor rows
  for (let i = 0; i < visitorList.length; i++) {
    const v = visitorList[i]
    const sig = v.signature_data 
      ? `<img src="${v.signature_data}" style="height:35px;max-width:120px;" alt="sig"/>` 
      : ''
    allRows.push(row([String(currentSno), v.full_name, v.position_title || 'Visitor', v.organization || 'External', sig], currentSno % 2 === 0))
    currentSno++
  }

  if (allRows.length === 0) {
    allRows.push(`<tr><td colspan="5" style="text-align:center;padding:15px;color:#888;">No attendance recorded</td></tr>`)
  }

  const logoUrl = (data as any).organization_profile?.logo_url ?? ''
  const logoHtml = logoUrl 
    ? `<img src="${logoUrl}" alt="KeNHA Logo" />` 
    : `<div style="width:70px;height:70px;border:1px solid #333;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;">KeNHA<br/>LOGO</div>`

  const generationTime = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const meetingTitle = meeting.title?.toUpperCase() || 'MEETING'
  const meetingRef = `(KeNHA/${meeting.meeting_id ? String(meeting.meeting_id).substring(0, 8) : new Date().getFullYear()}) - ${meetingTitle}`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <style>
    @page {
      size: A4;
      margin: 15mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: Arial, Helvetica, sans-serif; 
      color: #000; 
      background: #fff; 
      font-size: 12px; 
      line-height: 1.3;
      padding-bottom: 40px; /* Space for fixed footer */
    }
    
    /* Header layout */
    .header-table { width: 100%; margin-bottom: 10px; border-collapse: collapse; border: none; }
    .header-table td { border: none; padding: 0; vertical-align: top; }
    .header-logo { width: 100px; }
    .header-logo img { max-width: 80px; max-height: 80px; object-fit: contain; }
    .header-doc-no { text-align: right; font-weight: bold; font-size: 13px; }
    
    .header-title-area { text-align: center; margin-top: -20px; margin-bottom: 20px; }
    .header-kenha { font-size: 20px; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; }
    .header-meeting-title { font-size: 15px; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }
    .header-meeting-ref { font-size: 13px; text-transform: uppercase; }
    
    /* Section Label */
    .section-label { 
      text-align: center; 
      font-weight: bold; 
      font-size: 15px;
      background: #f0f0f0; 
      padding: 6px; 
      margin-bottom: 15px; 
      border: 1px solid #333;
    }
    
    /* Meeting Details Row */
    .details-row { 
      display: flex; 
      justify-content: space-between; 
      margin-bottom: 15px; 
      font-size: 13px;
    }
    .details-row div { font-weight: bold; }
    .details-row span { font-weight: normal; margin-left: 5px; text-transform: uppercase; border-bottom: 1px dotted #333; padding-bottom: 1px; }

    /* Attendance Table */
    table.attendance { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    table.attendance th, table.attendance td { 
      border: 1px solid #333; 
      padding: 6px 8px; 
      font-size: 11px;
      text-align: left;
      vertical-align: middle;
    }
    table.attendance th { 
      background: #003087; 
      color: #fff; 
      font-weight: bold; 
      text-transform: uppercase;
      font-size: 11px;
      border: 1px solid #001a4d;
    }
    
    /* Footer */
    .print-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      width: 100%;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      border-top: 1px solid #333;
      padding-top: 5px;
      background: #fff;
    }
    .print-footer div { color: #333; }
  </style>
</head>
<body>

  <table class="header-table">
    <tr>
      <td class="header-logo">${logoHtml}</td>
      <td class="header-doc-no">KeNHA/DG/F01</td>
    </tr>
  </table>

  <div class="header-title-area">
    <div class="header-kenha">KENYA NATIONAL HIGHWAYS AUTHORITY</div>
    <div class="header-meeting-title">${meetingTitle}</div>
    <div class="header-meeting-ref">${meetingRef}</div>
  </div>

  <div class="section-label">ATTENDANCE REGISTER</div>

  <div class="details-row">
    <div>DATE:<span>${formatDate(meeting.meeting_date)}</span></div>
    <div>TIME:<span>${meeting.start_time || 'N/A'} — ${meeting.end_time || 'N/A'}</span></div>
    <div>VENUE:<span>${meeting.venue || meeting.virtual_link || 'N/A'}</span></div>
  </div>

  <table class="attendance">
    ${headerRow(['S/NO', 'NAME', 'DESIGNATION', 'DEPARTMENT/ORGANIZATION', 'SIGNATURE'])}
    ${allRows.join('\n')}
  </table>

  <div class="print-footer">
    <div>KeNHA/DG/F01</div>
    <div>Kenya National Highways Authority — Confidential</div>
    <div>Generated: ${generationTime}</div>
  </div>

</body>
</html>`
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF generation (puppeteer-core + @sparticuz/chromium — cloud-compatible)
// ─────────────────────────────────────────────────────────────────────────────

export const generatePdfFromHtml = async (html: string): Promise<Buffer> => {
  const puppeteer = (await import('puppeteer-core')).default
  let executablePath: string | undefined

  try {
    const chromium = (await import('@sparticuz/chromium')).default
    executablePath = await chromium.executablePath()
  } catch (e) {
    // Local development fallback for Windows/macOS/Linux
  }

  // Windows local browser paths if chromium package fails locally
  if (!executablePath && process.platform === 'win32') {
    const fs = await import('node:fs')
    const possiblePaths = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Users\\' + (process.env.USERNAME || '') + '\\AppData\\Local\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Users\\' + (process.env.USERNAME || '') + '\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
    ]
    for (const p of possiblePaths) {
      if (p && fs.existsSync(p)) {
        executablePath = p
        break
      }
    }
  }

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    executablePath: executablePath || undefined,
    headless: true,
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load', timeout: 15000 })
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' },
    })
    return Buffer.from(pdfBuffer)
  } finally {
    await browser.close()
  }
}

