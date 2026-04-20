import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { BookOpen, GraduationCap, Scale, Layers, Lock, FileText } from 'lucide-react';
import type { WizardData } from '../CreateClassroomWizard';

interface ReviewStepProps {
  data: WizardData;
  isRTL: boolean;
}

export const ReviewStep = ({ data, isRTL }: ReviewStepProps) => {
  const { t } = useTranslation();
  const filteredOutcomes = data.learningOutcomes.filter((o) => o.trim());
  const filteredChallenges = data.keyChallenges.filter((c) => c.trim());
  const filteredDomains = data.domains.filter((d) => d.name.trim());
  const filteredCategories = data.gradingCategories.filter((c) => c.name.trim());

  return (
    <div className="space-y-6">
      <div className={isRTL ? 'text-right' : 'text-left'}>
        <h3 className="text-xl font-bold text-foreground mb-1">{t('syllabus.wizard.reviewTitle')}</h3>
        <p className="text-muted-foreground text-sm">
          {t('syllabus.wizard.reviewDesc')}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Course Summary */}
        <Card className="rounded-xl border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className={`flex items-center gap-2 text-base ${isRTL ? 'flex-row-reverse' : ''}`}>
              <BookOpen className="h-4 w-4 text-primary" />
              {t('syllabus.wizard.courseDetails')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ReviewField label={t('syllabus.title')} value={data.courseTitle} isRTL={isRTL} />
            {data.courseDescription.trim().length > 0 && (
              <ReviewField
                label={t('createClassroom.courseDescription')}
                value={data.courseDescription}
                isRTL={isRTL}
              />
            )}
            {(data.startDate || data.endDate) && (
              <ReviewField
                label={t('common.dates')}
                value={[data.startDate, data.endDate].filter(Boolean).join(' → ')}
                isRTL={isRTL}
              />
            )}
            {filteredDomains.length > 0 && (
              <div>
                <span className={`text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>{t('createClassroom.subjectAreas')}</span>
                <div className="flex flex-wrap gap-1.5">
                  {filteredDomains.map((d, i) => (
                    <Badge key={i} variant="secondary" className="rounded-full text-xs">{d.name}</Badge>
                  ))}
                </div>
              </div>
            )}
            {data.materials.length > 0 && (
              <ReviewField label={t('syllabus.review.materials')} value={t('syllabus.review.filesLinks', { count: data.materials.length })} isRTL={isRTL} />
            )}
            {filteredOutcomes.length > 0 && (
              <ReviewField label={t('syllabus.review.learningOutcomes')} value={t('syllabus.review.defined', { count: filteredOutcomes.length })} isRTL={isRTL} />
            )}
            {filteredChallenges.length > 0 && (
              <ReviewField label={t('syllabus.review.keyChallenges')} value={t('syllabus.review.defined', { count: filteredChallenges.length })} isRTL={isRTL} />
            )}
          </CardContent>
        </Card>

        {/* Syllabus Summary */}
        <Card className="rounded-xl border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className={`flex items-center gap-2 text-base ${isRTL ? 'flex-row-reverse' : ''}`}>
              <GraduationCap className="h-4 w-4 text-primary" />
              {t('syllabus.wizard.syllabusLabel')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ReviewField label={t('syllabus.title')} value={data.syllabusTitle || data.courseTitle || '—'} isRTL={isRTL} />
            <ReviewField
              label={t('syllabus.settings.structure')}
              value={data.structureType.charAt(0).toUpperCase() + data.structureType.slice(1)}
              isRTL={isRTL}
            />
            <ReviewField
              label={t('syllabus.releaseMode.label', 'Release mode')}
              value={t(`syllabus.releaseMode.${data.release_mode}`, data.release_mode)}
              isRTL={isRTL}
            />
          </CardContent>
        </Card>
      </div>

      {data.includeSyllabus && (
        <p className={`text-xs text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('syllabus.wizard.reviewAssignmentHint', 'After the classroom is created, link assignments to sections from Course Outline.')}
        </p>
      )}

      <div className="grid md:grid-cols-2 gap-6">
          {/* Sections Summary */}
          <Card className="rounded-xl border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className={`flex items-center gap-2 text-base ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Layers className="h-4 w-4 text-primary" />
                {t('syllabus.courseOutline')}
                <Badge variant="secondary" className="rounded-full text-xs ms-2">{data.sections.length} {t('syllabus.tabs.sections')}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.sections.length === 0 ? (
                <p className={`text-sm text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('syllabus.wizard.noSectionsAdded')}
                </p>
              ) : (
                <div className="space-y-2">
                  {data.sections.map((section, index) => {
                    return (
                    <div key={section.tempId} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-medium text-foreground block truncate ${isRTL ? 'text-right' : 'text-left'}`}>
                          {section.title || `Section ${index + 1}`}
                        </span>
                        {section.startDate && (
                          <span className={`text-xs text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                            {section.startDate}{section.endDate ? ` → ${section.endDate}` : ''}
                          </span>
                        )}
                        <div className={`flex flex-wrap gap-1 mt-1 ${isRTL ? 'justify-end' : ''}`}>
                          {section.content?.replace(/<[^>]+>/g, '').trim().length ? (
                            <Badge variant="outline" className="rounded-full text-[10px] gap-0.5 h-5 px-1.5">
                              <FileText className="h-2.5 w-2.5" /> {t('syllabus.sections.content', 'Content')}
                            </Badge>
                          ) : null}
                          {section.completion_status !== 'auto' ? (
                            <Badge variant="outline" className="rounded-full text-[10px] h-5 px-1.5">
                              {section.completion_status === 'completed'
                                ? t('syllabus.sections.statusCompleted')
                                : t('syllabus.sections.statusSkipped')}
                            </Badge>
                          ) : null}
                          {data.release_mode === 'manual' && section.is_locked ? (
                            <Badge variant="outline" className="rounded-full text-[10px] gap-0.5 h-5 px-1.5">
                              <Lock className="h-2.5 w-2.5" /> {t('syllabus.sections.locked', 'Locked')}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Grading Summary */}
          <Card className="rounded-xl border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className={`flex items-center gap-2 text-base ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Scale className="h-4 w-4 text-primary" />
                {t('syllabus.tabs.grading')}
                {filteredCategories.length > 0 && (
                  <Badge variant="secondary" className="rounded-full text-xs ms-2">{t('syllabus.review.categories', { count: filteredCategories.length })}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredCategories.length === 0 ? (
                <p className={`text-sm text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('syllabus.wizard.noCategoriesDefined')}
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredCategories.map((cat) => (
                    <div key={cat.tempId} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
                      <span className={`text-sm font-medium text-foreground ${isRTL ? 'text-right' : 'text-left'}`}>{cat.name}</span>
                      <span className="text-sm font-bold text-primary">{cat.weight}%</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Policies summary */}
              {data.policies.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <span className={`text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>{t('syllabus.wizard.policies')}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {data.policies.map((policy) => (
                      <Badge key={policy.id} variant="outline" className="rounded-full text-xs">{policy.label}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
    </div>
  );
};

function ReviewField({ label, value, isRTL, truncate }: { label: string; value: string; isRTL: boolean; truncate?: boolean }) {
  return (
    <div>
      <span className={`text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-0.5 ${isRTL ? 'text-right' : 'text-left'}`}>
        {label}
      </span>
      <p className={cn('text-sm text-foreground', truncate && 'line-clamp-2', isRTL ? 'text-right' : 'text-left')}>
        {value}
      </p>
    </div>
  );
}
