import { SettingsView } from '@/components/settings/settings-view';
import { SectionPage } from '@/components/layout/section-page';

export default function SettingsPage() {
  return (
    <SectionPage
      eyebrow="Workspace configuration"
      title="Settings"
      description="Current identity and integration readiness."
    >
      <SettingsView />
    </SectionPage>
  );
}
