import { supabaseAdmin } from '../../config/supabase.js'
import { analyzeTemplate } from './analyzer.service.js'

export async function uploadTemplate(file: File, name: string, description: string, category: string, userId: string) {
  if (file.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    throw new Error('Invalid file type. Only DOCX is supported.')
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  
  const meta = analyzeTemplate(buffer)
  
  const { data: template, error: templateError } = await supabaseAdmin
    .from('document_templates')
    .insert({
      name,
      description,
      category,
      created_by: userId,
      is_active: true
    })
    .select('*')
    .single()
    
  if (templateError) throw templateError

  const filePath = `templates/${template.id}/v1.docx`
  
  const { error: uploadError } = await supabaseAdmin.storage
    .from('kmtams-documents')
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: true
    })
    
  if (uploadError) throw uploadError

  const { error: versionError } = await supabaseAdmin
    .from('template_versions')
    .insert({
      template_id: template.id,
      version_number: 1,
      file_path: filePath,
      created_by: userId,
      changelog: 'Initial version',
      meta: meta
    })
    
  if (versionError) throw versionError

  return template
}

export async function listTemplates() {
  const { data, error } = await supabaseAdmin
    .from('document_templates')
    .select('*')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    
  if (error) throw error
  return data
}

export async function getTemplate(id: string) {
  const { data, error } = await supabaseAdmin
    .from('document_templates')
    .select(`
      *,
      template_versions (*)
    `)
    .eq('id', id)
    .single()
    
  if (error) throw error
  return data
}

export async function updateTemplate(id: string, updates: any) {
  const { data, error } = await supabaseAdmin
    .from('document_templates')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()
    
  if (error) throw error
  return data
}

export async function uploadNewVersion(templateId: string, file: File, changelog: string, userId: string) {
  if (file.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    throw new Error('Invalid file type. Only DOCX is supported.')
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  
  const meta = analyzeTemplate(buffer)
  
  // Get latest version number
  const { data: versions, error: versionsError } = await supabaseAdmin
    .from('template_versions')
    .select('version_number')
    .eq('template_id', templateId)
    .order('version_number', { ascending: false })
    .limit(1)
    
  if (versionsError) throw versionsError
  
  const nextVersion = (versions && versions.length > 0) ? versions[0].version_number + 1 : 1
  const filePath = `templates/${templateId}/v${nextVersion}.docx`
  
  const { error: uploadError } = await supabaseAdmin.storage
    .from('kmtams-documents')
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: true
    })
    
  if (uploadError) throw uploadError

  const { data: version, error: versionError } = await supabaseAdmin
    .from('template_versions')
    .insert({
      template_id: templateId,
      version_number: nextVersion,
      file_path: filePath,
      created_by: userId,
      changelog,
      meta: meta
    })
    .select('*')
    .single()
    
  if (versionError) throw versionError

  return version
}

export async function deleteTemplate(id: string) {
  const { error } = await supabaseAdmin
    .from('document_templates')
    .update({ is_active: false })
    .eq('id', id)
    
  if (error) throw error
}

export async function getTemplateFile(templateId: string, version?: number) {
  let filePath = ''
  
  if (version) {
    filePath = `templates/${templateId}/v${version}.docx`
  } else {
    // Get latest version
    const { data: versions, error: versionsError } = await supabaseAdmin
      .from('template_versions')
      .select('version_number')
      .eq('template_id', templateId)
      .order('version_number', { ascending: false })
      .limit(1)
      
    if (versionsError || !versions || versions.length === 0) {
      throw new Error('Template version not found')
    }
    
    filePath = `templates/${templateId}/v${versions[0].version_number}.docx`
  }
  
  const { data } = supabaseAdmin.storage
    .from('kmtams-documents')
    .getPublicUrl(filePath)
    
  return data.publicUrl
}

export async function setDefaultTemplate(templateId: string) {
  // First, get the template to find its category
  const { data: template, error: templateError } = await supabaseAdmin
    .from('document_templates')
    .select('category')
    .eq('id', templateId)
    .single()
    
  if (templateError) throw templateError
  
  // Unset all defaults in this category
  await supabaseAdmin
    .from('document_templates')
    .update({ is_default: false })
    .eq('category', template.category)
    
  // Set this one as default
  const { data, error } = await supabaseAdmin
    .from('document_templates')
    .update({ is_default: true })
    .eq('id', templateId)
    .select('*')
    .single()
    
  if (error) throw error
  return data
}
