import { Loader2, Upload, X } from 'lucide-react';
import { useRef, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Progress, ProgressValue } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type FileUploadProgressProps = {
  inputId: string;
  setInputRef?: (el: HTMLInputElement | null) => void;
  chooseLabel: string;
  accept?: string;
  disabled?: boolean;
  isRTL?: boolean;
  uploading?: boolean;
  fileName?: string | null;
  progress?: number | null;
  selectedFileName?: string | null;
  uploadingAriaLabel?: string;
  cancelAriaLabel?: string;
  onCancel?: () => void;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
};

export function FileUploadProgress({
  inputId,
  setInputRef,
  chooseLabel,
  accept,
  disabled = false,
  isRTL = false,
  uploading = false,
  fileName,
  progress = null,
  selectedFileName,
  uploadingAriaLabel,
  cancelAriaLabel = 'Cancel upload',
  onCancel,
  onFileChange,
  className,
}: FileUploadProgressProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const clampedProgress =
    progress != null ? Math.min(100, Math.max(0, Math.round(progress))) : 0;

  const assignInputRef = (el: HTMLInputElement | null) => {
    inputRef.current = el;
    setInputRef?.(el);
  };

  const openFilePicker = () => {
    if (!disabled && !uploading) inputRef.current?.click();
  };

  return (
    <div className={cn('space-y-2', className)}>
      <input
        ref={assignInputRef}
        id={inputId}
        type="file"
        accept={accept}
        className="hidden"
        tabIndex={-1}
        disabled={disabled || uploading}
        onChange={onFileChange}
      />

      <div
        className={cn(
          'flex flex-wrap items-center gap-x-3 gap-y-2',
          isRTL && 'flex-row-reverse',
        )}
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploading}
          className="gap-1.5 rounded-full border-border font-semibold shadow-xs hover:bg-muted"
          onClick={openFilePicker}
        >
          <Upload className="size-3.5" aria-hidden />
          {chooseLabel}
        </Button>
        <div
          className={cn(
            'flex min-w-0 max-w-full items-center gap-2 text-sm text-muted-foreground',
            isRTL && 'flex-row-reverse',
          )}
        >
          {uploading && fileName ? (
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div
                className={cn(
                  'flex min-w-0 items-center gap-2',
                  isRTL && 'flex-row-reverse',
                )}
              >
                <span className="min-w-0 truncate" title={fileName}>{fileName}</span>
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                {onCancel ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={onCancel}
                    aria-label={cancelAriaLabel}
                  >
                    <X className="size-3.5" aria-hidden />
                  </Button>
                ) : null}
              </div>
              {progress != null ? (
                <Progress
                  value={clampedProgress}
                  className="w-full max-w-xs flex-col gap-1"
                  trackClassName="h-2 w-full rounded-full bg-muted"
                  indicatorClassName="rounded-full"
                >
                  <ProgressValue className="text-xs tabular-nums" />
                </Progress>
              ) : null}
              {uploadingAriaLabel ? (
                <span className="sr-only">{uploadingAriaLabel}</span>
              ) : null}
            </div>
          ) : selectedFileName ? (
            <span
              className="min-w-0 truncate"
              title={selectedFileName}
            >
              {selectedFileName}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
