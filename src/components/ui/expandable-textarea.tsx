import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Loader2, Sparkles, Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function ExpandableTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  className,
  autoDirection,
  onRewrite,
  isRewriting,
  disabled,
  id,
  required,
  dir,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  autoDirection?: boolean;
  onRewrite?: () => void;
  isRewriting?: boolean;
  disabled?: boolean;
  id?: string;
  required?: boolean;
  dir?: 'ltr' | 'rtl' | 'auto';
}) {
  const { t } = useTranslation();
  const [originalValue, setOriginalValue] = useState<string | null>(null);

  const handleRewriteClick = () => {
    if (disabled || !onRewrite) return;
    setOriginalValue(value);
    onRewrite();
  };

  const handleUndo = () => {
    if (disabled || originalValue === null) return;
    onChange(originalValue);
    setOriginalValue(null);
  };

  const overlayDisabled = !!disabled;

  return (
    <div className="relative group/textarea">
      <Textarea
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          if (originalValue !== null && e.target.value === originalValue) {
            setOriginalValue(null);
          }
        }}
        placeholder={placeholder}
        rows={rows}
        className={cn(
          'rounded-xl text-sm transition-all pe-20 resize-y',
          className,
        )}
        autoDirection={autoDirection}
        dir={dir}
        disabled={disabled}
        required={required}
        aria-busy={isRewriting}
      />
      <div className="absolute top-1.5 end-1.5 flex items-center gap-0.5 opacity-0 group-hover/textarea:opacity-100 focus-within:opacity-100 transition-opacity">
        {originalValue !== null && originalValue !== value && (
          <button
            type="button"
            onClick={handleUndo}
            disabled={overlayDisabled}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:pointer-events-none disabled:opacity-40"
            title={t('common.undo', 'Undo')}
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
        )}
        {onRewrite && (
          <button
            type="button"
            onClick={handleRewriteClick}
            disabled={overlayDisabled || isRewriting || !value.trim()}
            className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Rewrite with AI"
          >
            {isRewriting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
