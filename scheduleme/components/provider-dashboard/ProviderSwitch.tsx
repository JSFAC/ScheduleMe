type ProviderSwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  dm?: boolean;
  size?: 'sm' | 'md';
};

export default function ProviderSwitch({
  checked,
  onChange,
  disabled = false,
  dm = false,
  size = 'md',
}: ProviderSwitchProps) {
  const shellSize = size === 'sm' ? 'h-6 w-11' : 'h-7 w-12';
  const knobSize = size === 'sm' ? 'h-4 w-4 top-1' : 'h-5 w-5 top-1';
  const knobLeft = size === 'sm' ? (checked ? '26px' : '4px') : (checked ? '27px' : '4px');

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative shrink-0 rounded-full transition-all ${shellSize} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      style={{
        background: checked ? '#007e6d' : (dm ? '#2f3136' : '#d1d5db'),
        boxShadow: checked
          ? '0 0 0 1px rgba(0,126,109,0.24), 0 8px 18px rgba(0,126,109,0.24)'
          : `inset 0 0 0 1px ${dm ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)'}`,
      }}
    >
      <span
        className={`absolute rounded-full bg-white shadow-sm transition-all ${knobSize}`}
        style={{ left: knobLeft }}
      />
    </button>
  );
}
