import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { listTemplates, getTemplate, uploadTemplate, updateTemplate, deleteTemplate, uploadNewVersion, downloadTemplate, setDefaultTemplate, getPlaceholders, listAssets, uploadAsset, deleteAsset, getOrganizationProfile, updateOrganizationProfile, getMeetingDocumentData, renderDocument, listGeneratedDocuments, downloadGeneratedDocument } from './documents.controller.js';
const router = new Hono();
router.use('*', authMiddleware);
// Templates (ict_admin for write)
router.get('/templates', listTemplates);
router.get('/templates/:id', getTemplate);
router.post('/templates', requireRole(['ict_admin']), uploadTemplate);
router.patch('/templates/:id', requireRole(['ict_admin']), updateTemplate);
router.delete('/templates/:id', requireRole(['ict_admin']), deleteTemplate);
router.post('/templates/:id/versions', requireRole(['ict_admin']), uploadNewVersion);
router.get('/templates/:id/download', downloadTemplate);
router.post('/templates/:id/set-default', requireRole(['ict_admin']), setDefaultTemplate);
// Placeholders
router.get('/placeholders', getPlaceholders);
// Assets (ict_admin for write)
router.get('/assets', listAssets);
router.post('/assets', requireRole(['ict_admin']), uploadAsset);
router.delete('/assets/:id', requireRole(['ict_admin']), deleteAsset);
// Organization Profile (ict_admin for write)
router.get('/organization', getOrganizationProfile);
router.patch('/organization', requireRole(['ict_admin']), updateOrganizationProfile);
// Rendering & Document Data
router.get('/meetings/:meetingId/data', getMeetingDocumentData);
router.post('/render/:meetingId', requireRole(['meeting_creator', 'hr_officer', 'ict_admin']), renderDocument);
// Generated Documents
router.get('/generated', listGeneratedDocuments);
router.get('/generated/:id/download', downloadGeneratedDocument);
export default router;
