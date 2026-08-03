import PizZip from 'pizzip';
import { isValidPlaceholder } from '../placeholders/registry.js';
export function analyzeTemplate(docxBuffer) {
    let zip;
    try {
        zip = new PizZip(docxBuffer);
    }
    catch (err) {
        throw new Error('Invalid DOCX file');
    }
    const meta = {
        headers: 0,
        footers: 0,
        tables: 0,
        images: 0,
        placeholders: [],
        unknownPlaceholders: [],
        warnings: [],
    };
    const files = zip.file(/word\/(document|header\d+|footer\d+)\.xml/);
    meta.headers = zip.file(/word\/header\d+\.xml/).length;
    meta.footers = zip.file(/word\/footer\d+\.xml/).length;
    const allPlaceholders = new Set();
    for (const file of files) {
        const content = file.asText();
        // Count tables
        const tableMatches = content.match(/<w:tbl>/g);
        if (tableMatches) {
            meta.tables += tableMatches.length;
        }
        // Count images
        const imageMatches = content.match(/<(w:drawing|wp:inline)>/g);
        if (imageMatches) {
            meta.images += imageMatches.length;
        }
        // Extract text content by stripping XML tags
        const plainText = content.replace(/<[^>]+>/g, '');
        // Find placeholders
        const placeholderRegex = /{[#/%]?([a-zA-Z_.]+)}/g;
        let match;
        while ((match = placeholderRegex.exec(plainText)) !== null) {
            allPlaceholders.add(match[1]); // capture the name without prefixes
        }
    }
    for (const p of allPlaceholders) {
        if (isValidPlaceholder(p)) {
            meta.placeholders.push(p);
        }
        else {
            meta.unknownPlaceholders.push(p);
            meta.warnings.push(`Unknown placeholder: ${p}`);
        }
    }
    return meta;
}
