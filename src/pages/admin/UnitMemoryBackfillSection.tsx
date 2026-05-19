import { useMutation } from '@tanstack/react-query';
import { ChevronDown, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import type { UnitMemoryBackfillResult } from '@/types/api.types';

const DEFAULT_LIMIT = 50;
const MIN_LIMIT = 1;
const MAX_LIMIT = 200;

function clampLimit(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, Math.floor(value)));
}

function isBackfillResult(data: unknown): data is UnitMemoryBackfillResult {
  if (!data || typeof data !== 'object') return false;
  const o = data as Record<string, unknown>;
  return (
    typeof o.processed === 'number' &&
    typeof o.skipped === 'number' &&
    typeof o.examined === 'number' &&
    Array.isArray(o.errors)
  );
}

export interface UnitMemoryBackfillSectionProps {
  classroomId?: string;
  syllabusSectionId?: string;
  studentId?: string;
}

export function UnitMemoryBackfillSection({
  classroomId,
  syllabusSectionId,
  studentId,
}: UnitMemoryBackfillSectionProps) {
  const { t } = useTranslation();
  const [limitInput, setLimitInput] = useState(String(DEFAULT_LIMIT));
  const [lastResult, setLastResult] = useState<UnitMemoryBackfillResult | null>(null);

  const backfillMutation = useMutation({
    mutationFn: async (): Promise<UnitMemoryBackfillResult> => {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        throw new Error(t('admin.aiPrompts.unitMemoryBackfill.errorUnauthorized'));
      }

      const limit = clampLimit(parseInt(limitInput, 10));
      const body: Record<string, unknown> = { limit };
      if (classroomId) body.classroomId = classroomId;
      if (syllabusSectionId) body.syllabusSectionId = syllabusSectionId;
      if (studentId) body.studentId = studentId;

      const { data, error } = await supabase.functions.invoke<
        UnitMemoryBackfillResult | { error?: string }
      >('backfill-unit-memory', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body,
      });

      if (error) {
        const msg = error.message || '';
        if (/403|forbidden/i.test(msg)) {
          throw new Error(t('admin.aiPrompts.unitMemoryBackfill.errorForbidden'));
        }
        if (/401|unauthorized/i.test(msg)) {
          throw new Error(t('admin.aiPrompts.unitMemoryBackfill.errorUnauthorized'));
        }
        throw new Error(msg || t('common.error'));
      }

      if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
        const errMsg = data.error;
        if (/403|forbidden/i.test(errMsg)) {
          throw new Error(t('admin.aiPrompts.unitMemoryBackfill.errorForbidden'));
        }
        throw new Error(errMsg);
      }

      if (!isBackfillResult(data)) {
        throw new Error(t('common.error'));
      }

      return data;
    },
    onSuccess: (result) => {
      setLastResult(result);
      if (result.processed > 0) {
        toast.success(
          t('admin.aiPrompts.unitMemoryBackfill.successToast', { count: result.processed }),
        );
      } else {
        toast.info(t('admin.aiPrompts.unitMemoryBackfill.emptyBatchToast'));
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || t('common.error'));
    },
  });

  const scopeHint = classroomId
    ? t('admin.aiPrompts.unitMemoryBackfill.scopeHint')
    : t('admin.aiPrompts.unitMemoryBackfill.globalScopeHint');

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle>{t('admin.aiPrompts.unitMemoryBackfill.title')}</CardTitle>
          <CardDescription>{t('admin.aiPrompts.unitMemoryBackfill.description')}</CardDescription>
          <p className="text-xs text-muted-foreground">{scopeHint}</p>
        </div>
        <Button
          type="button"
          className="shrink-0 gap-2"
          disabled={backfillMutation.isPending}
          onClick={() => backfillMutation.mutate()}
        >
          {backfillMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : null}
          {backfillMutation.isPending
            ? t('admin.aiPrompts.unitMemoryBackfill.running')
            : t('admin.aiPrompts.unitMemoryBackfill.runButton')}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-[12rem] space-y-2">
          <Label htmlFor="unit-memory-backfill-limit">
            {t('admin.aiPrompts.unitMemoryBackfill.limitLabel')}
          </Label>
          <Input
            id="unit-memory-backfill-limit"
            type="number"
            min={MIN_LIMIT}
            max={MAX_LIMIT}
            value={limitInput}
            disabled={backfillMutation.isPending}
            onChange={(e) => setLimitInput(e.target.value)}
            onBlur={() => setLimitInput(String(clampLimit(parseInt(limitInput, 10))))}
          />
        </div>

        {backfillMutation.isError ? (
          <Alert variant="destructive">
            <AlertTitle>{t('common.error')}</AlertTitle>
            <AlertDescription>
              {backfillMutation.error instanceof Error
                ? backfillMutation.error.message
                : t('common.error')}
            </AlertDescription>
          </Alert>
        ) : null}

        {lastResult ? (
          <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-4 text-sm">
            <ul className="space-y-1">
              <li>
                {t('admin.aiPrompts.unitMemoryBackfill.resultProcessed', {
                  count: lastResult.processed,
                })}
              </li>
              <li>
                {t('admin.aiPrompts.unitMemoryBackfill.resultSkipped', {
                  count: lastResult.skipped,
                })}
              </li>
              <li>
                {t('admin.aiPrompts.unitMemoryBackfill.resultExamined', {
                  count: lastResult.examined,
                })}
              </li>
            </ul>
            <p className="text-xs text-muted-foreground">
              {t('admin.aiPrompts.unitMemoryBackfill.runAgainHint')}
            </p>
            {lastResult.errors.length > 0 ? (
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-1 text-xs text-destructive hover:underline">
                  <ChevronDown className="size-3" />
                  {t('admin.aiPrompts.unitMemoryBackfill.errorsTitle', {
                    count: lastResult.errors.length,
                  })}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <pre className="mt-2 max-h-40 overflow-auto rounded-md border bg-background p-3 text-[10px] leading-relaxed">
                    {JSON.stringify(lastResult.errors, null, 2)}
                  </pre>
                </CollapsibleContent>
              </Collapsible>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
