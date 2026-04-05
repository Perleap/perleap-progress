import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RefreshCw } from 'lucide-react';

export const NO_AUDIO = '__no_audio__';

export interface DeviceSelection {
  videoDeviceId: string;
  audioDeviceId: string | typeof NO_AUDIO;
}

/** Request transient capture so browsers populate MediaDeviceInfo.label (privacy rule). */
async function primeDeviceLabels(): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    stream.getTracks().forEach((t) => t.stop());
  } catch {
    try {
      const v = await navigator.mediaDevices.getUserMedia({ video: true });
      v.getTracks().forEach((t) => t.stop());
    } catch {
      try {
        const a = await navigator.mediaDevices.getUserMedia({ audio: true });
        a.getTracks().forEach((t) => t.stop());
      } catch {
        /* user may deny; labels can stay empty until permission */
      }
    }
  }
}

interface DeviceSelectorProps {
  value: DeviceSelection;
  onChange: (next: DeviceSelection) => void;
  className?: string;
}

export function DeviceSelector({ value, onChange, className }: DeviceSelectorProps) {
  const { t } = useTranslation();
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);

  const enumerate = useCallback(async () => {
    try {
      await primeDeviceLabels();
      const list = await navigator.mediaDevices.enumerateDevices();
      const vids = list.filter((d) => d.kind === 'videoinput');
      const auds = list.filter((d) => d.kind === 'audioinput');
      setVideoDevices(vids);
      setAudioDevices(auds);
    } catch {
      setVideoDevices([]);
      setAudioDevices([]);
    }
  }, []);

  const initRef = useRef(false);

  useEffect(() => {
    enumerate();
  }, [enumerate]);

  useEffect(() => {
    if (initRef.current || videoDevices.length === 0) return;
    initRef.current = true;
    onChange({
      videoDeviceId: videoDevices[0].deviceId,
      audioDeviceId: audioDevices[0]?.deviceId ?? NO_AUDIO,
    });
  }, [videoDevices, audioDevices, onChange]);

  const labelFor = (d: MediaDeviceInfo, index: number, kind: 'video' | 'audio') => {
    if (d.label?.trim()) return d.label.trim();
    return kind === 'video'
      ? `${t('assignmentDetail.presentation.selectCamera')} ${index + 1}`
      : `${t('assignmentDetail.presentation.selectMicrophone')} ${index + 1}`;
  };

  const videoDisplayLabel = useMemo(() => {
    const d = videoDevices.find((x) => x.deviceId === value.videoDeviceId);
    if (!d) return '';
    return labelFor(d, videoDevices.indexOf(d), 'video');
  }, [videoDevices, value.videoDeviceId, t]);

  const micDisplayLabel = useMemo(() => {
    if (value.audioDeviceId === NO_AUDIO) return t('assignmentDetail.presentation.noAudio');
    const d = audioDevices.find((x) => x.deviceId === value.audioDeviceId);
    if (!d) return '';
    return labelFor(d, audioDevices.indexOf(d), 'audio');
  }, [audioDevices, value.audioDeviceId, t]);

  return (
    <div className={className}>
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
        <div className="space-y-1.5 flex-1 min-w-0 sm:min-w-[200px]">
          <Label className="text-xs">{t('assignmentDetail.presentation.selectCamera')}</Label>
          <Select
            value={value.videoDeviceId || videoDevices[0]?.deviceId || ''}
            onValueChange={(videoDeviceId) => onChange({ ...value, videoDeviceId })}
          >
            <SelectTrigger className="w-full min-w-0 max-w-full">
              <SelectValue
                placeholder={t('assignmentDetail.presentation.selectCamera')}
                className="truncate min-w-0 block text-left"
              >
                {videoDisplayLabel || t('assignmentDetail.presentation.selectCamera')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {videoDevices.map((d, i) => (
                <SelectItem key={d.deviceId} value={d.deviceId}>
                  <span className="truncate block max-w-[min(100vw-4rem,320px)]">{labelFor(d, i, 'video')}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 flex-1 min-w-0 sm:min-w-[200px]">
          <Label className="text-xs">{t('assignmentDetail.presentation.selectMicrophone')}</Label>
          <Select
            value={value.audioDeviceId}
            onValueChange={(audioDeviceId) =>
              onChange({ ...value, audioDeviceId: audioDeviceId as DeviceSelection['audioDeviceId'] })
            }
          >
            <SelectTrigger className="w-full min-w-0 max-w-full">
              <SelectValue
                placeholder={t('assignmentDetail.presentation.selectMicrophone')}
                className="truncate min-w-0 block text-left"
              >
                {micDisplayLabel || t('assignmentDetail.presentation.selectMicrophone')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_AUDIO}>{t('assignmentDetail.presentation.noAudio')}</SelectItem>
              {audioDevices.map((d, i) => (
                <SelectItem key={d.deviceId} value={d.deviceId}>
                  <span className="truncate block max-w-[min(100vw-4rem,320px)]">{labelFor(d, i, 'audio')}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button type="button" variant="outline" size="sm" onClick={enumerate} className="gap-1.5 shrink-0">
          <RefreshCw className="h-3.5 w-3.5" />
          {t('assignmentDetail.presentation.refreshDevices')}
        </Button>
      </div>
    </div>
  );
}
