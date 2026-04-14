import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useLanguage } from '@/contexts/LanguageContext';

function mapDeleteAccountErrorMessage(raw: string, t: TFunction): string {
  const lower = raw.toLowerCase();
  if (!raw.trim()) return t('settings.deleteAccount.errors.deleteFailed');
  if (lower.includes('failed to delete auth user')) {
    return t('settings.deleteAccount.errors.authRecordFailed');
  }
  if (
    lower.includes('failed to delete teacher profile') ||
    lower.includes('failed to delete student profile')
  ) {
    return t('settings.deleteAccount.errors.profileDeleteFailed');
  }
  if (lower.includes('edge function returned') || lower.includes('non-2xx')) {
    return t('settings.deleteAccount.errors.edgeUnreachable');
  }
  return raw;
}

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userRole: 'teacher' | 'student';
}

export const DeleteAccountDialog = ({ open, onOpenChange, userRole }: DeleteAccountDialogProps) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user, signOut } = useAuth();
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (confirmText.toLowerCase() !== 'confirm') {
      toast.error(t('settings.deleteAccount.errors.incorrectConfirmation'));
      return;
    }

    if (!user) {
      toast.error(t('settings.deleteAccount.errors.notAuthenticated'));
      return;
    }

    setIsDeleting(true);
    
    // Set a flag in sessionStorage to prevent premature redirects in settings pages
    sessionStorage.setItem('is_deleting_account', 'true');

    try {
      // Call the edge function to handle complete account deletion
      const { data, error: invokeError } = await supabase.functions.invoke('delete-user-account', {
        body: { userId: user.id, userRole },
      });

      const backendMessage =
        data &&
        typeof data === 'object' &&
        typeof (data as { error?: unknown }).error === 'string'
          ? (data as { error: string }).error
          : '';

      if (invokeError || backendMessage) {
        const raw =
          backendMessage ||
          (invokeError instanceof Error ? invokeError.message : invokeError ? String(invokeError) : '');
        console.error('Delete account invoke error:', invokeError, 'response body:', data);
        throw new Error(raw || t('settings.deleteAccount.errors.deleteFailed'));
      }

      if (!data || (data as { success?: boolean }).success !== true) {
        console.error('Unexpected delete response:', data);
        throw new Error(t('settings.deleteAccount.errors.unexpectedResponse'));
      }

      // Success - sign out and redirect
      toast.success(t('settings.deleteAccount.success'));

      // Close the dialog immediately to provide instant feedback
      onOpenChange(false);

      // Sign out and redirect to home page with a 'deleted' flag
      // The signOut function already handles clearing storage and preserving language preference
      await signOut('/?deleted=true');
    } catch (error: unknown) {
      console.error('Error deleting account:', error);
      const raw = error instanceof Error ? error.message : '';
      const errorMessage = raw
        ? mapDeleteAccountErrorMessage(raw, t)
        : t('settings.deleteAccount.errors.deleteFailed');
      toast.error(errorMessage, {
        duration: 5000, // Show for longer to ensure user sees it
      });
      setIsDeleting(false);
      sessionStorage.removeItem('is_deleting_account');
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className={`flex items-center gap-3 mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className="p-2 rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle className={`text-xl ${isRTL ? 'text-right w-full' : 'text-left'}`}>
              {t('settings.deleteAccount.title')}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="sr-only">
            {t('settings.deleteAccount.warning')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className={`space-y-3 ${isRTL ? 'text-right' : 'text-left'}`}>
          <p className="font-semibold text-foreground text-sm">
            {t('settings.deleteAccount.warning')}
          </p>
          <ul className={`list-disc space-y-1 text-sm text-muted-foreground ${isRTL ? 'list-inside pr-4' : 'list-inside pl-4'}`}>
            <li>{t('settings.deleteAccount.consequences.profile')}</li>
            <li>{t('settings.deleteAccount.consequences.data')}</li>
            {userRole === 'teacher' && (
              <>
                <li>{t('settings.deleteAccount.consequences.classrooms')}</li>
                <li>{t('settings.deleteAccount.consequences.assignments')}</li>
              </>
            )}
            {userRole === 'student' && (
              <>
                <li>{t('settings.deleteAccount.consequences.enrollments')}</li>
                <li>{t('settings.deleteAccount.consequences.submissions')}</li>
              </>
            )}
            <li>{t('settings.deleteAccount.consequences.permanent')}</li>
          </ul>
          <p className="text-sm text-muted-foreground pt-2">
            {t('settings.deleteAccount.confirmPrompt')}
          </p>
        </div>

        <div className="space-y-2 py-4">
          <Label htmlFor="confirm-delete" className={isRTL ? 'text-right block' : 'text-left block'}>
            {t('settings.deleteAccount.typeConfirm')}
          </Label>
          <Input
            id="confirm-delete"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="confirm"
            disabled={isDeleting}
            autoComplete="off"
            className={`font-mono ${isRTL ? 'text-right' : ''}`}
            dir={isRTL ? 'rtl' : 'ltr'}
          />
        </div>

        <AlertDialogFooter className={`gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Button
            variant="outline"
            onClick={() => {
              setConfirmText('');
              onOpenChange(false);
            }}
            disabled={isDeleting}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteAccount}
            disabled={confirmText.toLowerCase() !== 'confirm' || isDeleting}
          >
            {isDeleting && <Loader2 className={isRTL ? 'ml-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4 animate-spin'} />}
            {t('settings.deleteAccount.deleteButton')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

