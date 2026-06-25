'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { LADDER } from '../../lib/ladder';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [currentRung, setCurrentRung] = useState(1);
  const [pbToNext, setPbToNext] = useState(20);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    const r = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        name: name || undefined,
        currentRung: Number(currentRung),
        pbToNext: Number(pbToNext),
      }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(j?.issues ? 'Please check your inputs (password needs 12+ chars, upper, lower, digit).' : (j?.error || 'Could not create account'));
      setBusy(false);
      return;
    }
    const res = await signIn('credentials', { email, password, redirect: false, callbackUrl: '/' });
    setBusy(false);
    if (!res || res.error) { window.location.href = '/login'; return; }
    window.location.href = res.url || '/';
  }

  return (
    <div style={S.wrap}>
      <form onSubmit={onSubmit} style={S.card} autoComplete="on">
        <h1 style={S.h1}>Create account</h1>
        <p style={S.sub}>SRA Tracker</p>

        <label style={S.label}>Name (optional)
          <input type="text" autoComplete="name" value={name} onChange={e => setName(e.target.value)} style={S.input}/>
        </label>

        <label style={S.label}>Email
          <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} style={S.input}/>
        </label>

        <label style={S.label}>Password
          <input type="password" required autoComplete="new-password" minLength={12} value={password} onChange={e => setPassword(e.target.value)} style={S.input}/>
        </label>
        <div style={S.hint}>12+ characters, with an uppercase, lowercase, and a digit.</div>

        <label style={S.label}>Current color level
          <select
            value={currentRung}
            onChange={e => setCurrentRung(parseInt(e.target.value, 10))}
            style={S.input}
            required
          >
            {LADDER.map((lvl, i) => (
              <option key={lvl.code} value={i + 1}>
                {lvl.code} — {lvl.name}
              </option>
            ))}
          </select>
        </label>
        <div style={S.hint}>Pick the color you're currently working in.</div>

        <label style={S.label}>Power Builders left until next color
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={pbToNext}
            onChange={e => setPbToNext(parseInt(e.target.value || '0', 10))}
            style={S.input}
            required
          />
        </label>
        <div style={S.hint}>Roughly how many Power Builders you have left to clear this color.</div>

        {err && <div style={S.err}>{err}</div>}
        <button type="submit" disabled={busy} style={S.btn}>{busy ? '…' : 'Create account'}</button>
        <div style={S.foot}>Already have one? <Link href="/login" style={S.link}>Sign in</Link></div>
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
  input: { display: 'block', width: '100%', marginTop: 6, padding: '12px 14px', borderRadius: 12, border: '1px solid #ece6db', background: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box' },
  hint: { marginTop: 6, fontSize: 11, color: '#8a8175' },
  err: { marginTop: 14, padding: '10px 12px', background: '#fef0ee', border: '1px solid #f3cdc3', borderRadius: 10, color: '#a63b25', fontSize: 13 },
  btn: { marginTop: 18, width: '100%', padding: 14, borderRadius: 14, background: '#1a1a1a', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  foot: { marginTop: 16, fontSize: 13, color: '#8a8175', textAlign: 'center' },
  link: { color: '#1a1a1a', fontWeight: 600 },
};
