import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
// @ts-ignore
import ImageModule from 'docxtemplater-image-module-free';
import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '../../config/supabase.js';
import { getTemplateFile } from './template.service.js';
import { getMeetingDocumentData } from './documentData.service.js';
import { generatePdfFromHtml } from '../../utils/pdfReport.js';
export async function renderDocument(options) {
    // 1. Fetch template version file from storage
    const templateUrl = await getTemplateFile(options.templateId, options.version);
    const templateResponse = await fetch(templateUrl);
    const templateBuffer = Buffer.from(await templateResponse.arrayBuffer());
    // 2. Get meeting document data
    const documentData = await getMeetingDocumentData(options.meetingId, options.userId);
    // 3. Setup image module options
    const imageOptions = {
        getImage: function (tagValue, tagName) {
            return new Promise((resolve, reject) => {
                if (!tagValue) {
                    resolve(Buffer.from(''));
                    return;
                }
                // Handle base64 or url
                if (tagValue.startsWith('data:image')) {
                    const base64Data = tagValue.replace(/^data:image\/\w+;base64,/, "");
                    resolve(Buffer.from(base64Data, 'base64'));
                }
                else if (tagValue.startsWith('http')) {
                    fetch(tagValue)
                        .then(res => res.arrayBuffer())
                        .then(buf => resolve(Buffer.from(buf)))
                        .catch(err => reject(err));
                }
                else {
                    resolve(Buffer.from(''));
                }
            });
        },
        getSize: function (img, tagValue, tagName) {
            if (tagName === 'signature')
                return [150, 50];
            if (tagName === 'organization.logo')
                return [100, 100];
            return [100, 100];
        }
    };
    // 4. Use docxtemplater to replace placeholders
    let doc;
    try {
        const zip = new PizZip(templateBuffer);
        doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            modules: [new ImageModule(imageOptions)]
        });
    }
    catch (err) {
        // Fallback if image module fails
        const zip = new PizZip(templateBuffer);
        doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true
        });
    }
    await doc.renderAsync(documentData);
    const outputDocxBuffer = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE'
    });
    let finalBuffer;
    let finalFormat = options.format;
    if (options.format === 'pdf') {
        // Simple HTML fallback for PDF generation
        const htmlContent = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            th { background-color: #f4f4f4; }
          </style>
        </head>
        <body>
          <h1>${documentData.organization.name}</h1>
          <h2>Meeting: ${documentData.meeting.title}</h2>
          <p><strong>Date:</strong> ${documentData.meeting.date}</p>
          <p><strong>Time:</strong> ${documentData.meeting.time}</p>
          <p><strong>Venue:</strong> ${documentData.meeting.venue}</p>
          
          <h3>Participants</h3>
          <table>
            <thead>
              <tr>
                <th>S/No</th>
                <th>Name</th>
                <th>Designation</th>
                <th>Organization/Dept</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${documentData.participants.map(p => `
                <tr>
                  <td>${p.sno}</td>
                  <td>${p.name}</td>
                  <td>${p.designation}</td>
                  <td>${p.organization || p.department}</td>
                  <td>${p.status}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
        // Assuming generatePdfFromHtml returns a Buffer
        finalBuffer = await generatePdfFromHtml(htmlContent);
    }
    else {
        finalBuffer = outputDocxBuffer;
    }
    const documentId = randomUUID();
    const filePath = `generated-docs/${documentId}.${finalFormat}`;
    // Upload to storage
    const { error: uploadError } = await supabaseAdmin.storage
        .from('kmtams-assets')
        .upload(filePath, finalBuffer, {
        contentType: finalFormat === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true
    });
    if (uploadError)
        throw uploadError;
    const { data: publicUrlData } = supabaseAdmin.storage
        .from('kmtams-assets')
        .getPublicUrl(filePath);
    const downloadUrl = publicUrlData.publicUrl;
    // Create generated_documents record
    const { error: dbError } = await supabaseAdmin
        .from('generated_documents')
        .insert({
        document_id: documentId,
        template_id: options.templateId,
        version_used: options.version ?? 1,
        meeting_id: options.meetingId,
        generated_by: options.userId,
        file_path: filePath,
        format: finalFormat,
        document_number: options.documentNumber ?? null
    });
    if (dbError)
        throw dbError;
    return { downloadUrl, format: finalFormat, documentId };
}
