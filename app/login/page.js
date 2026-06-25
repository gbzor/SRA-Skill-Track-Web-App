'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const next = new URLSearchParams(window.location.search).get('next') || '/';
    const res = await signIn('credentials', { email, password, redirect: false, callbackUrl: next });
    setBusy(false);
    if (!res || res.error) { setErr('Invalid email or password'); return; }
    window.location.href = res.url || next;
  }

  return (
    <div style={S.wrap}>
      <form onSubmit={onSubmit} style={S.card} autoComplete="on">
        <h1 style={S.h1}>Sign in</h1>
        <p style={S.sub}>SRA Tracker</p>
        <label style={S.label}>Email
          <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} style={S.input}/>
        </label>
        <label style={S.label}>Password
          <input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} style={S.input}/>
        </label>
        {err && <div style={S.err}>{err}</div>}
        <button type="submit" disabled={busy} style={S.btn}>{busy ? '…' : 'Sign in'}</button>
        <div style={S.foot}>No account? <Link href="/register" style={S.link}>Create one</Link></div>
      </form>
    </div>
  );
}

const S = {
  wrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ece8e0', padding: 16, fontFamily: 'Inter, system-ui, sans-serif' },
  card: { width: '100%', maxWidth: 380, background: '#faf7f2', borderRadius: 24, padding: 28, border: '1px solid #ece6db', boxShadow: '0 20px 60px rgba(0,0,0,.08)' },
  h1: { fontFamily: "'Instrument Serif', serif", fontSize: 36, margin: 0 },
  sub: { fontSize: 12, color: '#8a8175', letterSpacing: 1, textTransform: 'uppercase', margin: '4px 0 22px' },
  label: { display: 'block', fontSize: 11, fontWeight: 600, color: '#8a8175', textTransform: 'uppercase', letterSpacing: .5, marginTop: 12 },
  input: { display: 'block', width: '100%', marginTop: 6, padding: '12px 14px', borderRadius: 12, border: '1px solid #ece6db', background: '#fff', fontSize: 15, outline: 'none' },
  err: { marginTop: 14, padding: '10px 12px', background: '#fef0ee', border: '1px solid #f3cdc3', borderRadius: 10, color: '#a63b25', fontSize: 13 },
  btn: { marginTop: 18, width: '100%', padding: 14, borderRadius: 14, background: '#1a1a1a', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  foot: { marginTop: 16, fontSize: 13, color: '#8a8175', textAlign: 'center' },
  link: { color: '#1a1a1a', fontWeight: 600 },
};
