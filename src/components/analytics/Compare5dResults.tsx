import { useTranslation } from 'react-i18next';
import { CompareSide5dNarrativeBlock } from '@/components/analytics/Analytics5dNarrativeBlocks';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Compare5dNarrativeContext } from '@/lib/analyticsCompare5d/types';
import type { FiveDDimensionKey, FiveDScores, FiveDQedMeasures } from '@/types/models';

type Lang = 'en' | 'he';

/** Compare table uses 0–100 scale: QED development when present, else legacy 5D × 10. */
function compareTableDisplayValue(
  dimension: FiveDDimensionKey,
  scores: FiveDScores,
  qed?: FiveDQedMeasures | null,
): number | null {
  const dev = qed?.[dimension]?.development;
  if (dev != null) return dev;
  const s = scores[dimension];
  if (typeof s === 'number' && !Number.isNaN(s)) return Math.round(s * 10);
  return null;
}

function formatCompareTableValue(value: number | null): string {
  return value != null ? String(value) : '—';
}

function formatCompareTableDelta(a: number | null, b: number | null): string {
  if (a == null || b == null) return '—';
  const d = b - a;
  return `${d >= 0 ? '+' : ''}${d}`;
}

export function Compare5dResults({
  classroomId,
  labelA,
  labelB,
  scoresA,
  scoresB,
  qedA,
  qedB,
  evidenceA,
  evidenceB,
  narrativeContext,
  filterSummary,
  narrativeIdPrefix,
  language,
  isRTL,
}: {
  classroomId: string;
  labelA: string;
  labelB: string;
  scoresA: FiveDScores;
  scoresB: FiveDScores;
  qedA?: FiveDQedMeasures | null;
  qedB?: FiveDQedMeasures | null;
  evidenceA: { evidenceText: string; sourceCount: number };
  evidenceB: { evidenceText: string; sourceCount: number };
  narrativeContext: Compare5dNarrativeContext;
  filterSummary: string;
  narrativeIdPrefix: string;
  language: Lang;
  isRTL: boolean;
}) {
  const { t } = useTranslation();

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[28%]">{t('analytics.compareDimension')}</TableHead>
              <TableHead className="text-center">{labelA}</TableHead>
              <TableHead className="text-center">{labelB}</TableHead>
              <TableHead className="text-center w-[20%]">{t('analytics.compareDelta')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(['vision', 'values', 'thinking', 'connection', 'action'] as const).map((dim) => {
              const a = compareTableDisplayValue(dim, scoresA, qedA);
              const b = compareTableDisplayValue(dim, scoresB, qedB);
              return (
                <TableRow key={dim}>
                  <TableCell className="font-medium">
                    {t(`dimensions.${dim}.label`)}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {formatCompareTableValue(a)}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {formatCompareTableValue(b)}
                  </TableCell>
                  <TableCell className="text-center tabular-nums text-muted-foreground">
                    {formatCompareTableDelta(a, b)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-border/60 p-2 bg-muted/10">
          <CompareSide5dNarrativeBlock
            classroomId={classroomId}
            sideScores={scoresA}
            sideQedMeasures={qedA}
            filterSummary={filterSummary}
            language={language}
            compareLabelA={labelA}
            compareLabelB={labelB}
            peerScores={scoresB}
            isRTL={isRTL}
            enabled
            context={narrativeContext}
            narrativeId={`${narrativeIdPrefix}-a`}
            evidenceText={evidenceA.evidenceText}
            evidenceSourceCount={evidenceA.sourceCount}
          />
        </div>
        <div className="rounded-2xl border border-border/60 p-2 bg-muted/10">
          <CompareSide5dNarrativeBlock
            classroomId={classroomId}
            sideScores={scoresB}
            sideQedMeasures={qedB}
            filterSummary={filterSummary}
            language={language}
            compareLabelA={labelB}
            compareLabelB={labelA}
            peerScores={scoresA}
            isRTL={isRTL}
            enabled
            context={narrativeContext}
            narrativeId={`${narrativeIdPrefix}-b`}
            evidenceText={evidenceB.evidenceText}
            evidenceSourceCount={evidenceB.sourceCount}
          />
        </div>
      </div>
    </>
  );
}
