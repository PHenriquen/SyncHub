import { ActivityView } from '@/components/activity/activity-view';
import { SectionPage } from '@/components/layout/section-page';

export default function ActivityPage() {
  return (
    <SectionPage
      eyebrow="Workspace timeline"
      title="Activity"
      description="A traceable record of planning and engineering events."
    >
      <ActivityView />
    </SectionPage>
  );
}
