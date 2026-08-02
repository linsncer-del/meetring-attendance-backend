import { supabaseAdmin } from '../config/supabase.js'
import type { Department } from '../types/index.js'
import type { CreateDepartmentInput, UpdateDepartmentInput } from '../utils/validators.js'

// ── List all departments ──────────────────────────────────────────────

export const listDepartments = async (): Promise<Department[]> => {
  const { data, error } = await supabaseAdmin
    .from('departments')
    .select('*')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return data as Department[]
}

// ── Get single department ─────────────────────────────────────────────

export const getDepartmentById = async (id: string): Promise<Department> => {
  const { data, error } = await supabaseAdmin
    .from('departments')
    .select('*')
    .eq('department_id', id)
    .single()

  if (error || !data) throw new Error('Department not found')
  return data as Department
}

// ── Create department ─────────────────────────────────────────────────

export const createDepartment = async (
  input: CreateDepartmentInput
): Promise<Department> => {
  const { data, error } = await supabaseAdmin
    .from('departments')
    .insert({
      department_code: input.department_code.toUpperCase(),
      name: input.name,
      description: input.description ?? null,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') throw new Error('Department code or name already exists')
    throw new Error(error.message)
  }
  return data as Department
}

// ── Update department ─────────────────────────────────────────────────

export const updateDepartment = async (
  id: string,
  input: UpdateDepartmentInput
): Promise<Department> => {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.department_code) updates.department_code = input.department_code.toUpperCase()
  if (input.name) updates.name = input.name
  if (input.description !== undefined) updates.description = input.description

  const { data, error } = await supabaseAdmin
    .from('departments')
    .update(updates)
    .eq('department_id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') throw new Error('Department code or name already exists')
    throw new Error(error.message)
  }
  if (!data) throw new Error('Department not found')
  return data as Department
}

// ── Delete department ─────────────────────────────────────────────────

export const deleteDepartment = async (id: string): Promise<void> => {
  const { error } = await supabaseAdmin
    .from('departments')
    .delete()
    .eq('department_id', id)

  if (error) throw new Error(error.message)
}
