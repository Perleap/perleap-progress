import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface UseAvatarUploadOptions {
  userId: string;
  bucket?: string;
  onSuccess?: (storagePath: string) => void;
}

export const useAvatarUpload = ({
  userId,
  bucket = 'student-avatars',
  onSuccess,
}: UseAvatarUploadOptions) => {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);

  const uploadAvatar = async (file: File): Promise<string | null> => {
    if (!file) return null;

    if (!file.type.startsWith('image/')) {
      toast.error(t('settings.errors.invalidFileType'));
      return null;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('settings.errors.fileTooLarge'));
      return null;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${userId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      toast.success(t('settings.success.photoUploaded'));
      onSuccess?.(filePath);
      return filePath;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error(t('settings.errors.uploadFailed'));
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { uploading, uploadAvatar };
};
