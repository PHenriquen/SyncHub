import Link from 'next/link';

export function LoadingPanel({ message = 'Loading workspace data...' }: { message?: string }) {
  return (
    <section className="panel state-panel" aria-live="polite">
      <span className="state-spinner" />
      <strong>{message}</strong>
    </section>
  );
}

export function ErrorPanel({ message }: { message: string }) {
  return (
    <section className="panel state-panel state-error" role="alert">
      <strong>Synchub could not load this section</strong>
      <p>{message}</p>
      <Link className="secondary-action" href="/login">Return to sign in</Link>
    </section>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <section className="panel state-panel">
      <strong>{title}</strong>
      <p>{description}</p>
    </section>
  );
}
