import { Target, FileText, X, Upload, Link as LinkIcon, Plus, Eye, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { AssignmentWizardFormData } from '../assignmentWizardTypes';

interface AssignmentSkillsMaterialsStepProps {
  formData: AssignmentWizardFormData;
  onFormChange: (updater: (prev: AssignmentWizardFormData) => AssignmentWizardFormData) => void;
  isRTL: boolean;
  isEditMode: boolean;
  classroomDomains: Array<{ name: string; components: string[] }>;
  classroomMaterials: Array<{ type: 'pdf' | 'link'; url: string; name: string }>;
  selectedDomain: string;
  onSelectedDomainChange: (v: string) => void;
  availableComponents: string[];
  onAvailableComponentsChange: (v: string[]) => void;
  selectedMaterialIds: Set<number>;
  onToggleClassroomMaterial: (index: number) => void;
  linkInput: string;
  onLinkInputChange: (v: string) => void;
  onAddLink: () => void;
  onPdfUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveMaterial: (index: number) => void;
  uploadingMaterial: boolean;
  uploadProgress: number;
}

export function AssignmentSkillsMaterialsStep({
  formData,
  onFormChange,
  isRTL,
  isEditMode,
  classroomDomains,
  classroomMaterials,
  selectedDomain,
  onSelectedDomainChange,
  availableComponents,
  onAvailableComponentsChange,
  selectedMaterialIds,
  onToggleClassroomMaterial,
  linkInput,
  onLinkInputChange,
  onAddLink,
  onPdfUpload,
  onRemoveMaterial,
  uploadingMaterial,
  uploadProgress,
}: AssignmentSkillsMaterialsStepProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-8">
      <div className="space-y-6 p-6 rounded-xl border border-border shadow-sm">
        <div className={`flex items-center gap-2 text-primary mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Target className="h-5 w-5" />
          <h3 className={`font-bold text-heading ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('createAssignment.subjectAreaAndSkills')}
          </h3>
        </div>

        <p className={`text-sm text-subtle mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
          {isEditMode ? t('editAssignment.subjectAreasHelper') : t('createAssignment.subjectAreasHelper')}
        </p>

        <div className="space-y-2">
          <Label
            htmlFor="wiz-hard_skill_domain"
            className={`text-body font-medium block ${isRTL ? 'text-right' : 'text-left'}`}
          >
            {t('createAssignment.subjectAreaLabel')}
          </Label>
          {classroomDomains.length > 0 ? (
            <div className="space-y-2">
              <Select
                value={selectedDomain}
                onValueChange={(value) => {
                  onSelectedDomainChange(value);
                  onFormChange((prev) => ({ ...prev, hard_skill_domain: value }));
                  const domain = classroomDomains.find((d) => d.name === value);
                  if (domain) {
                    onAvailableComponentsChange(domain.components);
                  }
                }}
              >
                <SelectTrigger
                  className={`rounded-xl bg-background h-11 ${isRTL ? 'text-right' : 'text-left'}`}
                  dir={isRTL ? 'rtl' : 'ltr'}
                >
                  <SelectValue>{selectedDomain || t('createAssignment.selectFromDomains')}</SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-xl" dir={isRTL ? 'rtl' : 'ltr'}>
                  {classroomDomains.map((domain, index) => (
                    <SelectItem key={index} value={domain.name} className={isRTL ? 'text-right' : 'text-left'}>
                      {domain.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className={`text-xs text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('createAssignment.orEnterManually')}
              </p>
            </div>
          ) : null}
          <Input
            id="wiz-hard_skill_domain"
            placeholder={t('createAssignment.subjectAreaPlaceholder')}
            value={formData.hard_skill_domain}
            onChange={(e) => {
              onFormChange((prev) => ({ ...prev, hard_skill_domain: e.target.value }));
              onSelectedDomainChange('');
            }}
            className="rounded-xl bg-background h-11"
            dir={isRTL ? 'rtl' : 'ltr'}
            autoDirection
          />
        </div>

        <div className="space-y-3">
          <Label className={`text-body font-medium block ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('createAssignment.skillsToAssess')}
          </Label>

          {selectedDomain && availableComponents.length > 0 && (
            <div className="space-y-2">
              <Select
                onValueChange={(value: string) => {
                  if (!formData.hard_skills.includes(value)) {
                    onFormChange((prev) => ({
                      ...prev,
                      hard_skills: [...prev.hard_skills, value],
                    }));
                  }
                }}
              >
                <SelectTrigger
                  className={`rounded-xl bg-background h-11 ${isRTL ? 'text-right' : 'text-left'}`}
                  dir={isRTL ? 'rtl' : 'ltr'}
                >
                  <SelectValue>{t('createAssignment.selectFromSkills', { domain: selectedDomain })}</SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-xl" dir={isRTL ? 'rtl' : 'ltr'}>
                  {availableComponents.map((component, index) => (
                    <SelectItem key={index} value={component} className={isRTL ? 'text-right' : 'text-left'}>
                      {component}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            {formData.hard_skills.map((skill, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={skill}
                  onChange={(e) => {
                    const newSkills = [...formData.hard_skills];
                    newSkills[index] = e.target.value;
                    onFormChange((prev) => ({ ...prev, hard_skills: newSkills }));
                  }}
                  placeholder={t('createAssignment.skillPlaceholder', { number: index + 1 })}
                  className="flex-1 rounded-lg bg-background/80 h-10"
                  dir={isRTL ? 'rtl' : 'ltr'}
                  autoDirection
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const newSkills = formData.hard_skills.filter((_, i) => i !== index);
                    onFormChange((prev) => ({ ...prev, hard_skills: newSkills }));
                  }}
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-full"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                onFormChange((prev) => ({
                  ...prev,
                  hard_skills: [...prev.hard_skills, ''],
                }))
              }
              className="text-primary hover:bg-primary/5 text-xs font-semibold"
            >
              <Plus className="h-3 w-3 me-1" />
              {t('createAssignment.addSkillManually')}
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-6 rounded-xl border border-border shadow-sm">
        <div className={`flex items-center gap-2 text-primary mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <FileText className="h-5 w-5" />
          <h3 className={`font-bold text-heading ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('createAssignment.assignmentMaterials')}
          </h3>
        </div>

        {classroomMaterials.length > 0 && (
          <div className="space-y-2">
            <Label className={`text-sm font-medium block ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('createAssignment.selectFromClassroomMaterials')}:
            </Label>
            <div
              className={cn(
                'border border-border rounded-xl p-4 max-h-40 overflow-y-auto space-y-2 shadow-inner',
                isEditMode ? 'bg-background' : 'bg-muted/5',
              )}
            >
              {classroomMaterials.map((material, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Checkbox
                    id={`wiz-classroom-material-${index}`}
                    checked={selectedMaterialIds.has(index)}
                    onCheckedChange={() => onToggleClassroomMaterial(index)}
                  />
                  <label
                    htmlFor={`wiz-classroom-material-${index}`}
                    className="flex-1 flex items-center gap-2 text-sm cursor-pointer font-medium"
                  >
                    {material.type === 'pdf' ? (
                      <Upload
                        className={cn('h-3 w-3 flex-shrink-0', isEditMode ? 'text-primary' : 'text-muted-foreground')}
                      />
                    ) : (
                      <LinkIcon
                        className={cn('h-3 w-3 flex-shrink-0', isEditMode ? 'text-primary' : 'text-muted-foreground')}
                      />
                    )}
                    <span className="truncate">{material.name}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <Label className={`text-sm font-medium block ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('createAssignment.uploadPDF')}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="wiz-pdf-upload"
                type="file"
                accept="application/pdf"
                onChange={onPdfUpload}
                disabled={uploadingMaterial}
                className={`h-auto py-2.5 rounded-xl bg-background border-border file:me-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-muted file:text-foreground hover:file:bg-muted/80 ${isRTL ? 'text-right' : 'text-left'}`}
                dir={isRTL ? 'rtl' : 'ltr'}
                autoDirection
              />
              {uploadingMaterial && (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">
                    {uploadProgress > 0 ? `${uploadProgress}%` : ''}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <Label className={`text-sm font-medium block ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('createAssignment.addLink')}
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="https://..."
                value={linkInput}
                onChange={(e) => onLinkInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onAddLink();
                  }
                }}
                className="rounded-xl bg-background"
                dir={isRTL ? 'rtl' : 'ltr'}
                autoDirection
              />
              <Button
                type="button"
                onClick={onAddLink}
                className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {formData.materials.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            {formData.materials.map((material, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 p-3 bg-muted/10 rounded-xl border border-border shadow-sm group ${isRTL ? 'flex-row-reverse' : ''}`}
              >
                <div className="h-8 w-8 rounded-full bg-primary/5 flex items-center justify-center text-primary">
                  {material.type === 'pdf' ? <Upload className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
                </div>
                <span
                  className={`flex-1 text-sm truncate font-bold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}
                  dir={isRTL ? 'rtl' : 'ltr'}
                >
                  {material.name}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => window.open(material.url, '_blank')}
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    title={t('common.view')}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveMaterial(index)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
