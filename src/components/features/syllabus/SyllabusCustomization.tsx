import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Save, Loader2, Palette, Image as ImageIcon, Type, RotateCcw } from 'lucide-react';
import { useUpdateSyllabus } from '@/hooks/queries';
import type { SyllabusWithSections } from '@/types/syllabus';

interface SyllabusCustomizationProps {
  syllabus: SyllabusWithSections;
  classroomId: string;
  isRTL?: boolean;
}

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#64748b', '#0f172a',
];

export const SyllabusCustomization = ({
  syllabus,
  classroomId,
  isRTL = false,
}: SyllabusCustomizationProps) => {
  const { t } = useTranslation();
  const updateMutation = useUpdateSyllabus();

  const [accentColor, setAccentColor] = useState(syllabus.accent_color || '');
  const [bannerUrl, setBannerUrl] = useState(syllabus.banner_url || '');
  const [sectionLabel, setSectionLabel] = useState(syllabus.section_label_override || '');

  const hasChanges =
    accentColor !== (syllabus.accent_color || '') ||
    bannerUrl !== (syllabus.banner_url || '') ||
    sectionLabel !== (syllabus.section_label_override || '');

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        syllabusId: syllabus.id,
        updates: {
          accent_color: accentColor || null,
          banner_url: bannerUrl || null,
          section_label_override: sectionLabel || null,
        },
        classroomId,
      });
      toast.success(t('syllabus.customization.saved'));
    } catch {
      toast.error(t('syllabus.customization.saveFailed'));
    }
  };

  const handleReset = () => {
    setAccentColor('');
    setBannerUrl('');
    setSectionLabel('');
  };

  return (
    <div className="space-y-6">
      <div className={cn('flex items-center justify-between', isRTL && 'flex-row-reverse')}>
        <h3 className="font-bold text-foreground text-lg">{t('syllabus.customization.title')}</h3>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset} className="rounded-full gap-1.5 text-muted-foreground">
            <RotateCcw className="h-3.5 w-3.5" /> {t('syllabus.customization.reset')}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={updateMutation.isPending || !hasChanges}
            className="rounded-full gap-1.5"
          >
            {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {t('syllabus.customization.save')}
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Accent Color */}
        <Card className="rounded-xl border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className={cn('text-sm flex items-center gap-2', isRTL && 'flex-row-reverse')}>
              <Palette className="h-4 w-4 text-muted-foreground" />
              {t('syllabus.customization.accentColor')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setAccentColor(color)}
                  className={cn(
                    'h-8 w-8 rounded-full border-2 transition-all hover:scale-110',
                    accentColor === color ? 'border-foreground ring-2 ring-primary/30 scale-110' : 'border-transparent'
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={accentColor || '#6366f1'}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-8 w-12 p-0 border-none cursor-pointer rounded-lg"
              />
              <Input
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                placeholder="#6366f1"
                className="rounded-lg h-8 text-xs flex-1 font-mono"
                dir="ltr"
              />
            </div>
            {accentColor && (
              <div className="flex items-center gap-2">
                <div className="h-6 flex-1 rounded-full" style={{ backgroundColor: accentColor }} />
                <span className="text-[10px] text-muted-foreground">{t('syllabus.customization.preview')}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section Label Override */}
        <Card className="rounded-xl border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className={cn('text-sm flex items-center gap-2', isRTL && 'flex-row-reverse')}>
              <Type className="h-4 w-4 text-muted-foreground" />
              {t('syllabus.customization.sectionLabel')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {t('syllabus.customization.sectionLabelDesc')}
            </p>
            <Input
              value={sectionLabel}
              onChange={(e) => setSectionLabel(e.target.value)}
              placeholder={t(`syllabus.${syllabus.structure_type}`)}
              className="rounded-lg h-9"
              autoDirection
            />
            {sectionLabel && (
              <p className="text-xs text-muted-foreground">
                {t('syllabus.customization.sectionLabelPreview')}: <strong>{sectionLabel} 1</strong>, <strong>{sectionLabel} 2</strong>, ...
              </p>
            )}
          </CardContent>
        </Card>

        {/* Banner URL */}
        <Card className="rounded-xl border-border shadow-sm md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className={cn('text-sm flex items-center gap-2', isRTL && 'flex-row-reverse')}>
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              {t('syllabus.customization.bannerImage')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {t('syllabus.customization.bannerDesc')}
            </p>
            <Input
              value={bannerUrl}
              onChange={(e) => setBannerUrl(e.target.value)}
              placeholder="https://..."
              className="rounded-lg h-9 text-sm"
              dir="ltr"
            />
            {bannerUrl && (
              <div className="rounded-xl overflow-hidden border border-border bg-muted/20">
                <img
                  src={bannerUrl}
                  alt="Banner preview"
                  className="w-full h-32 object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
