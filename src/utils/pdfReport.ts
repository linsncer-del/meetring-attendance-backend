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

// Finds a usable Chromium: the bundled one in a serverless environment, or a
// locally installed Edge / Chrome during development.
// Where a desktop Chromium normally lives, per platform.
const chromeCandidates = async (): Promise<string[]> => {
  const path = await import('node:path')

  if (process.platform === 'win32') {
    const programFiles = process.env.ProgramFiles ?? 'C:/Program Files'
    const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:/Program Files (x86)'
    const localAppData = process.env.LOCALAPPDATA ?? ''
    const roots = [programFiles, programFilesX86, localAppData].filter(Boolean)
    const apps: [string, string, string][] = [
      ['Microsoft', 'Edge', 'msedge.exe'],
      ['Google', 'Chrome', 'chrome.exe'],
      ['Chromium', 'Application', 'chrome.exe'],
    ]
    const out: string[] = []
    for (const root of roots) {
      for (const [vendor, product, exe] of apps) {
        out.push(
          product === 'Application'
            ? path.join(root, vendor, product, exe)
            : path.join(root, vendor, product, 'Application', exe)
        )
      }
    }
    return out
  }

  if (process.platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ]
  }

  return [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
    '/snap/bin/chromium',
  ]
}

// Locates a Chromium to render with.
//
// Order matters. @sparticuz/chromium ships a Linux binary for serverless
// deployments; on Windows its executablePath() still returns a path under the
// temp directory that was never created, so it must be verified rather than
// trusted. An unchecked truthy value there is what produced
// "spawn ...Temp\chromium ENOENT" and skipped the local-browser fallback.
const resolveChromePath = async (): Promise<string | undefined> => {
  const fs = await import('node:fs')
  const usable = (candidate?: string | null) =>
    candidate && fs.existsSync(candidate) ? candidate : undefined

  // 1. An explicit override always wins.
  const configured = usable(process.env.PUPPETEER_EXECUTABLE_PATH) ?? usable(process.env.CHROME_PATH)
  if (configured) return configured

  // 2. The bundled serverless binary, but only where it is real.
  if (process.platform === 'linux') {
    try {
      const chromium = (await import('@sparticuz/chromium')).default
      const bundled = usable(await chromium.executablePath())
      if (bundled) return bundled
    } catch {
      // Not installed or not extractable here; fall through to a local browser.
    }
  }

  // 3. A locally installed Edge / Chrome / Chromium.
  for (const candidate of await chromeCandidates()) {
    const found = usable(candidate)
    if (found) return found
  }

  return undefined
}

const launchBrowser = async () => {
  const puppeteer = (await import('puppeteer-core')).default
  const executablePath = await resolveChromePath()

  if (!executablePath) {
    throw new Error(
      'No Chrome, Edge or Chromium installation was found for PDF rendering. ' +
        'Install one, or set PUPPETEER_EXECUTABLE_PATH to its executable.'
    )
  }

  return puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    executablePath,
    headless: true,
  })
}

// Renders a complete, self-contained HTML document exactly as authored: the
// page box comes from the document's own @page rule, not from margins imposed
// here, so a register laid out in the browser prints identically.
//
// The document is treated as untrusted. Scripts are disabled and every network
// request is aborted, so the headless browser cannot be steered into fetching
// internal URLs or local files — every image must already be a data: URI.
export const generatePdfFromDocument = async (
  html: string,
  landscape: boolean
): Promise<Buffer> => {
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    await page.setJavaScriptEnabled(false)
    // Offline mode fails every network fetch while leaving setContent and
    // data: URIs working, so the document cannot reach internal hosts or files.
    await page.setOfflineMode(true)

    await page.setContent(html, { waitUntil: 'load', timeout: 20000 })
    const pdfBuffer = await page.pdf({
      preferCSSPageSize: true,
      landscape,
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    })
    return Buffer.from(pdfBuffer)
  } finally {
    await browser.close()
  }
}

export const generatePdfFromHtml = async (html: string): Promise<Buffer> => {
  const browser = await launchBrowser()

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

