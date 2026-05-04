import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Mail,
  Globe,
  BookOpen,
  HelpCircle,
  Users,
  MessageSquare,
  Lightbulb,
  Target,
  StickyNote,
  Heart,
} from 'lucide-react';
import { useStudentProfileById } from '@/hooks/queries';
import { useTranslation } from 'react-i18next';
import {
  displayPreferredLanguage,
  displayLearningMethod,
  displayHelpPreference,
  displayTeacherPreference,
  displayMentorTone,
  displaySoloVsGroup,
  displayMotivationFactor,
} from '@/lib/studentPreferenceLabels';

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

export interface StudentProfilePanelProps {
  studentId: string | null;
  studentName?: string;
  /** When false, skips profile query (e.g. tab not visible). */
  queryEnabled?: boolean;
}

/**
 * Teacher-facing student onboarding/preferences body (shared by modal and tabbed dialogs).
 */
export function StudentProfilePanel({ studentId, studentName, queryEnabled = true }: StudentProfilePanelProps) {
  const { t } = useTranslation();
  const { data: profile, isLoading } = useStudentProfileById(queryEnabled ? studentId : null);

  const displayName = profile?.full_name || studentName || t('common.student', 'Student');
  const languageBadge = displayPreferredLanguage(t, profile?.preferred_language);
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-3 pt-2 pb-4 border-b border-border">
        <Avatar className="h-20 w-20 border-2 border-border shadow-md">
          {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={displayName} />}
          <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">{initials}</AvatarFallback>
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
        {languageBadge && (
          <Badge variant="secondary" className="text-xs">
            {languageBadge}
          </Badge>
        )}
      </div>

      <div className="space-y-0">
        <ProfileRow
          icon={<Target className="h-4 w-4" />}
          label={t('studentProfile.learningGoal')}
          value={profile?.learning_goal}
        />
        <ProfileRow
          icon={<Globe className="h-4 w-4" />}
          label={t('studentProfile.preferredLanguage')}
          value={displayPreferredLanguage(t, profile?.preferred_language) ?? undefined}
        />
        <ProfileRow
          icon={<BookOpen className="h-4 w-4" />}
          label={t('studentProfile.learningMethods')}
          value={displayLearningMethod(t, profile?.learning_methods) ?? undefined}
        />
        <ProfileRow
          icon={<HelpCircle className="h-4 w-4" />}
          label={t('studentProfile.helpPreferences')}
          value={displayHelpPreference(t, profile?.help_preferences) ?? undefined}
        />
        <ProfileRow
          icon={<MessageSquare className="h-4 w-4" />}
          label={t('studentProfile.teacherPreferences')}
          value={displayTeacherPreference(t, profile?.teacher_preferences) ?? undefined}
        />
        <ProfileRow
          icon={<Lightbulb className="h-4 w-4" />}
          label={t('studentProfile.mentorToneSection')}
          value={displayMentorTone(t, profile?.mentor_tone_ref) ?? undefined}
        />
        <ProfileRow
          icon={<Users className="h-4 w-4" />}
          label={t('studentProfile.soloVsGroup')}
          value={displaySoloVsGroup(t, profile?.solo_vs_group) ?? undefined}
        />
        <ProfileRow
          icon={<Heart className="h-4 w-4" />}
          label={t('studentProfile.motivationFactors')}
          value={displayMotivationFactor(t, profile?.motivation_factors) ?? undefined}
        />
        <ProfileRow
          icon={<StickyNote className="h-4 w-4" />}
          label={t('studentProfile.specialNeeds')}
          value={profile?.special_needs}
        />
        <ProfileRow
          icon={<StickyNote className="h-4 w-4" />}
          label={t('studentProfile.additionalNotes')}
          value={profile?.additional_notes}
        />
      </div>

      {!profile && (
        <p className="text-sm text-muted-foreground text-center py-4">{t('studentProfile.noData')}</p>
      )}
    </div>
  );
}
