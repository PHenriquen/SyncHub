import { MyWorkView } from '@/components/tasks/my-work-view';
import { SectionPage } from '@/components/layout/section-page';

export default function MyWorkPage() {
  return (
    <SectionPage
      eyebrow="Assigned to you"
      title="My work"
      description="Tasks requiring your implementation, review or decision."
    >
      <MyWorkView />
    </SectionPage>
  );
}
