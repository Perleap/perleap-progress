import { BarChart3, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { Classroom } from '@/types/models';

interface LearningOutcomesChallengesCardProps {
  classroom: Classroom;
  isRTL: boolean;
  t: (key: string) => string;
}

export function LearningOutcomesChallengesCard({
  classroom,
  isRTL,
  t,
}: LearningOutcomesChallengesCardProps) {
  if (!classroom.learning_outcomes?.length && !classroom.key_challenges?.length) return null;

  return (
    <Card
      className="w-full rounded-xl border-none shadow-sm bg-card ring-1 ring-border"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <CardContent className="p-6 grid md:grid-cols-2 gap-8">
        {classroom.learning_outcomes && classroom.learning_outcomes.length > 0 && (
          <div>
            <h3
              className={`flex items-center gap-2 font-bold text-lg mb-4 text-foreground ${isRTL ? 'text-right' : 'text-left'}`}
            >
              <span className="p-1.5 bg-muted/50 rounded-lg text-muted-foreground">
                <BarChart3 className="h-4 w-4" />
              </span>
              {t('classroomDetail.overview.learningOutcomes')}
            </h3>
            <ul className="space-y-3">
              {classroom.learning_outcomes.map((outcome, index) => (
                <li
                  key={index}
                  className={`flex items-start gap-3 text-foreground/80 bg-muted/30 p-3 rounded-xl ${isRTL ? 'text-right' : 'text-left'}`}
                >
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted/50 text-muted-foreground flex items-center justify-center text-xs font-bold mt-0.5">
                    {index + 1}
                  </span>
                  <span className="text-sm leading-relaxed">{outcome}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {classroom.key_challenges && classroom.key_challenges.length > 0 && (
          <div>
            <h3
              className={`flex items-center gap-2 font-bold text-lg mb-4 text-foreground ${isRTL ? 'text-right' : 'text-left'}`}
            >
              <span className="p-1.5 bg-muted/50 rounded-lg text-muted-foreground">
                <Users className="h-4 w-4" />
              </span>
              {t('classroomDetail.overview.keyChallenges')}
            </h3>
            <ul className="space-y-3">
              {classroom.key_challenges.map((challenge, index) => (
                <li
                  key={index}
                  className={`flex items-start gap-3 text-foreground/80 bg-muted/30 p-3 rounded-xl ${isRTL ? 'text-right' : 'text-left'}`}
                >
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted/50 text-muted-foreground flex items-center justify-center text-xs font-bold mt-0.5">
                    !
                  </span>
                  <span className="text-sm leading-relaxed">{challenge}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
