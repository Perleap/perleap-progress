import { supabase } from '@/integrations/supabase/client';
import { extractStorageObjectPath } from '@/utils/storageUrls';

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
  /** Storage object path (stored in profile.avatar_url) */
  url?: string;
  error?: string;
}

/**
 * Upload an avatar image to Supabase Storage
 */
export const uploadAvatar = async ({
  userId,
  file,
  bucket = 'student-avatars',
  maxSizeMB = 2,
}: UploadAvatarOptions): Promise<UploadAvatarResult> => {
  try {
    if (!file.type.startsWith('image/')) {
      return { success: false, error: 'File must be an image' };
    }

    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return { success: false, error: `File size must be less than ${maxSizeMB}MB` };
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    return { success: true, url: fileName };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

export const deleteAvatar = async (
  avatarStored: string,
  bucket = 'student-avatars'
): Promise<boolean> => {
  try {
    const fileName =
      extractStorageObjectPath(bucket, avatarStored) ??
      avatarStored.split('/').pop()?.split('?')[0];
    if (!fileName) return false;

    const { error } = await supabase.storage.from(bucket).remove([fileName]);
    return !error;
  } catch (error) {
    console.error('Error deleting avatar:', error);
    return false;
  }
};

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
