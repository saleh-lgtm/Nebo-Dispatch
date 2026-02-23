"use server";

import { supabaseAdmin, StorageBucket } from "./supabase";
import { requireAuth } from "./auth-helpers";

export interface UploadResult {
    url: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
}

/**
 * Upload a file to Supabase Storage
 */
export async function uploadFile(
    bucket: StorageBucket,
    file: File,
    folder: string
): Promise<UploadResult> {
    await requireAuth();

    // Generate unique file path
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${folder}/${timestamp}-${sanitizedName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
        });

    if (error) {
        console.error('Upload error:', error);
        throw new Error(`Failed to upload file: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
        .from(bucket)
        .getPublicUrl(data.path);

    return {
        url: urlData.publicUrl,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
    };
}

/**
 * Upload a file from FormData (for server actions)
 */
export async function uploadFileFromFormData(
    bucket: StorageBucket,
    formData: FormData,
    folder: string
): Promise<UploadResult> {
    await requireAuth();

    const file = formData.get('file') as File;
    if (!file) {
        throw new Error('No file provided');
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        throw new Error('File size exceeds 10MB limit');
    }

    // Validate file type
    const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
    ];
    if (!allowedTypes.includes(file.type)) {
        throw new Error('File type not allowed. Allowed types: PDF, JPEG, PNG, GIF, WebP');
    }

    return uploadFile(bucket, file, folder);
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteFile(
    bucket: StorageBucket,
    fileUrl: string
): Promise<void> {
    await requireAuth();

    // Extract path from URL
    const url = new URL(fileUrl);
    const pathParts = url.pathname.split(`/storage/v1/object/public/${bucket}/`);
    if (pathParts.length < 2) {
        throw new Error('Invalid file URL');
    }
    const filePath = decodeURIComponent(pathParts[1]);

    const { error } = await supabaseAdmin.storage
        .from(bucket)
        .remove([filePath]);

    if (error) {
        console.error('Delete error:', error);
        throw new Error(`Failed to delete file: ${error.message}`);
    }
}

/**
 * Get a signed URL for private file access (if using private buckets)
 */
export async function getSignedUrl(
    bucket: StorageBucket,
    filePath: string,
    expiresIn: number = 3600 // 1 hour default
): Promise<string> {
    await requireAuth();

    const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUrl(filePath, expiresIn);

    if (error) {
        throw new Error(`Failed to create signed URL: ${error.message}`);
    }

    return data.signedUrl;
}
