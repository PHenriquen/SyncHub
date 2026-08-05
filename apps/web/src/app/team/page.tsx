import { TeamView } from '@/components/team/team-view';
import { SectionPage } from '@/components/layout/section-page';

export default function TeamPage() {
  return (
    <SectionPage
      eyebrow="Workspace access"
      title="Team"
      description="Roles and active workspace memberships."
    >
      <TeamView />
    </SectionPage>
  );
}
