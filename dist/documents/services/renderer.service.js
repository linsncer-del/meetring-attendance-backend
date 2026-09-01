import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
// @ts-ignore
import ImageModule from 'docxtemplater-image-module-free';
import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '../../config/supabase.js';
import { getTemplateFile } from './template.service.js';
import { getMeetingDocumentData } from './documentData.service.js';
import { generatePdfFromHtml, buildReportHtml } from '../../utils/pdfReport.js';
export async function renderDocument(options) {
    // Fetch the meeting/attendance data needed for every render, and (if a
    // template was requested) look up which template file to use — these
    // are independent of each other, so run them concurrently instead of
    // waiting on the full document-data fetch before even starting the
    // template lookup.
    const [documentData, templateUrl] = await Promise.all([
        getMeetingDocumentData(options.meetingId, options.userId, options.scope),
        options.templateId ? getTemplateFile(options.templateId, options.version) : Promise.resolve(null),
    ]);
    let finalBuffer = null;
    let finalFormat = options.format;
    let useBuiltInFallback = false;
    if (options.templateId && templateUrl) {
        try {
            const templateResponse = await fetch(templateUrl);
            if (!templateResponse.ok) {
                throw new Error('Failed to fetch template');
            }
            const templateBuffer = Buffer.from(await templateResponse.arrayBuffer());
            // Setup image module options
            const imageOptions = {
                getImage: function (tagValue, tagName) {
                    return new Promise((resolve, reject) => {
                        if (!tagValue) {
                            resolve(Buffer.from(''));
                            return;
                        }
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
            // Use docxtemplater to replace placeholders
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
            finalBuffer = outputDocxBuffer;
        }
        catch (err) {
            console.warn("Template processing failed, falling back to built-in.", err);
            useBuiltInFallback = true;
        }
    }
    else {
        useBuiltInFallback = true;
    }
    if (useBuiltInFallback) {
        // Map DocumentData to ReportData structure expected by buildReportHtml
        const staffDeptMap = {};
        for (const p of documentData.participants) {
            if (p.type === 'staff' && p.department) {
                staffDeptMap[p.department] = p.department;
            }
        }
        const reportData = {
            meeting: {
                meeting_id: options.meetingId,
                title: documentData.meeting.title,
                meeting_type: documentData.meeting.type,
                meeting_date: documentData.meeting.date,
                start_time: documentData.meeting.time.split(' - ')[0] || '',
                end_time: documentData.meeting.time.split(' - ')[1] || '',
                venue: documentData.meeting.venue,
                virtual_link: documentData.meeting.reference
            },
            organizer: { full_name: documentData.meeting.organizer },
            departmentName: documentData.meeting.department || 'N/A',
            staffList: documentData.participants.filter(p => p.type === 'staff').map(p => ({
                full_name: p.name,
                designation: p.designation,
                department_id: p.department || '',
                submitted_at: documentData.document.date,
                signature_data: p.signature
            })),
            visitorList: documentData.participants.filter(p => p.type === 'visitor').map(p => ({
                full_name: p.name,
                organization: p.organization,
                position_title: p.designation,
                purpose: 'N/A',
                submitted_at: documentData.document.date,
                signature_data: p.signature
            })),
            staffDeptMap
        };
        const htmlContent = buildReportHtml(reportData);
        finalBuffer = await generatePdfFromHtml(htmlContent);
        finalFormat = 'pdf';
    }
    if (!finalBuffer) {
        throw new Error('Failed to generate document buffer');
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
    if (uploadError) {
        console.error('[Renderer Service] Storage upload failed:', uploadError);
        throw new Error(`Storage upload failed: ${uploadError.message}`);
    }
    const { data: publicUrlData } = supabaseAdmin.storage
        .from('kmtams-assets')
        .getPublicUrl(filePath);
    const downloadUrl = publicUrlData.publicUrl;
    // Create generated_documents record (non-fatal if table not migrated)
    try {
        const { error: dbError } = await supabaseAdmin
            .from('generated_documents')
            .insert({
            document_id: documentId,
            template_id: options.templateId || null,
            version_used: options.version ?? 1,
            meeting_id: options.meetingId,
            generated_by: options.userId,
            file_path: filePath,
            format: finalFormat,
            document_number: options.documentNumber ?? null
        });
        if (dbError) {
            console.warn('[Renderer Service] generated_documents record warning:', dbError.message);
        }
    }
    catch (dbErr) {
        console.warn('[Renderer Service] generated_documents insert notice:', dbErr);
    }
    return { downloadUrl, format: finalFormat, documentId };
}
