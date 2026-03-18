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
): Promise<{ success: boolean; data?: UploadResult; error?: string }> {
    await requireAuth();

    try {
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
            return { success: false, error: `Failed to upload file: ${error.message}` };
        }

        // Get public URL
        const { data: urlData } = supabaseAdmin.storage
            .from(bucket)
            .getPublicUrl(data.path);

        return {
            success: true,
            data: {
                url: urlData.publicUrl,
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type,
            },
        };
    } catch (error) {
        console.error("uploadFile error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Upload failed" };
    }
}

/**
 * Upload a file from FormData (for server actions)
 */
export async function uploadFileFromFormData(
    bucket: StorageBucket,
    formData: FormData,
    folder: string
): Promise<{ success: boolean; data?: UploadResult; error?: string }> {
    await requireAuth();

    try {
        const file = formData.get('file') as File;
        if (!file) {
            return { success: false, error: "No file provided" };
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            return { success: false, error: "File size exceeds 10MB limit" };
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
            return { success: false, error: "File type not allowed. Allowed types: PDF, JPEG, PNG, GIF, WebP" };
        }

        const uploadResult = await uploadFile(bucket, file, folder);
        if (!uploadResult.success) return uploadResult;
        return uploadResult;
    } catch (error) {
        console.error("uploadFileFromFormData error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Upload failed" };
    }
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteFile(
    bucket: StorageBucket,
    fileUrl: string
): Promise<{ success: boolean; error?: string }> {
    await requireAuth();

    try {
        // Extract path from URL
        const url = new URL(fileUrl);
        const pathParts = url.pathname.split(`/storage/v1/object/public/${bucket}/`);
        if (pathParts.length < 2) {
            return { success: false, error: "Invalid file URL" };
        }
        const filePath = decodeURIComponent(pathParts[1]);

        const { error } = await supabaseAdmin.storage
            .from(bucket)
            .remove([filePath]);

        if (error) {
            console.error('Delete error:', error);
            return { success: false, error: `Failed to delete file: ${error.message}` };
        }

        return { success: true };
    } catch (error) {
        console.error("deleteFile error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Delete failed" };
    }
}

/**
 * Get a signed URL for private file access (if using private buckets)
 */
export async function getSignedUrl(
    bucket: StorageBucket,
    filePath: string,
    expiresIn: number = 3600 // 1 hour default
): Promise<{ success: boolean; data?: string; error?: string }> {
    await requireAuth();

    try {
        const { data, error } = await supabaseAdmin.storage
            .from(bucket)
            .createSignedUrl(filePath, expiresIn);

        if (error) {
            return { success: false, error: `Failed to create signed URL: ${error.message}` };
        }

        return { success: true, data: data.signedUrl };
    } catch (error) {
        console.error("getSignedUrl error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to create signed URL" };
    }
}
