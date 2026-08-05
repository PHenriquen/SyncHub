'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { apiJson } from '@/lib/api';

export default function RegisterPage() {
  const [message, setMessage] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(undefined);
    const form = new FormData(event.currentTarget);

    try {
      await apiJson('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          email: form.get('email'),
          password: form.get('password'),
          workspaceName: form.get('workspaceName'),
        }),
      });
      window.location.assign('/');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Registration failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link href="/" className="brand auth-brand"><span className="brand-mark">S</span><span>synchub</span></Link>
        <div><span className="eyebrow">New workspace</span><h1>Start traceable delivery</h1><p>Create an owner account and the first workspace.</p></div>
        <form className="auth-form" onSubmit={submit}>
          <label>Name<input name="name" minLength={2} maxLength={80} required /></label>
          <label>Email<input name="email" type="email" required /></label>
          <label>Workspace name<input name="workspaceName" minLength={2} maxLength={80} required /></label>
          <label>Password<input name="password" type="password" minLength={10} maxLength={72} required /></label>
          <button className="primary-action" disabled={saving} type="submit">{saving ? 'Creating...' : 'Create account'}</button>
        </form>
        {message && <p className="form-message">{message}</p>}
        <p className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></p>
      </section>
    </main>
  );
}
