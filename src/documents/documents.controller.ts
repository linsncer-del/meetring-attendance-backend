import type { Context } from 'hono'
import * as TemplateService from './services/template.service.js'
import * as AssetService from './services/asset.service.js'
import * as DocumentDataService from './services/documentData.service.js'
import * as RendererService from './services/renderer.service.js'
import { PLACEHOLDER_REGISTRY } from './placeholders/registry.js'
import {
  ok, created, badRequest, notFound, serverError
} from '../utils/response.js'
import { UpdateTemplateSchema, RenderDocumentSchema, UpdateOrganizationSchema } from '../utils/validators.js'
import { writeAuditLog } from '../middleware/audit.middleware.js'
import { getClientIp } from '../utils/ip.js'
import type { HonoVariables } from '../types/index.js'
import { supabaseAdmin } from '../config/supabase.js'

// Templates
export const listTemplates = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const templates = await TemplateService.listTemplates()
    return ok(c, templates)
  } catch {
    return serverError(c)
  }
}

export const getTemplate = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const template = await TemplateService.getTemplate(c.req.param('id') || '')
    return ok(c, template)
  } catch {
    return notFound(c)
  }
}

export const uploadTemplate = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const user = c.get('user')
    const body = await c.req.parseBody({ all: true })
    const file = body['file'] as File
    const name = body['name'] as string
    const description = body['description'] as string
    const category = body['category'] as string

    if (!file || !name || !category) {
      return badRequest(c, 'Missing required fields')
    }

    const template = await TemplateService.uploadTemplate(file, name, description, category, user.id)
    writeAuditLog(user.id, 'template_uploaded', `Template uploaded: ${name}`, c.req.header('x-forwarded-for') ?? undefined)
    
    return created(c, template)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    return badRequest(c, message)
  }
}

export const updateTemplate = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const user = c.get('user')
    const id = c.req.param('id') || ''
    const body = await c.req.json()
    const updates = UpdateTemplateSchema.parse(body)
    
    const template = await TemplateService.updateTemplate(id, updates)
    writeAuditLog(user.id, 'template_updated', `Template updated: ${template.name}`, c.req.header('x-forwarded-for') ?? undefined)
    
    return ok(c, template)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Update failed'
    return badRequest(c, message)
  }
}

export const deleteTemplate = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const id = c.req.param('id') || ''
    await TemplateService.deleteTemplate(id)
    return ok(c, { message: 'Template deleted successfully' })
  } catch {
    return serverError(c)
  }
}

export const uploadNewVersion = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const user = c.get('user')
    const id = c.req.param('id') || ''
    const body = await c.req.parseBody({ all: true })
    const file = body['file'] as File
    const changelog = body['changelog'] as string || 'New version uploaded'

    if (!file) {
      return badRequest(c, 'File is required')
    }

    const version = await TemplateService.uploadNewVersion(id, file, changelog, user.id)
    writeAuditLog(user.id, 'template_updated', `New version uploaded for template: ${id}`, c.req.header('x-forwarded-for') ?? undefined)
    
    return created(c, version)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    return badRequest(c, message)
  }
}

export const downloadTemplate = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const id = c.req.param('id') || ''
    const versionParam = c.req.query('version')
    const version = versionParam ? parseInt(versionParam, 10) : undefined
    
    const url = await TemplateService.getTemplateFile(id, version)
    return ok(c, { download_url: url })
  } catch {
    return notFound(c)
  }
}

export const setDefaultTemplate = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const user = c.get('user')
    const id = c.req.param('id') || ''
    const template = await TemplateService.setDefaultTemplate(id)
    
    writeAuditLog(user.id, 'template_updated', `Template set as default: ${template.name}`, c.req.header('x-forwarded-for') ?? undefined)
    
    return ok(c, template)
  } catch {
    return serverError(c)
  }
}

export const getPlaceholders = async (c: Context<{ Variables: HonoVariables }>) => {
  return ok(c, PLACEHOLDER_REGISTRY)
}

// Assets
export const listAssets = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const type = c.req.query('type')
    const assets = await AssetService.listAssets(type)
    return ok(c, assets)
  } catch {
    return serverError(c)
  }
}

export const uploadAsset = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const user = c.get('user')
    const body = await c.req.parseBody({ all: true })
    const file = body['file'] as File
    const name = body['name'] as string
    const assetType = body['asset_type'] as string

    if (!file || !name || !assetType) {
      return badRequest(c, 'Missing required fields')
    }

    const asset = await AssetService.uploadAsset(file, name, assetType, user.id)
    writeAuditLog(user.id, 'asset_uploaded', `Asset uploaded: ${name}`, c.req.header('x-forwarded-for') ?? undefined)
    
    return created(c, asset)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    return badRequest(c, message)
  }
}

export const deleteAsset = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const id = c.req.param('id') || ''
    await AssetService.deleteAsset(id)
    return ok(c, { message: 'Asset deleted successfully' })
  } catch {
    return serverError(c)
  }
}

// Organization Profile
export const getOrganizationProfile = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const profile = await AssetService.getOrganizationProfile()
    return ok(c, profile || {})
  } catch {
    return serverError(c)
  }
}

export const updateOrganizationProfile = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const user = c.get('user')
    const body = await c.req.json()
    const updates = UpdateOrganizationSchema.parse(body)
    
    const profile = await AssetService.updateOrganizationProfile(updates)
    writeAuditLog(user.id, 'asset_uploaded', `Organization profile updated`, c.req.header('x-forwarded-for') ?? undefined)
    
    return ok(c, profile)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Update failed'
    return badRequest(c, message)
  }
}

// Rendering
export const getMeetingDocumentData = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const user = c.get('user')
    const meetingId = c.req.param('meetingId') || ''
    const data = await DocumentDataService.getMeetingDocumentData(meetingId, user.id)
    return ok(c, data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Data fetch failed'
    return badRequest(c, message)
  }
}

export const renderDocument = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const user = c.get('user')
    const meetingId = c.req.param('meetingId')
    if (!meetingId) {
      return badRequest(c, 'meetingId is required')
    }
    const body = await c.req.json().catch(() => ({}))
    const options = RenderDocumentSchema.parse(body)
    
    const result = await RendererService.renderDocument({
      templateId: options.template_id,
      meetingId,
      format: options.format,
      version: options.version,
      documentNumber: options.document_number,
      userId: user.id,
      scope: options.scope
    })
    
    writeAuditLog(user.id, 'document_generated', `Document generated for meeting: ${meetingId}`, c.req.header('x-forwarded-for') ?? undefined)
    
    return created(c, result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Render failed'
    console.error('[RenderDocument Error]', err)
    return badRequest(c, message)
  }
}

export const listGeneratedDocuments = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const meetingId = c.req.query('meetingId')
    let query = supabaseAdmin
      .from('generated_documents')
      .select('*')
      .order('created_at', { ascending: false })
      
    if (meetingId) {
      query = query.eq('meeting_id', meetingId)
    }
    
    const { data, error } = await query
    if (error) throw error
    
    return ok(c, data)
  } catch {
    return serverError(c)
  }
}

export const downloadGeneratedDocument = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const id = c.req.param('id') || ''
    const { data, error } = await supabaseAdmin
      .from('generated_documents')
      .select('file_path')
      .eq('document_id', id)
      .single()
      
    if (error || !data) throw new Error('Not found')
    
    const { data: publicUrlData } = supabaseAdmin.storage
      .from('kmtams-assets')
      .getPublicUrl(data.file_path)

    return ok(c, { download_url: publicUrlData.publicUrl })
  } catch {
    return notFound(c)
  }
}

// POST /api/documents/register-pdf/:meetingId
// One-click download of the attendance register, rendered from the very markup
// the organiser is looking at.
export const renderRegisterPdf = async (c: Context<{ Variables: HonoVariables }>) => {
  try {
    const user = c.get('user')

    let body: any
    try {
      body = await c.req.json()
    } catch (parseErr) {
      console.error('[Register PDF] Could not read the request body:', parseErr)
      return badRequest(c, 'The register document could not be read by the server (body parse failed).')
    }

    const html = typeof body?.html === 'string' ? body.html : ''
    if (!html.trim()) return badRequest(c, 'No register content was supplied')

    // Signatures and banners are inline data URIs, so these documents are large
    // by nature. The ceiling exists to bound memory, not to be hit in practice.
    const MAX_HTML_BYTES = 25_000_000
    if (html.length > MAX_HTML_BYTES) {
      return badRequest(
        c,
        `Register document is ${(html.length / 1_000_000).toFixed(1)}MB, over the ${MAX_HTML_BYTES / 1_000_000}MB limit. Try downloading staff and visitors separately.`
      )
    }

    const { buffer } = await RendererService.renderRegisterPdf({
      meetingId: c.req.param('meetingId') || '',
      userId: user.id,
      html,
      landscape: body?.orientation !== 'portrait',
    })

    const ip = getClientIp(c)
    writeAuditLog(user.id, 'report_generated', `Downloaded attendance register for meeting ${c.req.param('meetingId')}`, ip)

    c.header('Content-Type', 'application/pdf')
    c.header('Content-Disposition', `attachment; filename="attendance-register.pdf"`)
    return c.body(new Uint8Array(buffer))
  } catch (err: unknown) {
    // The render depends on a headless Chromium being present; when it is not,
    // the underlying message is the only useful diagnostic, so surface it.
    console.error('[Register PDF] Render failed:', err)
    const message = err instanceof Error ? err.message : 'Could not build the register PDF'
    return badRequest(c, `Register PDF failed: ${message}`)
  }
}
