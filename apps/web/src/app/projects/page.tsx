import { ProjectsView } from '@/components/projects/projects-view';
import { SectionPage } from '@/components/layout/section-page';

export default function ProjectsPage() {
  return (
    <SectionPage
      eyebrow="Delivery portfolio"
      title="Projects"
      description="Workspaces, repositories and delivery health."
    >
      <ProjectsView />
    </SectionPage>
  );
}
