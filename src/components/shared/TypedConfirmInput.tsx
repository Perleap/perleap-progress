/* eslint-disable react-refresh/only-export-components -- co-located helpers/variants */
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { matchesTypedConfirm } from '@/lib/typedConfirm';

export type TypedConfirmInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  expectedText: string;
  label: string;
  placeholder: string;
  mismatchMessage: string;
  disabled?: boolean;
  isRTL?: boolean;
};

export const TypedConfirmInput = ({
  id,
  value,
  onChange,
  expectedText,
  label,
  placeholder,
  mismatchMessage,
  disabled,
  isRTL,
}: TypedConfirmInputProps) => {
  const matches = matchesTypedConfirm(value, expectedText);
  const showMismatch = value.trim().length > 0 && !matches;

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className={isRTL ? 'text-right block' : 'text-left block'}>
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
        className={isRTL ? 'text-right' : undefined}
        dir={isRTL ? 'rtl' : 'ltr'}
      />
      {showMismatch && <p className="text-xs text-destructive">{mismatchMessage}</p>}
    </div>
  );
};

export { matchesTypedConfirm };
