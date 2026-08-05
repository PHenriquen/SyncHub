import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Synchub — Engineering delivery, connected',
  description: 'Connect tasks, GitHub activity and engineering decisions.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
