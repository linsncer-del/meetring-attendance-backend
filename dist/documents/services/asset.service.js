import { supabaseAdmin } from '../../config/supabase.js';
import { randomUUID } from 'node:crypto';
export async function uploadAsset(file, name, assetType, userId) {
    const assetId = randomUUID();
    const filePath = `assets/${assetId}/${file.name}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const { error: uploadError } = await supabaseAdmin.storage
        .from('kmtams-assets')
        .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true
    });
    if (uploadError)
        throw uploadError;
    const { data: publicUrlData } = supabaseAdmin.storage
        .from('kmtams-assets')
        .getPublicUrl(filePath);
    const { data: asset, error: assetError } = await supabaseAdmin
        .from('organization_assets')
        .insert({
        id: assetId,
        name,
        asset_type: assetType,
        file_path: filePath,
        file_url: publicUrlData.publicUrl,
        created_by: userId
    })
        .select('*')
        .single();
    if (assetError)
        throw assetError;
    return asset;
}
export async function listAssets(type) {
    let query = supabaseAdmin
        .from('organization_assets')
        .select('*')
        .order('created_at', { ascending: false });
    if (type) {
        query = query.eq('asset_type', type);
    }
    const { data, error } = await query;
    if (error)
        throw error;
    return data;
}
export async function deleteAsset(id) {
    // Get asset to find its file path
    const { data: asset, error: getError } = await supabaseAdmin
        .from('organization_assets')
        .select('file_path')
        .eq('id', id)
        .single();
    if (getError)
        throw getError;
    if (asset?.file_path) {
        const { error: storageError } = await supabaseAdmin.storage
            .from('kmtams-assets')
            .remove([asset.file_path]);
        // Ignore storage errors if file not found
        if (storageError) {
            console.warn('Failed to delete asset from storage', storageError);
        }
    }
    const { error: deleteError } = await supabaseAdmin
        .from('organization_assets')
        .delete()
        .eq('id', id);
    if (deleteError)
        throw deleteError;
}
export async function getOrganizationProfile() {
    const { data, error } = await supabaseAdmin
        .from('organization_profile')
        .select('*')
        .limit(1)
        .single();
    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        throw error;
    }
    return data || null;
}
export async function updateOrganizationProfile(updates) {
    // Ensure only one row exists or we update the first one
    const { data: existing } = await supabaseAdmin
        .from('organization_profile')
        .select('id')
        .limit(1);
    if (existing && existing.length > 0) {
        const { data, error } = await supabaseAdmin
            .from('organization_profile')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', existing[0].id)
            .select('*')
            .single();
        if (error)
            throw error;
        return data;
    }
    else {
        const { data, error } = await supabaseAdmin
            .from('organization_profile')
            .insert(updates)
            .select('*')
            .single();
        if (error)
            throw error;
        return data;
    }
}
