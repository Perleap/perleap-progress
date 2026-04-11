import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, Trash2, Save, Loader2, Scale, Pencil } from 'lucide-react';
import {
  useCreateGradingCategory,
  useUpdateGradingCategory,
  useDeleteGradingCategory,
} from '@/hooks/queries';
import type { GradingCategory } from '@/types/syllabus';

interface GradingCategoriesManagerProps {
  syllabusId: string;
  classroomId: string;
  categories: GradingCategory[];
  isRTL: boolean;
}

export const GradingCategoriesManager = ({
  syllabusId,
  classroomId,
  categories,
  isRTL,
}: GradingCategoriesManagerProps) => {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editWeight, setEditWeight] = useState(0);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const createMutation = useCreateGradingCategory();
  const updateMutation = useUpdateGradingCategory();
  const deleteMutation = useDeleteGradingCategory();

  const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0);

  const handleAdd = async () => {
    try {
      await createMutation.mutateAsync({
        input: { syllabus_id: syllabusId, name: t('syllabus.newCategory'), weight: 0 },
        classroomId,
      });
    } catch {
      toast.error(t('syllabus.grading.addFailed'));
    }
  };

  const startEdit = (cat: GradingCategory) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditWeight(cat.weight);
  };

  const handleSave = async () => {
    if (!editingId) return;
    try {
      await updateMutation.mutateAsync({
        categoryId: editingId,
        updates: { name: editName, weight: editWeight },
        classroomId,
      });
      setEditingId(null);
      toast.success(t('syllabus.grading.categoryUpdated'));
    } catch {
      toast.error(t('syllabus.grading.updateFailed'));
    }
  };

  const handleDelete = async (categoryId: string) => {
    try {
      await deleteMutation.mutateAsync({ categoryId, classroomId });
      setDeleteConfirmId(null);
      toast.success(t('syllabus.grading.categoryDeleted'));
    } catch {
      toast.error(t('syllabus.grading.deleteFailed'));
    }
  };

  return (
    <div className="space-y-4">
      <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Scale className="h-5 w-5 text-primary" />
          <h3 className="font-bold text-foreground">{t('syllabus.grading.title')}</h3>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleAdd} disabled={createMutation.isPending} className="rounded-full gap-1.5">
          {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          {t('syllabus.grading.addCategory')}
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card className="rounded-xl border-dashed border-2 border-border bg-muted/10">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Scale className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">{t('syllabus.grading.noCategories')}</p>
            <Button variant="ghost" size="sm" onClick={handleAdd} className="mt-3 text-primary">
              <Plus className="h-4 w-4 me-1" /> {t('syllabus.grading.addFirst')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card shadow-sm group">
              {editingId === cat.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 rounded-lg h-9"
                    autoDirection
                  />
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={editWeight || ''}
                      onChange={(e) => setEditWeight(Number(e.target.value) || 0)}
                      className="w-20 rounded-lg h-9 text-center"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  <Button variant="default" size="icon" onClick={handleSave} disabled={updateMutation.isPending} className="h-8 w-8 rounded-full">
                    {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setEditingId(null)} className="h-8 w-8 rounded-full text-muted-foreground">
                    ✕
                  </Button>
                </>
              ) : (
                <>
                  <span className={`flex-1 font-medium text-foreground text-sm ${isRTL ? 'text-right' : 'text-left'}`}>{cat.name}</span>
                  <span className="text-sm font-bold text-primary">{cat.weight}%</span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(cat)} className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground" aria-label="Edit category">
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteConfirmId(cat.id)} disabled={deleteMutation.isPending} className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive" aria-label="Delete category">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}

          <div className={`flex items-center gap-2 px-3 pt-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span className="text-sm font-medium text-muted-foreground">{t('syllabus.grading.total')}:</span>
            <span className={cn('text-sm font-bold', totalWeight === 100 ? 'text-green-600' : totalWeight > 100 ? 'text-destructive' : 'text-foreground')}>
              {totalWeight}%
            </span>
            {totalWeight !== 100 && totalWeight > 0 && (
              <span className="text-xs text-muted-foreground">{t('syllabus.grading.shouldEqual100')}</span>
            )}
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('syllabus.grading.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('syllabus.grading.deleteConfirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('syllabus.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteMutation.isPending ? t('common.loading') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
