import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { useLanguage } from '@/contexts/LanguageContext';

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userRole: 'teacher' | 'student';
}

export const DeleteAccountDialog = ({ open, onOpenChange, userRole }: DeleteAccountDialogProps) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
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
    try {
      // Call the edge function to handle complete account deletion
      const { data, error } = await supabase.functions.invoke('delete-user-account', {
        body: { userId: user.id, userRole },
      });

      if (error) {
        console.error('Delete account error:', error);
        throw new Error(error.message || 'Failed to delete account');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Success - sign out and redirect
      toast.success(t('settings.deleteAccount.success'));

      // Preserve language preference before clearing storage
      const languagePreference = localStorage.getItem('language_preference');

      // Clear all local storage and session storage
      localStorage.clear();
      sessionStorage.clear();

      // Restore language preference (user's UI preference should persist)
      if (languagePreference) {
        localStorage.setItem('language_preference', languagePreference);
      }

      // Sign out
      await supabase.auth.signOut();

      // Redirect to home page
      navigate('/', { replace: true });
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast.error(error.message || t('settings.deleteAccount.errors.deleteFailed'));
      setIsDeleting(false);
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

