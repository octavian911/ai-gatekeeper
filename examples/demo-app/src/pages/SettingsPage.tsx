import { useSearchParams } from 'react-router-dom';

export function SettingsPage() {
  const [searchParams] = useSearchParams();
  const isRegression = searchParams.get('regression') === 'true';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      <div className="space-y-4">
        <SettingSection
          title="Notifications"
          description="Manage your notification preferences"
          regression={isRegression}
        />
        <SettingSection
          title="Privacy"
          description="Control your privacy settings"
          regression={isRegression}
        />
        <SettingSection
          title="Security"
          description="Manage security options"
          regression={isRegression}
        />
      </div>
    </div>
  );
}

function SettingSection({ title, description, regression }: { title: string; description: string; regression: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="text-xl font-semibold">{regression ? title.toUpperCase() : title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <button className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
        Configure
      </button>
    </div>
  );
}
