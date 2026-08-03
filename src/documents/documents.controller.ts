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
    const body = await c.req.json()
    const options = RenderDocumentSchema.parse(body)
    
    const result = await RendererService.renderDocument({
      templateId: options.template_id,
      meetingId,
      format: options.format,
      version: options.version,
      documentNumber: options.document_number,
      userId: user.id
    })
    
    writeAuditLog(user.id, 'document_generated', `Document generated for meeting: ${meetingId}`, c.req.header('x-forwarded-for') ?? undefined)
    
    return created(c, result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Render failed'
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
      .select('file_url')
      .eq('id', id)
      .single()
      
    if (error || !data) throw new Error('Not found')
    
    return ok(c, { download_url: data.file_url })
  } catch {
    return notFound(c)
  }
}
