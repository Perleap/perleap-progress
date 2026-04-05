import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type CropPreset = 'free' | '16_9' | '4_3' | '1_1';

export interface CropPercent {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const DEFAULT_CROP: CropPercent = { x: 0, y: 0, width: 100, height: 100 };

function clampCrop(c: CropPercent): CropPercent {
  let { x, y, width, height } = c;
  width = Math.max(8, Math.min(100, width));
  height = Math.max(8, Math.min(100, height));
  x = Math.max(0, Math.min(100 - width, x));
  y = Math.max(0, Math.min(100 - height, y));
  return { x, y, width, height };
}

interface CropOverlayProps {
  crop: CropPercent;
  onCropChange: (next: CropPercent) => void;
  preset: CropPreset;
  onPresetChange: (p: CropPreset) => void;
  /** When true, fills parent (use parent as positioned aspect-video wrapper) */
  overlayMode?: boolean;
  showPresetButtons?: boolean;
  className?: string;
}

export function CropOverlay({
  crop,
  onCropChange,
  preset,
  onPresetChange,
  overlayMode,
  showPresetButtons = true,
  className,
}: CropOverlayProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const captureTargetRef = useRef<HTMLElement | null>(null);
  const [dragging, setDragging] = useState<'move' | 'nw' | 'ne' | 'sw' | 'se' | null>(null);
  const startRef = useRef({ clientX: 0, clientY: 0, crop: crop });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging || !containerRef.current) return;
      const el = containerRef.current;
      const rect = el.getBoundingClientRect();
      const dx = ((e.clientX - startRef.current.clientX) / rect.width) * 100;
      const dy = ((e.clientY - startRef.current.clientY) / rect.height) * 100;
      const sc = startRef.current.crop;

      if (dragging === 'move') {
        onCropChange(clampCrop({ ...sc, x: sc.x + dx, y: sc.y + dy }));
        return;
      }

      let next = { ...sc };
      if (dragging === 'nw') {
        next.x = sc.x + dx;
        next.y = sc.y + dy;
        next.width = sc.width - dx;
        next.height = sc.height - dy;
      } else if (dragging === 'ne') {
        next.y = sc.y + dy;
        next.width = sc.width + dx;
        next.height = sc.height - dy;
      } else if (dragging === 'sw') {
        next.x = sc.x + dx;
        next.width = sc.width - dx;
        next.height = sc.height + dy;
      } else if (dragging === 'se') {
        next.width = sc.width + dx;
        next.height = sc.height + dy;
      }

      if (preset !== 'free') {
        const ratio = preset === '16_9' ? 16 / 9 : preset === '4_3' ? 4 / 3 : 1;
        const elW = el.clientWidth;
        const elH = el.clientHeight;
        const wPx = (next.width / 100) * elW;
        const hPx = wPx / ratio;
        next.height = (hPx / elH) * 100;
        next = clampCrop(next);
      } else {
        next = clampCrop(next);
      }
      onCropChange(next);
    };

    const onUp = (ev: PointerEvent) => {
      const cap = captureTargetRef.current;
      if (cap) {
        try {
          if (cap.hasPointerCapture(ev.pointerId)) {
            cap.releasePointerCapture(ev.pointerId);
          }
        } catch {
          /* ignore */
        }
        captureTargetRef.current = null;
      }
      setDragging(null);
    };

    if (dragging) {
      document.addEventListener('pointermove', onMove, { passive: false });
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
    }
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, onCropChange, preset]);

  const startDrag = (kind: 'move' | 'nw' | 'ne' | 'sw' | 'se') => (e: React.PointerEvent) => {
    if (preset !== 'free' && kind !== 'move') return;
    e.preventDefault();
    e.stopPropagation();
    startRef.current = { clientX: e.clientX, clientY: e.clientY, crop };
    const el = e.currentTarget as HTMLElement;
    captureTargetRef.current = el;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* still use document listeners */
    }
    setDragging(kind);
  };

  const applyPreset = (p: CropPreset) => {
    onPresetChange(p);
    if (p === 'free') {
      onCropChange(DEFAULT_CROP);
      return;
    }
    const ratio = p === '16_9' ? 16 / 9 : p === '4_3' ? 4 / 3 : 1;
    let width = 88;
    let height = width / ratio;
    if (height > 88) {
      height = 88;
      width = height * ratio;
    }
    const x = (100 - width) / 2;
    const y = (100 - height) / 2;
    onCropChange(clampCrop({ x, y, width, height }));
  };

  return (
    <div className={cn('space-y-3', className)}>
      {showPresetButtons && (
        <div className="flex flex-wrap gap-1.5">
          {(['free', '16_9', '4_3', '1_1'] as const).map((p) => (
            <Button
              key={p}
              type="button"
              size="sm"
              variant={preset === p ? 'default' : 'outline'}
              onClick={() => applyPreset(p)}
            >
              {t(`assignmentDetail.presentation.editor.cropPresets.${p}`)}
            </Button>
          ))}
        </div>
      )}

      <div
        ref={containerRef}
        className={cn(
          'relative overflow-hidden rounded-md bg-black/50 select-none',
          overlayMode ? 'absolute inset-0 h-full w-full touch-none' : 'aspect-video touch-manipulation',
        )}
      >
        <div className="absolute inset-0 bg-black/30 pointer-events-none z-[1]" />
        <div
          className="absolute border-2 border-primary bg-primary/15 z-[2]"
          style={{
            left: `${crop.x}%`,
            top: `${crop.y}%`,
            width: `${crop.width}%`,
            height: `${crop.height}%`,
            cursor: 'move',
          }}
          onPointerDown={startDrag('move')}
        />
        {preset === 'free' && (
          <>
            {(
              [
                ['nw', crop.x, crop.y],
                ['ne', crop.x + crop.width, crop.y],
                ['sw', crop.x, crop.y + crop.height],
                ['se', crop.x + crop.width, crop.y + crop.height],
              ] as const
            ).map(([key, leftPct, topPct]) => (
              <div
                key={key}
                className="absolute z-[3] h-3 w-3 rounded-full bg-primary border-2 border-background"
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  transform: 'translate(-50%, -50%)',
                  cursor: `${key}-resize`,
                }}
                onPointerDown={startDrag(key)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
