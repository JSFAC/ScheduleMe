import ProviderSwitch from './ProviderSwitch';

type SettingsVisibilitySectionProps = {
  dm: boolean;
  publicVisibility: boolean;
  publicShowName: boolean;
  publicShowPhotos: boolean;
  campusShowName: boolean;
  visibilitySaving: boolean;
  persistVisibility: (
    nextVisibility: boolean,
    nextShowName: boolean,
    nextShowPhotos: boolean,
    nextCampusShowName: boolean
  ) => void;
};

function ToggleCard({
  dm,
  title,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  dm: boolean;
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className="flex items-start justify-between gap-4 rounded-2xl border px-4 py-4 text-sm"
      style={{ borderColor: dm ? '#2c2c2e' : '#e5e7eb', background: dm ? '#17181a' : '#fff' }}
    >
      <div style={disabled ? { opacity: 0.6 } : undefined}>
        <p className="font-semibold text-neutral-900">{title}</p>
        <p className="text-xs text-neutral-500">{description}</p>
      </div>
      <ProviderSwitch checked={checked} onChange={onChange} disabled={disabled} dm={dm} />
    </label>
  );
}

export default function SettingsVisibilitySection({
  dm,
  publicVisibility,
  publicShowName,
  publicShowPhotos,
  campusShowName,
  visibilitySaving,
  persistVisibility,
}: SettingsVisibilitySectionProps) {
  return (
    <div className="provider-premium-panel bg-white rounded-[30px] border border-neutral-100 p-6 xl:col-span-2">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-neutral-900">Visibility & Discovery</h2>
          <p className="text-xs mt-1 text-neutral-500">
            Provider cards appear across ScheduleMe by default. Use these controls to fine-tune how much of your identity is shown.
          </p>
        </div>
        <div
          className="text-[11px] font-semibold px-2.5 py-1 rounded-full self-start sm:self-auto max-w-[11rem] text-center sm:text-left"
          style={{
            background: publicVisibility ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.10)',
            color: publicVisibility ? '#059669' : '#b91c1c',
          }}
        >
          {publicVisibility ? 'Visible on ScheduleMe' : 'Hidden from public browse'}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <ToggleCard
          dm={dm}
          title="Show my personal name to students"
          description="Turn this off if you want students to see only your business name."
          checked={campusShowName}
          onChange={(next) => persistVisibility(publicVisibility, publicShowName, publicShowPhotos, next)}
          disabled={visibilitySaving}
        />
        <ToggleCard
          dm={dm}
          title="List my provider card on ScheduleMe"
          description="Controls whether your card appears on home, browse, and search surfaces."
          checked={publicVisibility}
          onChange={(next) => persistVisibility(next, publicShowName, publicShowPhotos, campusShowName)}
          disabled={visibilitySaving}
        />
        <ToggleCard
          dm={dm}
          title="Show my personal name to non-students"
          description="Keep this off if you only want your personal name visible inside campus contexts."
          checked={publicShowName}
          onChange={(next) => persistVisibility(publicVisibility, next, publicShowPhotos, campusShowName)}
          disabled={!publicVisibility || visibilitySaving}
        />
        <ToggleCard
          dm={dm}
          title="Show my photos on public cards"
          description="If this is off, ScheduleMe will use a simpler card presentation instead."
          checked={publicShowPhotos}
          onChange={(next) => persistVisibility(publicVisibility, publicShowName, next, campusShowName)}
          disabled={!publicVisibility || visibilitySaving}
        />
      </div>
    </div>
  );
}
