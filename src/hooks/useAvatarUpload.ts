import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface UseAvatarUploadOptions {
  userId: string;
  bucket?: string;
  onSuccess?: (url: string) => void;
}

/**
 * Custom hook for handling avatar uploads to Supabase Storage
 * Manages upload state, file validation, and error handling
 *
 * @param options - Configuration options for avatar upload
 * @returns Upload state and handler function
 */
export const useAvatarUpload = ({
  userId,
  bucket = 'avatars',
  onSuccess,
}: UseAvatarUploadOptions) => {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);

  const uploadAvatar = async (file: File): Promise<string | null> => {
    if (!file) return null;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(t('settings.errors.invalidFileType'));
      return null;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('settings.errors.fileTooLarge'));
      return null;
    }

    setUploading(true);
    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload file
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(filePath);

      toast.success(t('settings.success.photoUploaded'));

      if (onSuccess) {
        onSuccess(publicUrl);
      }

      return publicUrl;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error(t('settings.errors.uploadFailed'));
      return null;
    } finally {
      setUploading(false);
    }
  };

  return {
    uploading,
    uploadAvatar,
  };
};
