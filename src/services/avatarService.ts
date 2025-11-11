import { supabase } from '@/integrations/supabase/client';

/**
 * Avatar Service
 * Handles avatar uploads and management
 */

export interface UploadAvatarOptions {
  userId: string;
  file: File;
  bucket?: string;
  maxSizeMB?: number;
}

export interface UploadAvatarResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Upload an avatar image to Supabase Storage
 *
 * @param options - Upload configuration
 * @returns Upload result with public URL or error
 */
export const uploadAvatar = async ({
  userId,
  file,
  bucket = 'avatars',
  maxSizeMB = 2,
}: UploadAvatarOptions): Promise<UploadAvatarResult> => {
  try {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      return {
        success: false,
        error: 'File must be an image',
      };
    }

    // Validate file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return {
        success: false,
        error: `File size must be less than ${maxSizeMB}MB`,
      };
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;

    // Upload file
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      return {
        success: false,
        error: uploadError.message,
      };
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(fileName);

    return {
      success: true,
      url: publicUrl,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

/**
 * Delete an avatar from storage
 *
 * @param avatarUrl - Full URL of the avatar to delete
 * @param bucket - Storage bucket name
 * @returns Success status
 */
export const deleteAvatar = async (avatarUrl: string, bucket = 'avatars'): Promise<boolean> => {
  try {
    // Extract filename from URL
    const fileName = avatarUrl.split('/').pop();
    if (!fileName) return false;

    const { error } = await supabase.storage.from(bucket).remove([fileName]);

    return !error;
  } catch (error) {
    console.error('Error deleting avatar:', error);
    return false;
  }
};

/**
 * Update profile avatar URL in database
 *
 * @param userId - User ID
 * @param avatarUrl - New avatar URL
 * @param profileType - Type of profile (teacher or student)
 * @returns Success status
 */
export const updateProfileAvatar = async (
  userId: string,
  avatarUrl: string,
  profileType: 'teacher' | 'student'
): Promise<boolean> => {
  try {
    const tableName = profileType === 'teacher' ? 'teacher_profiles' : 'student_profiles';

    const { error } = await supabase
      .from(tableName)
      .update({ avatar_url: avatarUrl })
      .eq('user_id', userId);

    return !error;
  } catch (error) {
    console.error('Error updating profile avatar:', error);
    return false;
  }
};
