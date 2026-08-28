import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, FileText, Link as LinkIcon } from 'lucide-react';
import { filterOutlineMaterialResources } from '@/lib/moduleFlow';
import { clipboardZoneProps } from '@/lib/clipboardSourceResolution';
import { ResourceViewer } from '@/components/features/syllabus/ResourceViewer';
import {
  openOrDownloadMaterial,
  parseCourseMaterials,
  resolveMaterialBucket,
} from '@/services/materialService';
import { ASSIGNMENT_MATERIALS_BUCKET } from '@/utils/storageUrls';
import { cn } from '@/lib/utils';
import type { SectionResource } from '@/types/syllabus';

export type AssignmentDetailMaterialsPanelProps = {
  assignmentMaterialsRaw: unknown;
  syllabusSectionId?: string | null;
  sectionResources?: Record<string, SectionResource[]> | null;
  isRTL: boolean;
};

export function AssignmentDetailMaterialsPanel({
  assignmentMaterialsRaw,
  syllabusSectionId,
  sectionResources,
  isRTL,
}: AssignmentDetailMaterialsPanelProps) {
  const { t } = useTranslation();
  const [referenceMaterialsOpen, setReferenceMaterialsOpen] = useState(false);

  const unitOutlineMaterials = useMemo(() => {
    if (!syllabusSectionId || !sectionResources) return [];
    return filterOutlineMaterialResources(sectionResources[syllabusSectionId], {
      excludeDrafts: true,
    });
  }, [syllabusSectionId, sectionResources]);

  const assignmentMaterials = useMemo(
    () => parseCourseMaterials(assignmentMaterialsRaw),
    [assignmentMaterialsRaw],
  );

  const totalReferenceMaterialsCount = assignmentMaterials.length + unitOutlineMaterials.length;

  if (totalReferenceMaterialsCount === 0) return null;

  return (
    <Collapsible
      open={referenceMaterialsOpen}
      onOpenChange={setReferenceMaterialsOpen}
      className="overflow-hidden rounded-lg border border-border/60 bg-muted/5"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <CollapsibleTrigger
        className={cn(
          'flex w-full items-center justify-between gap-2 px-3 py-2.5 text-start outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring/50',
          isRTL ? 'text-end' : 'text-start',
        )}
      >
        <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
          {t('assignmentDetail.referenceMaterials', { count: totalReferenceMaterialsCount })}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
            referenceMaterialsOpen && 'rotate-180',
          )}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border/50 px-3 pb-3 pt-1 space-y-4">
        {assignmentMaterials.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">
              {t('assignmentDetail.assignmentOnlyMaterials')}
            </p>
            <div className="flex flex-wrap gap-2">
              {assignmentMaterials.map((material, index) => (
                <Button
                  key={`assignment-material-${index}`}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() =>
                    void openOrDownloadMaterial(
                      material,
                      resolveMaterialBucket(material, ASSIGNMENT_MATERIALS_BUCKET),
                    )
                  }
                >
                  {material.type === 'pdf' ? (
                    <FileText className="h-3 w-3" />
                  ) : (
                    <LinkIcon className="h-3 w-3" />
                  )}
                  {material.name}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
        {unitOutlineMaterials.length > 0 ? (
          <div className="space-y-2">
            {assignmentMaterials.length > 0 ? (
              <p className="text-xs font-semibold text-muted-foreground">
                {t('assignmentDetail.moduleSharedResources')}
              </p>
            ) : null}
            <div {...clipboardZoneProps({ sourceKind: 'assignment_instructions' })}>
              <ResourceViewer
                resources={unitOutlineMaterials}
                isRTL={isRTL}
                compact
                compactVariant="list"
                hideListHeader
              />
            </div>
          </div>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}
