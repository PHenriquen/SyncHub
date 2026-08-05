import { ProjectView } from '@/components/projects/project-view';
import { SectionPage } from '@/components/layout/section-page';

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <SectionPage
      eyebrow="Project workspace"
      title="Delivery plan"
      description="Tasks and engineering state for this project."
    >
      <ProjectView projectId={projectId} />
    </SectionPage>
  );
}
