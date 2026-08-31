import * as React from 'react';
import type { AssignmentClipboardTrackingCallbacks } from '@/hooks/useAssignmentClipboardTracking';
import type { ClipboardSourceKind } from '@/services/clipboardEventService';
import { Textarea } from '@/components/ui/textarea';
import { clipboardZoneProps } from '@/lib/clipboardSourceResolution';

type TrackedTextareaProps = React.ComponentProps<typeof Textarea> & {
  clipboardTracking?: AssignmentClipboardTrackingCallbacks;
  pasteSourceKind: ClipboardSourceKind;
  pasteContextKey?: string;
  copySourceKind?: ClipboardSourceKind;
};

export const TrackedTextarea = React.forwardRef<HTMLTextAreaElement, TrackedTextareaProps>(
  (
    { clipboardTracking, pasteSourceKind, pasteContextKey, copySourceKind, onPaste, ...props },
    ref
  ) => {
    const zoneKind = copySourceKind ?? pasteSourceKind;

    return (
      <Textarea
        ref={ref}
        {...clipboardZoneProps({
          sourceKind: zoneKind,
          contextKey: pasteContextKey,
        })}
        {...props}
        onPaste={(e) => {
          const text = e.clipboardData.getData('text/plain');
          if (text.trim() && clipboardTracking) {
            clipboardTracking.trackPaste({
              pastedText: text,
              sourceKind: pasteSourceKind,
              contextKey: pasteContextKey,
            });
          }
          onPaste?.(e);
        }}
      />
    );
  }
);
