import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Mail, Globe, BookOpen, HelpCircle, Users, MessageSquare, Lightbulb, Target, StickyNote, Heart } from 'lucide-react';
import { useStudentProfileById } from '@/hooks/queries';
import { useTranslation } from 'react-i18next';

interface StudentProfileModalProps {
  studentId: string | null;
  studentName?: string;
  open: boolean;
  onClose: () => void;
}

interface ProfileRowProps {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
}

function ProfileRow({ icon, label, value }: ProfileRowProps) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div className="mt-0.5 text-muted-foreground shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-medium mb-0.5">{label}</p>
        <p className="text-sm text-foreground">{value}</p>
      </div>
    </div>
  );
}

export function StudentProfileModal({ studentId, studentName, open, onClose }: StudentProfileModalProps) {
  const { t } = useTranslation();
  const { data: profile, isLoading } = useStudentProfileById(open ? studentId : null);

  const displayName = profile?.full_name || studentName || t('common.student', 'Student');
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('studentProfile.title', 'Student Profile')}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col items-center gap-3 pt-2 pb-4 border-b border-border">
              <Avatar className="h-20 w-20 border-2 border-border shadow-md">
                {profile?.avatar_url && (
                  <AvatarImage src={profile.avatar_url} alt={displayName} />
                )}
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <h2 className="text-lg font-bold text-foreground">{displayName}</h2>
                {profile?.email && (
                  <p className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
                    <Mail className="h-3.5 w-3.5" />
                    {profile.email}
                  </p>
                )}
              </div>
              {profile?.preferred_language && (
                <Badge variant="secondary" className="text-xs">
                  {profile.preferred_language}
                </Badge>
              )}
            </div>

            {/* Profile details */}
            <div className="space-y-0">
              <ProfileRow
                icon={<Target className="h-4 w-4" />}
                label={t('studentProfile.learningGoal', 'Learning Goal')}
                value={profile?.learning_goal}
              />
              <ProfileRow
                icon={<Globe className="h-4 w-4" />}
                label={t('studentProfile.preferredLanguage', 'Preferred Language')}
                value={profile?.preferred_language}
              />
              <ProfileRow
                icon={<BookOpen className="h-4 w-4" />}
                label={t('studentProfile.learningMethods', 'Learning Methods')}
                value={profile?.learning_methods}
              />
              <ProfileRow
                icon={<HelpCircle className="h-4 w-4" />}
                label={t('studentProfile.helpPreferences', 'Help Preferences')}
                value={profile?.help_preferences}
              />
              <ProfileRow
                icon={<MessageSquare className="h-4 w-4" />}
                label={t('studentProfile.teacherPreferences', 'Teacher Preferences')}
                value={profile?.teacher_preferences}
              />
              <ProfileRow
                icon={<Lightbulb className="h-4 w-4" />}
                label={t('studentProfile.mentorTone', 'Mentor Tone')}
                value={profile?.mentor_tone_ref}
              />
              <ProfileRow
                icon={<Users className="h-4 w-4" />}
                label={t('studentProfile.soloVsGroup', 'Solo vs Group')}
                value={profile?.solo_vs_group}
              />
              <ProfileRow
                icon={<Heart className="h-4 w-4" />}
                label={t('studentProfile.motivationFactors', 'Motivation Factors')}
                value={profile?.motivation_factors}
              />
              <ProfileRow
                icon={<StickyNote className="h-4 w-4" />}
                label={t('studentProfile.specialNeeds', 'Special Needs')}
                value={profile?.special_needs}
              />
              <ProfileRow
                icon={<StickyNote className="h-4 w-4" />}
                label={t('studentProfile.additionalNotes', 'Additional Notes')}
                value={profile?.additional_notes}
              />
            </div>

            {!isLoading && !profile && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('studentProfile.noData', 'No profile information available yet.')}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
