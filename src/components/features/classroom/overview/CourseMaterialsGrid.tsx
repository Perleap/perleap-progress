import { FileText, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { openOrDownloadMaterial } from '@/services/materialService';
import type { Classroom } from '@/types/models';
import { COURSE_MATERIALS_BUCKET } from '@/utils/storageUrls';

interface CourseMaterialsGridProps {
  classroom: Classroom;
  isRTL: boolean;
  t: (key: string) => string;
}

export function CourseMaterialsGrid({ classroom, isRTL, t }: CourseMaterialsGridProps) {
  if (!classroom.materials?.length) return null;

  return (
    <Card className="rounded-xl border-none shadow-sm bg-card ring-1 ring-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-2 bg-muted/50 rounded-xl">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
          {t('classroomDetail.courseMaterials')}
        </CardTitle>
        <CardDescription className={isRTL ? 'text-right' : 'text-left'}>
          {t('classroomDetail.courseMaterialsDesc')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {classroom.materials.map((material, index) => (
            <Button
              key={index}
              variant="outline"
              className="justify-start h-auto py-4 px-4 rounded-lg border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
              onClick={() => void openOrDownloadMaterial(material, COURSE_MATERIALS_BUCKET)}
            >
              <div className="p-2 bg-muted rounded-xl me-3 group-hover:bg-card transition-colors">
                {material.type === 'pdf' ? (
                  <FileText className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                ) : (
                  <LinkIcon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                )}
              </div>
              <div className={`flex-1 overflow-hidden ${isRTL ? 'text-right' : 'text-left'}`}>
                <span className="block font-medium text-foreground truncate group-hover:text-primary transition-colors">
                  {material.name}
                </span>
                <span className="text-xs text-muted-foreground capitalize">{material.type}</span>
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
