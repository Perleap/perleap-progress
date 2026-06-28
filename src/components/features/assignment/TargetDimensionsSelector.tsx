import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from 'react-i18next';

interface TargetDimensionsSelectorProps {
  dimensions: {
    vision: boolean;
    values: boolean;
    thinking: boolean;
    connection: boolean;
    action: boolean;
  };
  onChange: (dimension: string, value: boolean) => void;
}

/**
 * Target dimensions selector component
 * Allows selecting which 5D dimensions to target in an assignment
 */
export const TargetDimensionsSelector = ({
  dimensions,
  onChange,
}: TargetDimensionsSelectorProps) => {
  const { t } = useTranslation();

  const dimensionsList = [
    { key: 'vision', label: t('dimensions.vision.label') },
    { key: 'values', label: t('dimensions.values.label') },
    { key: 'thinking', label: t('dimensions.thinking.label') },
    { key: 'connection', label: t('dimensions.connection.label') },
    { key: 'action', label: t('dimensions.action.label') },
  ];

  return (
    <div className="space-y-2">
      <Label>{t('createAssignment.form.targetDimensions')}</Label>
      <div className="space-y-3 rounded-lg border p-4">
        {dimensionsList.map((dimension) => (
          <div key={dimension.key} className="flex items-center justify-between">
            <Label htmlFor={dimension.key} className="cursor-pointer">
              {dimension.label}
            </Label>
            <Switch
              id={dimension.key}
              checked={dimensions[dimension.key as keyof typeof dimensions]}
              onCheckedChange={(checked) => onChange(dimension.key, checked)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
