import type { ReactNode } from 'react';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

interface SectionPageProps {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}

export function SectionPage({
  eyebrow,
  title,
  description,
  action,
  children,
}: SectionPageProps) {
  return (
    <main className="app-shell">
      <Sidebar />
      <section className="workspace">
        <Topbar />
        <div className="page-content">
          <header className="page-heading">
            <div>
              <span className="eyebrow">{eyebrow}</span>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
            {action}
          </header>
          <div className="section-content">{children}</div>
        </div>
      </section>
    </main>
  );
}
