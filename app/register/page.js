'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { LEVELS, colorName } from '../../lib/ladder';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  // New readers start at 1C, first color, no passing sets. A returning reader
  // can record where they actually are.
  const [levelIdx, setLevelIdx] = useState(0);
  const [colorIdx, setColorIdx] = useState(0);
  // Advancement rule: 'sets' = pass N Power Builder sets then a test;
  // 'test' = only a test is needed (no set requirement).
  const [advanceMode, setAdvanceMode] = useState('sets');
  const [setsToPass, setSetsToPass] = useState(6);
  const [pbPassed, setPbPassed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const colors = LEVELS[levelIdx].colors;
  const testOnly = advanceMode === 'test';

  function onLevelChange(nextLevel) {
    setLevelIdx(nextLevel);
    // Keep the color index in range for the newly chosen level.
    if (colorIdx >= LEVELS[nextLevel].colors.length) setColorIdx(0);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    const safeColorIdx = Math.min(colorIdx, colors.length - 1);
    // Test-only means no sets are required (or already cleared).
    const effectiveSets = testOnly ? 0 : setsToPass;
    const effectivePbPassed = testOnly ? 0 : Math.min(pbPassed, effectiveSets);
    const r = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        name: name || undefined,
        levelIdx: Number(levelIdx),
        colorIdx: Number(safeColorIdx),
        setsToPass: Number(effectiveSets),
        pbPassed: Number(effectivePbPassed),
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

        <label style={S.label}>Current SRA level
          <select
            value={levelIdx}
            onChange={e => onLevelChange(parseInt(e.target.value, 10))}
            style={S.input}
            required
          >
            {LEVELS.map((lvl, i) => (
              <option key={lvl.code} value={i}>
                {lvl.code}
              </option>
            ))}
          </select>
        </label>
        <div style={S.hint}>Everyone starts at 1C. Pick a higher level only if you're already past it.</div>

        <label style={S.label}>Current color
          <select
            value={Math.min(colorIdx, colors.length - 1)}
            onChange={e => setColorIdx(parseInt(e.target.value, 10))}
            style={S.input}
            required
          >
            {colors.map((c, i) => (
              <option key={c} value={i}>
                {i + 1}. {colorName(c)}
              </option>
            ))}
          </select>
        </label>
        <div style={S.hint}>The color you're currently working in.</div>

        <label style={S.label}>How do you move up a color or level?
          <select
            value={advanceMode}
            onChange={e => setAdvanceMode(e.target.value)}
            style={S.input}
            required
          >
            <option value="sets">Pass a number of Power Builder sets, then a test</option>
            <option value="test">Only a test is needed</option>
          </select>
        </label>
        <div style={S.hint}>How your SRA program advances you to the next color and level.</div>

        {!testOnly && (
          <>
            <label style={S.label}>Power Builder sets needed to level up
              <input
                type="number"
                min={1}
                max={12}
                step={1}
                value={setsToPass}
                onChange={e => {
                  const n = Math.max(1, Math.min(12, parseInt(e.target.value || '1', 10)));
                  setSetsToPass(n);
                  if (pbPassed > n) setPbPassed(n);
                }}
                style={S.input}
                required
              />
            </label>
            <div style={S.hint}>Passing sets required before a color&apos;s exit test (each color has 12 available).</div>

            <label style={S.label}>Passing sets already done in this color
              <input
                type="number"
                min={0}
                max={setsToPass}
                step={1}
                value={pbPassed}
                onChange={e => setPbPassed(Math.max(0, Math.min(setsToPass, parseInt(e.target.value || '0', 10))))}
                style={S.input}
                required
              />
            </label>
            <div style={S.hint}>Out of the {setsToPass} passing sets needed before this color&apos;s exit test.</div>
          </>
        )}

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
