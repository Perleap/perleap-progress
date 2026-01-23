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
  const { user, signOut } = useAuth();
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
    
    // Set a flag in sessionStorage to prevent premature redirects in settings pages
    sessionStorage.setItem('is_deleting_account', 'true');

    try {
      // Call the edge function to handle complete account deletion
      const { data, error: invokeError } = await supabase.functions.invoke('delete-user-account', {
        body: { userId: user.id, userRole },
      });

      if (invokeError) {
        console.error('Delete account invoke error:', invokeError);
        // Try to parse the error message if it's a JSON response
        let errorMessage = 'Failed to delete account';
        try {
          if (invokeError instanceof Error) {
            errorMessage = invokeError.message;
          } else if (typeof invokeError === 'object' && (invokeError as any).message) {
            errorMessage = (invokeError as any).message;
          }
        } catch (e) {
          console.error('Error parsing invoke error:', e);
        }
        throw new Error(errorMessage);
      }

      if (data?.error) {
        console.error('Delete account data error:', data.error);
        throw new Error(data.error);
      }

      // Success - sign out and redirect
      toast.success(t('settings.deleteAccount.success'));

      // Close the dialog immediately to provide instant feedback
      onOpenChange(false);

      // Sign out and redirect to home page with a 'deleted' flag
      // The signOut function already handles clearing storage and preserving language preference
      await signOut('/?deleted=true');
    } catch (error: any) {
      console.error('Error deleting account:', error);
      // Extract a more helpful error message if possible
      const errorMessage = error.message || t('settings.deleteAccount.errors.deleteFailed');
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

