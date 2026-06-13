import { useTranslation } from 'react-i18next';
import type { Node } from '@xyflow/react';
import { PanelRightClose } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
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
  TRIGGER_MODES,
  type LangchainNodeType,
  type LangchainInputNodeData,
  type LangchainLlmNodeData,
  type LangchainOutputNodeData,
  type LangchainTriggerNodeData,
  type LangchainEmailNodeData,
  type TriggerMode,
} from './langchainNodeData';

const NODE_I18N_KEY: Record<LangchainNodeType, 'input' | 'output' | 'llm' | 'trigger' | 'email'> = {
  inputNode: 'input',
  outputNode: 'output',
  llmNode: 'llm',
  triggerNode: 'trigger',
  emailNode: 'email',
};

function InspectorHeader({
  title,
  subtitle,
  isRTL,
  dir,
  onToggleCollapse,
  collapseLabel,
}: {
  title: string;
  subtitle: string | null;
  isRTL: boolean;
  dir: 'rtl' | 'ltr';
  onToggleCollapse?: () => void;
  collapseLabel: string;
}) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-2 border-b px-3 py-2">
      <div className="min-w-0 flex-1">
        <h3 className={cn('text-sm font-semibold', isRTL && 'text-end')} dir={dir}>
          {title}
        </h3>
        {subtitle ? (
          <p className={cn('text-xs text-muted-foreground mt-0.5', isRTL && 'text-end')} dir={dir}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {onToggleCollapse ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="shrink-0 text-muted-foreground hover:text-foreground"
          onClick={onToggleCollapse}
          title={collapseLabel}
          aria-label={collapseLabel}
        >
          <PanelRightClose className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}

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
  onToggleCollapse?: () => void;
  className?: string;
}

export function LangchainInspector({
  node,
  readOnly,
  isRTL,
  onPatchData,
  onToggleCollapse,
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
        <InspectorHeader
          title={t('assignmentDetail.langchain.inspector.title')}
          subtitle={null}
          isRTL={isRTL}
          dir={dir}
          onToggleCollapse={onToggleCollapse}
          collapseLabel={t('assignmentDetail.langchain.actions.collapseInspector')}
        />
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
      <InspectorHeader
        title={title}
        subtitle={t(`assignmentDetail.langchain.nodes.${NODE_I18N_KEY[n.type]}`)}
        isRTL={isRTL}
        dir={dir}
        onToggleCollapse={onToggleCollapse}
        collapseLabel={t('assignmentDetail.langchain.actions.collapseInspector')}
      />

      <div className="flex-1 overflow-y-auto p-3 space-y-4 min-h-0" dir={dir}>
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

        {n.type === 'triggerNode' && (
          <TriggerSection readOnly={readOnly} isRTL={isRTL} dir={dir} data={n.data as LangchainTriggerNodeData} onPatch={patch} t={t} />
        )}

        {n.type === 'emailNode' && (
          <EmailSection readOnly={readOnly} isRTL={isRTL} dir={dir} data={n.data as LangchainEmailNodeData} onPatch={patch} t={t} />
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
      <ReadRow label={t('assignmentDetail.langchain.inspector.fields.systemPrompt')} value={data.systemPrompt} isRTL={isRTL} />
    );
  }
  return (
    <div className="space-y-1.5">
      <Label className={cn(isRTL && 'text-end block')}>{t('assignmentDetail.langchain.inspector.fields.systemPrompt')}</Label>
      <Textarea dir={dir} value={data.systemPrompt} onChange={(e) => onPatch({ systemPrompt: e.target.value })} rows={5} />
    </div>
  );
}

function TriggerSection({
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
  data: LangchainTriggerNodeData;
  onPatch: (p: Record<string, unknown>) => void;
  t: (k: string) => string;
}) {
  if (readOnly) {
    return (
      <ReadRow
        label={t('assignmentDetail.langchain.inspector.fields.triggerMode')}
        value={t(`assignmentDetail.langchain.inspector.triggerMode.${data.mode}`)}
        isRTL={isRTL}
      />
    );
  }
  return (
    <div className="space-y-1.5">
      <Label className={cn(isRTL && 'text-end block')}>{t('assignmentDetail.langchain.inspector.fields.triggerMode')}</Label>
      <Select
        value={data.mode}
        onValueChange={(v) => onPatch({ mode: v as TriggerMode })}
      >
        <SelectTrigger className="w-full" dir={dir}>
          <SelectValue placeholder={t('assignmentDetail.langchain.inspector.fields.triggerMode')}>
            {(v) => (v ? t(`assignmentDetail.langchain.inspector.triggerMode.${v}`) : null)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent dir={dir}>
          {TRIGGER_MODES.map((key) => (
            <SelectItem key={key} value={key}>
              {t(`assignmentDetail.langchain.inspector.triggerMode.${key}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function EmailSection({
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
  data: LangchainEmailNodeData;
  onPatch: (p: Record<string, unknown>) => void;
  t: (k: string) => string;
}) {
  if (readOnly) {
    return (
      <ReadRow label={t('assignmentDetail.langchain.inspector.fields.sendTo')} value={data.sendTo} isRTL={isRTL} />
    );
  }
  return (
    <div className="space-y-1.5">
      <Label className={cn(isRTL && 'text-end block')}>{t('assignmentDetail.langchain.inspector.fields.sendTo')}</Label>
      <Input dir={dir} value={data.sendTo} onChange={(e) => onPatch({ sendTo: e.target.value })} placeholder={t('assignmentDetail.langchain.inspector.placeholders.sendTo')} />
    </div>
  );
}
