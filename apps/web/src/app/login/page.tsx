'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { apiJson } from '@/lib/api';
import { Brand } from '@/components/layout/brand';

export default function LoginPage() {
  const [message, setMessage] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(undefined);
    const form = new FormData(event.currentTarget);

    try {
      await apiJson('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
      });
      window.location.assign('/');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Brand className="auth-brand" />
        <div><span className="eyebrow">Welcome back</span><h1>Continue building</h1><p>Access your projects, reviews and delivery history.</p></div>
        <form className="auth-form" onSubmit={submit}>
          <label>Email<input name="email" type="email" defaultValue="demo@synchub.local" required /></label>
          <label>Password<input name="password" type="password" defaultValue="Synchub123!" required /></label>
          <button className="primary-action" disabled={saving} type="submit">{saving ? 'Signing in...' : 'Sign in'}</button>
        </form>
        {message && <p className="form-message">{message}</p>}
        <p className="auth-switch">Need a workspace? <Link href="/register">Create an account</Link></p>
      </section>
    </main>
  );
}
