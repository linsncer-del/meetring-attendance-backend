// ─────────────────────────────────────────────────────────────────────────────
// HTML helpers
// ─────────────────────────────────────────────────────────────────────────────
const row = (cells, bg = '#fff') => `<tr style="background:${bg}">${cells.map(c => `<td style="padding:8px 12px;border:1px solid #dde3f0;font-size:13px;">${c}</td>`).join('')}</tr>`;
const headerRow = (headers) => `<tr>${headers.map(h => `<th style="padding:10px 12px;background:#003087;color:#fff;text-align:left;font-size:13px;border:1px solid #002070;">${h}</th>`).join('')}</tr>`;
const formatDate = (d) => new Date(d).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' });
const formatTime = (t) => {
    if (!t)
        return 'N/A';
    try {
        return new Date(t).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
    }
    catch {
        return t;
    }
};
export const buildReportHtml = (data) => {
    const { meeting, organizer, departmentName, staffList, visitorList, staffDeptMap } = data;
    const totalStaff = staffList.length;
    const totalVisitors = visitorList.length;
    const total = totalStaff + totalVisitors;
    const staffRows = staffList.length
        ? staffList.map((s, i) => row([
            String(i + 1),
            s.full_name,
            s.designation,
            staffDeptMap[s.department_id ?? ''] ?? '—',
            formatTime(s.submitted_at),
            s.signature_data
                ? `<img src="${s.signature_data}" style="height:40px;max-width:150px;" alt="sig"/>`
                : '—'
        ], i % 2 === 0 ? '#fff' : '#f5f7ff')).join('')
        : `<tr><td colspan="6" style="text-align:center;padding:16px;color:#888;">No staff attendance recorded</td></tr>`;
    const visitorRows = visitorList.length
        ? visitorList.map((v, i) => row([
            String(i + 1),
            v.full_name,
            v.organization,
            v.position_title ?? '—',
            v.purpose,
            formatTime(v.submitted_at),
            v.signature_data
                ? `<img src="${v.signature_data}" style="height:40px;max-width:150px;" alt="sig"/>`
                : '—'
        ], i % 2 === 0 ? '#fff' : '#f5f7ff')).join('')
        : `<tr><td colspan="7" style="text-align:center;padding:16px;color:#888;">No visitor attendance recorded</td></tr>`;
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; color: #222; background: #fff; padding: 30px; }
    .header { display: flex; align-items: center; gap: 20px; border-bottom: 4px solid #003087; padding-bottom: 15px; margin-bottom: 20px; }
    .header img { height: 60px; }
    .header-text h1 { font-size: 18px; color: #003087; }
    .header-text p { font-size: 13px; color: #555; }
    .section-title { background: #003087; color: #fff; padding: 8px 14px; font-size: 14px; font-weight: bold; margin: 24px 0 0; border-radius: 4px 4px 0 0; }
    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: #f5f7ff; padding: 16px; border: 1px solid #dde3f0; margin-bottom: 0; }
    .detail-item label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
    .detail-item p { font-size: 14px; color: #111; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; }
    .summary-box { display: flex; gap: 16px; margin: 20px 0; }
    .summary-card { flex: 1; background: #f0f4ff; border: 1px solid #c5d3f7; border-radius: 8px; padding: 16px; text-align: center; }
    .summary-card .num { font-size: 32px; font-weight: bold; color: #003087; }
    .summary-card .lbl { font-size: 12px; color: #555; margin-top: 4px; }
    .footer { margin-top: 30px; border-top: 2px solid #dde3f0; padding-top: 14px; font-size: 11px; color: #888; display: flex; justify-content: space-between; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; }
    .badge-physical { background: #e8f5e9; color: #2e7d32; }
    .badge-virtual { background: #e3f2fd; color: #1565c0; }
    .badge-hybrid { background: #fff3e0; color: #e65100; }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div class="header-text">
      <h1>Kenya National Highways Authority (KeNHA)</h1>
      <p>Meeting &amp; Training Attendance Management System (KMTAMS)</p>
      <p style="margin-top:4px;font-size:12px;color:#888;">Official Attendance Report — Generated ${new Date().toLocaleString('en-KE')}</p>
    </div>
  </div>

  <!-- Meeting Details -->
  <div class="section-title">Meeting / Training Details</div>
  <div class="detail-grid">
    <div class="detail-item"><label>Title</label><p>${meeting.title}</p></div>
    <div class="detail-item"><label>Type</label><p><span class="badge badge-${meeting.meeting_type}">${meeting.meeting_type.toUpperCase()}</span></p></div>
    <div class="detail-item"><label>Date</label><p>${formatDate(meeting.meeting_date)}</p></div>
    <div class="detail-item"><label>Time</label><p>${meeting.start_time} — ${meeting.end_time}</p></div>
    <div class="detail-item"><label>Venue</label><p>${meeting.venue ?? '—'}</p></div>
    <div class="detail-item"><label>Virtual Link</label><p>${meeting.virtual_link ?? '—'}</p></div>
    <div class="detail-item"><label>Department</label><p>${departmentName}</p></div>
    <div class="detail-item"><label>Organizer</label><p>${organizer.full_name}</p></div>
  </div>

  <!-- Summary -->
  <div class="section-title" style="margin-top:24px;">Attendance Summary</div>
  <div class="summary-box">
    <div class="summary-card"><div class="num">${total}</div><div class="lbl">Total Attendance</div></div>
    <div class="summary-card"><div class="num">${totalStaff}</div><div class="lbl">KeNHA Staff</div></div>
    <div class="summary-card"><div class="num">${totalVisitors}</div><div class="lbl">Visitors / External</div></div>
  </div>

  <!-- Staff Register -->
  <div class="section-title">Organization Staff Register</div>
  <table>
    ${headerRow(['#', 'Full Name', 'Designation', 'Department', 'Time', 'Signature'])}
    ${staffRows}
  </table>

  <!-- Visitor Register -->
  <div class="section-title" style="margin-top:24px;">Visitor / External Participant Register</div>
  <table>
    ${headerRow(['#', 'Full Name', 'Organization', 'Position', 'Purpose', 'Time', 'Signature'])}
    ${visitorRows}
  </table>

  <!-- Footer -->
  <div class="footer">
    <span>KeNHA KMTAMS — Confidential Official Document</span>
    <span>Report ID: ${meeting.meeting_id} &nbsp;|&nbsp; Printed: ${new Date().toLocaleString('en-KE')}</span>
  </div>

</body>
</html>
`;
};
// ─────────────────────────────────────────────────────────────────────────────
// PDF generation (puppeteer-core + @sparticuz/chromium — cloud-compatible)
// ─────────────────────────────────────────────────────────────────────────────
export const generatePdfFromHtml = async (html) => {
    // Dynamic imports to avoid startup cost when PDF is not needed
    const chromium = (await import('@sparticuz/chromium')).default;
    const puppeteer = (await import('puppeteer-core')).default;
    const browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: true,
    });
    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '15mm', bottom: '15mm', left: '12mm', right: '12mm' },
        });
        return Buffer.from(pdfBuffer);
    }
    finally {
        await browser.close();
    }
};
