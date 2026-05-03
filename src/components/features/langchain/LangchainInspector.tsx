import { useTranslation } from 'react-i18next';
import type { Node } from '@xyflow/react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  ensureLangchainNodeData,
  isLangchainNodeType,
  type LangchainNodeType,
  type LangchainChainNodeData,
  type LangchainInputNodeData,
  type LangchainLlmNodeData,
  type LangchainMemoryNodeData,
  type LangchainOutputNodeData,
  type LangchainPromptNodeData,
  type MemoryStrategy,
} from './langchainNodeData';

const NODE_I18N_KEY: Record<LangchainNodeType, 'input' | 'output' | 'llm' | 'prompt' | 'chain' | 'memory'> = {
  inputNode: 'input',
  outputNode: 'output',
  llmNode: 'llm',
  promptNode: 'prompt',
  chainNode: 'chain',
  memoryNode: 'memory',
};

function ReadRow({ label, value, isRTL }: { label: string; value: string; isRTL: boolean }) {
  return (
    <div className="space-y-1">
      <p className={cn('text-xs font-medium text-muted-foreground', isRTL && 'text-end')}>{label}</p>
      <p
        className={cn(
          'text-sm whitespace-pre-wrap break-words rounded-md border border-border/60 bg-muted/20 px-3 py-2 min-h-9',
          isRTL && 'text-end'
        )}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {value.trim() ? value : '—'}
      </p>
    </div>
  );
}

export interface LangchainInspectorProps {
  node: Node | null;
  readOnly: boolean;
  isRTL: boolean;
  onPatchData: (nodeId: string, partial: Record<string, unknown>) => void;
  className?: string;
}

export function LangchainInspector({
  node,
  readOnly,
  isRTL,
  onPatchData,
  className,
}: LangchainInspectorProps) {
  const { t } = useTranslation();
  const dir = isRTL ? 'rtl' : 'ltr';

  if (!node || !isLangchainNodeType(node.type)) {
    return (
      <div
        className={cn(
          'flex flex-col border-border bg-card overflow-hidden',
          className
        )}
      >
        <div className="border-b px-3 py-2">
          <h3 className={cn('text-sm font-semibold', isRTL && 'text-end')}>
            {t('assignmentDetail.langchain.inspector.title')}
          </h3>
        </div>
        <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-muted-foreground">
          {t('assignmentDetail.langchain.inspector.selectNode')}
        </div>
      </div>
    );
  }

  const n = ensureLangchainNodeData(node);
  const patch = (partial: Record<string, unknown>) => onPatchData(n.id, partial);

  const title = t('assignmentDetail.langchain.inspector.title');

  return (
    <div className={cn('flex flex-col border-border bg-card overflow-hidden min-h-0', className)}>
      <div className="border-b px-3 py-2 shrink-0">
        <h3 className={cn('text-sm font-semibold', isRTL && 'text-end')} dir={dir}>
          {title}
        </h3>
        <p className={cn('text-xs text-muted-foreground mt-0.5', isRTL && 'text-end')} dir={dir}>
          {t(`assignmentDetail.langchain.nodes.${NODE_I18N_KEY[n.type]}`)}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4 min-h-0" dir={dir}>
        {/* Common: label/title */}
        {readOnly ? (
          <ReadRow
            label={t('assignmentDetail.langchain.inspector.fields.label')}
            value={(n.data as { label?: string }).label ?? ''}
            isRTL={isRTL}
          />
        ) : (
          <div className="space-y-1.5">
            <Label className={cn(isRTL && 'text-end block')}>
              {t('assignmentDetail.langchain.inspector.fields.label')}
            </Label>
            <Input
              dir={dir}
              value={(n.data as { label?: string }).label ?? ''}
              onChange={(e) => patch({ label: e.target.value })}
            />
          </div>
        )}

        {n.type === 'inputNode' && (
          <InputSection
            readOnly={readOnly}
            isRTL={isRTL}
            dir={dir}
            data={n.data as LangchainInputNodeData}
            descriptionLabel={t('assignmentDetail.langchain.inspector.fields.description')}
            onPatch={patch}
          />
        )}

        {n.type === 'outputNode' && (
          <InputSection
            readOnly={readOnly}
            isRTL={isRTL}
            dir={dir}
            data={n.data as LangchainOutputNodeData}
            descriptionLabel={t('assignmentDetail.langchain.inspector.fields.description')}
            onPatch={patch}
          />
        )}

        {n.type === 'llmNode' && (
          <LlmSection readOnly={readOnly} isRTL={isRTL} dir={dir} data={n.data as LangchainLlmNodeData} onPatch={patch} t={t} />
        )}

        {n.type === 'promptNode' && (
          <PromptSection readOnly={readOnly} isRTL={isRTL} dir={dir} data={n.data as LangchainPromptNodeData} onPatch={patch} t={t} />
        )}

        {n.type === 'chainNode' && (
          <ChainSection readOnly={readOnly} isRTL={isRTL} dir={dir} data={n.data as LangchainChainNodeData} onPatch={patch} t={t} />
        )}

        {n.type === 'memoryNode' && (
          <MemorySection readOnly={readOnly} isRTL={isRTL} dir={dir} data={n.data as LangchainMemoryNodeData} onPatch={patch} t={t} />
        )}
      </div>
    </div>
  );
}

function InputSection({
  readOnly,
  isRTL,
  dir,
  data,
  descriptionLabel,
  onPatch,
}: {
  readOnly: boolean;
  isRTL: boolean;
  dir: 'rtl' | 'ltr';
  data: LangchainInputNodeData | LangchainOutputNodeData;
  descriptionLabel: string;
  onPatch: (p: Record<string, unknown>) => void;
}) {
  if (readOnly) {
    return (
      <ReadRow label={descriptionLabel} value={data.description} isRTL={isRTL} />
    );
  }
  return (
    <div className="space-y-1.5">
      <Label className={cn(isRTL && 'text-end block')}>{descriptionLabel}</Label>
      <Textarea dir={dir} value={data.description} onChange={(e) => onPatch({ description: e.target.value })} rows={4} />
    </div>
  );
}

function LlmSection({
  readOnly,
  isRTL,
  dir,
  data,
  onPatch,
  t,
}: {
  readOnly: boolean;
  isRTL: boolean;
  dir: 'rtl' | 'ltr';
  data: LangchainLlmNodeData;
  onPatch: (p: Record<string, unknown>) => void;
  t: (k: string) => string;
}) {
  if (readOnly) {
    return (
      <>
        <ReadRow label={t('assignmentDetail.langchain.inspector.fields.model')} value={data.model} isRTL={isRTL} />
        <ReadRow label={t('assignmentDetail.langchain.inspector.fields.systemOrRole')} value={data.systemOrRoleNote} isRTL={isRTL} />
        <ReadRow label={t('assignmentDetail.langchain.inspector.fields.temperature')} value={data.temperature} isRTL={isRTL} />
      </>
    );
  }
  return (
    <>
      <div className="space-y-1.5">
        <Label className={cn(isRTL && 'text-end block')}>{t('assignmentDetail.langchain.inspector.fields.model')}</Label>
        <Input dir={dir} value={data.model} onChange={(e) => onPatch({ model: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label className={cn(isRTL && 'text-end block')}>{t('assignmentDetail.langchain.inspector.fields.systemOrRole')}</Label>
        <Textarea dir={dir} value={data.systemOrRoleNote} onChange={(e) => onPatch({ systemOrRoleNote: e.target.value })} rows={3} />
      </div>
      <div className="space-y-1.5">
        <Label className={cn(isRTL && 'text-end block')}>{t('assignmentDetail.langchain.inspector.fields.temperature')}</Label>
        <Input
          dir={dir}
          inputMode="decimal"
          placeholder={t('assignmentDetail.langchain.inspector.placeholders.temperature')}
          value={data.temperature}
          onChange={(e) => onPatch({ temperature: e.target.value })}
        />
      </div>
    </>
  );
}

function PromptSection({
  readOnly,
  isRTL,
  dir,
  data,
  onPatch,
  t,
}: {
  readOnly: boolean;
  isRTL: boolean;
  dir: 'rtl' | 'ltr';
  data: LangchainPromptNodeData;
  onPatch: (p: Record<string, unknown>) => void;
  t: (k: string) => string;
}) {
  if (readOnly) {
    return (
      <>
        <ReadRow label={t('assignmentDetail.langchain.inspector.fields.template')} value={data.template} isRTL={isRTL} />
        <ReadRow label={t('assignmentDetail.langchain.inspector.fields.variablesHint')} value={data.variablesHint} isRTL={isRTL} />
      </>
    );
  }
  return (
    <>
      <div className="space-y-1.5">
        <Label className={cn(isRTL && 'text-end block')}>{t('assignmentDetail.langchain.inspector.fields.template')}</Label>
        <Textarea dir={dir} value={data.template} onChange={(e) => onPatch({ template: e.target.value })} rows={6} />
      </div>
      <div className="space-y-1.5">
        <Label className={cn(isRTL && 'text-end block')}>{t('assignmentDetail.langchain.inspector.fields.variablesHint')}</Label>
        <Input dir={dir} value={data.variablesHint} onChange={(e) => onPatch({ variablesHint: e.target.value })} />
      </div>
    </>
  );
}

function ChainSection({
  readOnly,
  isRTL,
  dir,
  data,
  onPatch,
  t,
}: {
  readOnly: boolean;
  isRTL: boolean;
  dir: 'rtl' | 'ltr';
  data: LangchainChainNodeData;
  onPatch: (p: Record<string, unknown>) => void;
  t: (k: string) => string;
}) {
  if (readOnly) {
    return (
      <>
        <ReadRow label={t('assignmentDetail.langchain.inspector.fields.description')} value={data.description} isRTL={isRTL} />
        <ReadRow label={t('assignmentDetail.langchain.inspector.fields.orderingNote')} value={data.orderingNote} isRTL={isRTL} />
      </>
    );
  }
  return (
    <>
      <div className="space-y-1.5">
        <Label className={cn(isRTL && 'text-end block')}>{t('assignmentDetail.langchain.inspector.fields.description')}</Label>
        <Textarea dir={dir} value={data.description} onChange={(e) => onPatch({ description: e.target.value })} rows={4} />
      </div>
      <div className="space-y-1.5">
        <Label className={cn(isRTL && 'text-end block')}>{t('assignmentDetail.langchain.inspector.fields.orderingNote')}</Label>
        <Textarea dir={dir} value={data.orderingNote} onChange={(e) => onPatch({ orderingNote: e.target.value })} rows={3} />
      </div>
    </>
  );
}

const STRATEGY_KEYS: MemoryStrategy[] = ['buffer', 'summary', 'other'];

function MemorySection({
  readOnly,
  isRTL,
  dir,
  data,
  onPatch,
  t,
}: {
  readOnly: boolean;
  isRTL: boolean;
  dir: 'rtl' | 'ltr';
  data: LangchainMemoryNodeData;
  onPatch: (p: Record<string, unknown>) => void;
  t: (k: string) => string;
}) {
  if (readOnly) {
    return (
      <>
        <ReadRow
          label={t('assignmentDetail.langchain.inspector.fields.strategy')}
          value={t(`assignmentDetail.langchain.inspector.strategy.${data.strategy}`)}
          isRTL={isRTL}
        />
        <ReadRow label={t('assignmentDetail.langchain.inspector.fields.description')} value={data.description} isRTL={isRTL} />
      </>
    );
  }
  return (
    <>
      <div className="space-y-1.5">
        <Label className={cn(isRTL && 'text-end block')}>{t('assignmentDetail.langchain.inspector.fields.strategy')}</Label>
        <Select
          value={data.strategy}
          onValueChange={(v) => onPatch({ strategy: v as MemoryStrategy })}
        >
          <SelectTrigger className="w-full" dir={dir}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent dir={dir}>
            {STRATEGY_KEYS.map((key) => (
              <SelectItem key={key} value={key}>
                {t(`assignmentDetail.langchain.inspector.strategy.${key}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className={cn(isRTL && 'text-end block')}>{t('assignmentDetail.langchain.inspector.fields.description')}</Label>
        <Textarea dir={dir} value={data.description} onChange={(e) => onPatch({ description: e.target.value })} rows={4} />
      </div>
    </>
  );
}
