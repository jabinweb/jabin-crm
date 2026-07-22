import { PlatformTenancySettings } from '@/components/admin/platform-tenancy-settings';

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Global SaaS configuration. Branding and secrets still live in environment
          variables.
        </p>
      </div>

      <PlatformTenancySettings />
    </div>
  );
}
