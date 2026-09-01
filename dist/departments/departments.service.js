import { supabaseAdmin } from '../config/supabase.js';
// ── List all departments ──────────────────────────────────────────────
export const listDepartments = async () => {
    const { data, error } = await supabaseAdmin
        .from('departments')
        .select('*')
        .order('name', { ascending: true });
    if (error)
        throw new Error(error.message);
    return data;
};
// ── Get single department ─────────────────────────────────────────────
export const getDepartmentById = async (id) => {
    const { data, error } = await supabaseAdmin
        .from('departments')
        .select('*')
        .eq('department_id', id)
        .single();
    if (error || !data)
        throw new Error('Department not found');
    return data;
};
// ── Create department ─────────────────────────────────────────────────
export const createDepartment = async (input) => {
    const { data, error } = await supabaseAdmin
        .from('departments')
        .insert({
        department_code: input.department_code.toUpperCase(),
        name: input.name,
        description: input.description ?? null,
    })
        .select()
        .single();
    if (error) {
        if (error.code === '23505')
            throw new Error('Department code or name already exists');
        throw new Error(error.message);
    }
    return data;
};
// ── Create multiple departments (batch) ───────────────────────────────
export const createMultipleDepartments = async (inputs) => {
    const payload = inputs.map(i => ({
        department_code: i.department_code.toUpperCase(),
        name: i.name.trim(),
        description: i.description ?? `Department of ${i.name.trim()}`,
    }));
    const { data, error } = await supabaseAdmin
        .from('departments')
        .insert(payload)
        .select();
    if (error) {
        if (error.code === '23505')
            throw new Error('One or more department codes or names already exist');
        throw new Error(error.message);
    }
    return (data || []);
};
// ── Update department ─────────────────────────────────────────────────
export const updateDepartment = async (id, input) => {
    const updates = { updated_at: new Date().toISOString() };
    if (input.department_code)
        updates.department_code = input.department_code.toUpperCase();
    if (input.name)
        updates.name = input.name;
    if (input.description !== undefined)
        updates.description = input.description;
    const { data, error } = await supabaseAdmin
        .from('departments')
        .update(updates)
        .eq('department_id', id)
        .select()
        .single();
    if (error) {
        if (error.code === '23505')
            throw new Error('Department code or name already exists');
        throw new Error(error.message);
    }
    if (!data)
        throw new Error('Department not found');
    return data;
};
// ── Delete department ─────────────────────────────────────────────────
export const deleteDepartment = async (id) => {
    const { error } = await supabaseAdmin
        .from('departments')
        .delete()
        .eq('department_id', id);
    if (error)
        throw new Error(error.message);
};
