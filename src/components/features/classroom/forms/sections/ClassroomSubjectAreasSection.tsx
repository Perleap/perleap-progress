import { Plus, Target, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ClassroomFormSectionProps } from '../classroomFormTypes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';

type ClassroomSubjectAreasSectionProps = ClassroomFormSectionProps & {
  helperTextKey?: string;
};

export const ClassroomSubjectAreasSection = ({
  formData,
  onFormChange,
  helperTextKey = 'createClassroom.subjectAreasHelper',
}: ClassroomSubjectAreasSectionProps) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  const addDomain = () => {
    onFormChange({ domains: [...formData.domains, { name: '', components: [''] }] });
  };

  const removeDomain = (index: number) => {
    onFormChange({ domains: formData.domains.filter((_, i) => i !== index) });
  };

  const updateDomainName = (index: number, name: string) => {
    const domains = [...formData.domains];
    domains[index] = { ...domains[index], name };
    onFormChange({ domains });
  };

  const addComponent = (domainIndex: number) => {
    const domains = [...formData.domains];
    domains[domainIndex] = {
      ...domains[domainIndex],
      components: [...domains[domainIndex].components, ''],
    };
    onFormChange({ domains });
  };

  const removeComponent = (domainIndex: number, componentIndex: number) => {
    const domains = [...formData.domains];
    domains[domainIndex] = {
      ...domains[domainIndex],
      components: domains[domainIndex].components.filter((_, i) => i !== componentIndex),
    };
    onFormChange({ domains });
  };

  const updateComponent = (domainIndex: number, componentIndex: number, value: string) => {
    const domains = [...formData.domains];
    domains[domainIndex].components[componentIndex] = value;
    onFormChange({ domains });
  };

  return (
    <div className="space-y-6 p-6 rounded-xl border border-border shadow-sm">
      <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-2 text-primary ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Target className="h-5 w-5" />
          <h3 className={`font-bold text-heading ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('createClassroom.subjectAreas')}
          </h3>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={addDomain}
          className="rounded-full border-border text-foreground hover:bg-muted"
          size="sm"
        >
          <Plus className="h-4 w-4 me-1" />
          {t('createClassroom.addArea')}
        </Button>
      </div>

      <p className={`text-sm text-subtle mt-2 ${isRTL ? 'text-right' : 'text-left'}`}>
        {t(helperTextKey)}
      </p>

      {formData.domains.length === 0 && (
        <div className="p-8 border-2 border-dashed border-border rounded-xl bg-muted/10">
          <p className={`text-subtle text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('createClassroom.addAreaPrompt')}
          </p>
        </div>
      )}

      <div className="grid gap-4">
        {formData.domains.map((domain, domainIndex) => (
          <div
            key={domainIndex}
            className="space-y-4 p-5 border border-border rounded-xl bg-muted/5 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                {domainIndex + 1}
              </div>
              <Input
                placeholder={t('createClassroom.subjectAreaPlaceholder')}
                value={domain.name}
                onChange={(e) => updateDomainName(domainIndex, e.target.value)}
                className="flex-1 rounded-xl h-10"
                autoDirection
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeDomain(domainIndex)}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-full"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="ps-11 space-y-3">
              <Label
                className={`text-xs font-bold text-primary uppercase tracking-wider block ${isRTL ? 'text-right' : 'text-left'}`}
              >
                {t('createClassroom.skills')}
              </Label>
              <div className="grid gap-2">
                {domain.components.map((component, componentIndex) => (
                  <div key={componentIndex} className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary/30" />
                    <Input
                      placeholder={t('createClassroom.skillPlaceholder', {
                        number: componentIndex + 1,
                      })}
                      value={component}
                      onChange={(e) => updateComponent(domainIndex, componentIndex, e.target.value)}
                      className="flex-1 rounded-lg h-9 text-sm"
                      autoDirection
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeComponent(domainIndex, componentIndex)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => addComponent(domainIndex)}
                className="text-primary hover:text-primary/80 hover:bg-primary/5 text-xs font-semibold"
              >
                <Plus className="h-3 w-3 me-1" />
                {t('createClassroom.addSkill')}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
