'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signOut, useSession } from 'next-auth/react';
import IOSDevice from '../IOSDevice';

// Same color ladder as the home screen, so the account page picks up the
// reader's current accent rather than a hard-coded one.
const LADDER_HEX = [
  '#c96d8a', '#c95c5c', '#db8447', '#d9b850', '#6fac6f',
  '#7d8a45', '#4fa8a8', '#5c89c9', '#8c5ca8',
];

const darken = (hex, a = 40) => {
  const n = i => Math.max(0, parseInt(hex.slice(i, i + 2), 16) - a).toString(16).padStart(2, '0');
  return '#' + n(1) + n(3) + n(5);
};
const mix = (hex, t) => {
  const c = i => { const v = parseInt(hex.slice(i, i + 2), 16); return Math.round(v + (255 - v) * t).toString(16).padStart(2, '0'); };
  return '#' + c(1) + c(3) + c(5);
};

const labelStyle = { fontSize: 11, color: '#8a8175', letterSpacing: .5, textTransform: 'uppercase', fontWeight: 600 };
const inputStyle = { display: 'block', width: '100%', marginTop: 8, padding: '12px 14px', borderRadius: 12, border: '1px solid #ece6db', background: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box' };
const cardStyle = { margin: '0 20px 16px', background: '#fff', border: '1px solid #ece6db', borderRadius: 20, padding: 18 };

export default function AccountPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [currentRung, setCurrentRung] = useState(1);

  // Profile (name) form
  const [nameDraft, setNameDraft] = useState('');
  const [nameBusy, setNameBusy] = useState(false);
  const [nameMsg, setNameMsg] = useState(null); // { ok: bool, text }

  // Password form
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);

  // Delete account flow
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [delPw, setDelPw] = useState('');
  const [delBusy, setDelBusy] = useState(false);
  const [delErr, setDelErr] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/me', { credentials: 'same-origin' });
        if (r.status === 401) { await signOut({ callbackUrl: '/login' }); return; }
        if (!r.ok) return;
        const j = await r.json();
        if (!alive || !j.user) return;
        setEmail(j.user.email || '');
        setName(j.user.name || '');
        setNameDraft(j.user.name || '');
        if (typeof j.user.currentRung === 'number') setCurrentRung(j.user.currentRung);
      } catch {}
    })();
    return () => { alive = false; };
  }, []);

  // Fall back to the session values until /api/me resolves.
  const shownEmail = email || session?.user?.email || '';
  const shownName = name || session?.user?.name || '';
  const initial = (shownName || shownEmail || '?').trim().charAt(0).toUpperCase();

  const theme = useMemo(() => {
    const hex = LADDER_HEX[Math.min(Math.max(currentRung - 1, 0), LADDER_HEX.length - 1)];
    return {
      accent: hex,
      accentDark: darken(hex, 42),
      accentTint: mix(hex, 0.86),
      accentBorder: mix(hex, 0.66),
    };
  }, [currentRung]);

  const goHome = () => router.push('/');

  const saveName = async () => {
    const next = nameDraft.trim();
    if (!next) { setNameMsg({ ok: false, text: 'Name cannot be empty.' }); return; }
    if (next === (shownName || '').trim()) { setNameMsg({ ok: false, text: 'That is already your name.' }); return; }
    setNameBusy(true);
    setNameMsg(null);
    try {
      const r = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ name: next }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setNameMsg({ ok: false, text: j?.error || 'Could not save your name.' }); setNameBusy(false); return; }
      setName(j?.user?.name || next);
      setNameMsg({ ok: true, text: 'Name updated.' });
      setNameBusy(false);
    } catch {
      setNameMsg({ ok: false, text: 'Network error. Try again.' });
      setNameBusy(false);
    }
  };

  const savePassword = async () => {
    if (!curPw || !newPw) { setPwMsg({ ok: false, text: 'Fill in both password fields.' }); return; }
    setPwBusy(true);
    setPwMsg(null);
    try {
      const r = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (j?.error === 'current password is incorrect') setPwMsg({ ok: false, text: 'Current password is incorrect.' });
        else if (j?.issues) setPwMsg({ ok: false, text: 'New password needs 12+ chars with upper, lower, and a digit.' });
        else setPwMsg({ ok: false, text: j?.error || 'Could not change password.' });
        setPwBusy(false);
        return;
      }
      // Changing the password revokes every outstanding session token,
      // including this one — re-authenticate with the new password so the
      // user who just changed it isn't immediately logged out by their own action.
      const freshPw = newPw;
      setCurPw('');
      setNewPw('');
      await signIn('credentials', { email: shownEmail, password: freshPw, redirect: false });
      setPwMsg({ ok: true, text: 'Password changed.' });
      setPwBusy(false);
    } catch {
      setPwMsg({ ok: false, text: 'Network error. Try again.' });
      setPwBusy(false);
    }
  };

  const openDelete = () => { setDeleteOpen(true); setDelPw(''); setDelErr(''); };
  const cancelDelete = () => { setDeleteOpen(false); setDelPw(''); setDelErr(''); };

  const confirmDelete = async () => {
    if (!delPw) { setDelErr('Enter your current password to confirm.'); return; }
    setDelBusy(true);
    setDelErr('');
    try {
      const r = await fetch('/api/me', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ currentPassword: delPw }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (j?.error === 'current password is incorrect') setDelErr('Current password is incorrect.');
        else setDelErr(j?.error || 'Could not delete your account.');
        setDelBusy(false);
        return;
      }
      // Account is gone — clear the session and send them to login.
      await signOut({ callbackUrl: '/login' });
    } catch {
      setDelErr('Network error. Try again.');
      setDelBusy(false);
    }
  };

  const themeStyle = {
    position: 'relative', height: '100%', width: '100%', background: '#faf7f2', overflow: 'hidden',
    fontFamily: "'Inter',sans-serif", color: '#1a1a1a',
    '--accent': theme.accent, '--accent-dark': theme.accentDark,
    '--accent-tint': theme.accentTint, '--accent-border': theme.accentBorder,
  };

  return (
    <div className="app-shell">
      <IOSDevice>
        <div style={themeStyle}>
          <div className="scroll-hide" style={{ position: 'absolute', inset: 0, paddingTop: 54, paddingBottom: 40, overflowY: 'auto', animation: 'sra-fadeIn .3s' }}>

            {/* Header with back arrow */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 20px 18px' }}>
              <div onClick={goHome} title="Back to home" style={{ width: 38, height: 38, borderRadius: '50%', background: '#fff', border: '1px solid #ece6db', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
              </div>
              <div>
                <div style={{ fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', color: '#8a8175', fontWeight: 600 }}>Account</div>
                <div style={{ fontFamily: "'Instrument Serif',serif", fontSize: 28, lineHeight: 1.05, letterSpacing: '-.4px' }}>Manage your account</div>
              </div>
            </div>

            {/* Identity card */}
            <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: `linear-gradient(135deg,var(--accent),var(--accent-dark))`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 20, flexShrink: 0 }}>
                {initial}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shownName || 'Reader'}</div>
                <div style={{ fontSize: 12, color: '#8a8175', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shownEmail || '—'}</div>
              </div>
            </div>

            {/* Email (read-only) */}
            <div style={cardStyle}>
              <div style={labelStyle}>Email</div>
              <div style={{ fontSize: 14, color: '#1a1a1a', marginTop: 8, padding: '10px 12px', background: '#f4efe6', borderRadius: 10, border: '1px solid #ece6db', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {shownEmail || '—'}
              </div>
              <div style={{ fontSize: 10, color: '#8a8175', marginTop: 6 }}>Your email cannot be changed.</div>
            </div>

            {/* Name */}
            <div style={cardStyle}>
              <div style={labelStyle}>Name</div>
              <input
                type="text"
                autoComplete="name"
                maxLength={80}
                placeholder="Your name"
                value={nameDraft}
                onChange={e => { setNameDraft(e.target.value); setNameMsg(null); }}
                style={inputStyle}
              />
              {nameMsg && <Message msg={nameMsg} />}
              <button onClick={nameBusy ? undefined : saveName} disabled={nameBusy} style={primaryBtn(nameBusy)}>
                {nameBusy ? 'Saving…' : 'Save name'}
              </button>
            </div>

            {/* Password */}
            <div style={cardStyle}>
              <div style={labelStyle}>Change password</div>
              <input
                type="password"
                placeholder="Current password"
                autoComplete="current-password"
                maxLength={128}
                value={curPw}
                onChange={e => { setCurPw(e.target.value); setPwMsg(null); }}
                style={inputStyle}
              />
              <input
                type="password"
                placeholder="New password (12+ chars, upper, lower, digit)"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                value={newPw}
                onChange={e => { setNewPw(e.target.value); setPwMsg(null); }}
                style={inputStyle}
              />
              {pwMsg && <Message msg={pwMsg} />}
              <button onClick={pwBusy ? undefined : savePassword} disabled={pwBusy} style={primaryBtn(pwBusy)}>
                {pwBusy ? 'Saving…' : 'Update password'}
              </button>
            </div>

            {/* Log out */}
            <div style={cardStyle}>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                style={{ width: '100%', padding: 14, borderRadius: 14, background: '#1a1a1a', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
                Log out
              </button>
            </div>

            {/* Danger zone */}
            <div style={{ margin: '0 20px 16px', background: '#fff', border: '1px solid #f3cdc3', borderRadius: 20, padding: 18 }}>
              <div style={{ fontSize: 11, color: '#a63b25', letterSpacing: .5, textTransform: 'uppercase', fontWeight: 700 }}>Danger zone</div>
              {!deleteOpen ? (
                <>
                  <div style={{ fontSize: 12, color: '#8a7d6e', marginTop: 8, lineHeight: 1.5 }}>
                    Deleting your account permanently removes your profile and every progress report. This cannot be undone.
                  </div>
                  <button
                    onClick={openDelete}
                    style={{ marginTop: 14, width: '100%', padding: 14, borderRadius: 14, background: '#fff', color: '#a63b25', border: '1px solid #e5a99c', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Delete account
                  </button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', marginTop: 10 }}>Are you sure about deleting your account?</div>
                  <div style={{ fontSize: 12, color: '#8a7d6e', marginTop: 6, lineHeight: 1.5 }}>
                    This is permanent. Enter your current password to confirm.
                  </div>
                  <input
                    type="password"
                    placeholder="Current password"
                    autoComplete="current-password"
                    maxLength={128}
                    value={delPw}
                    onChange={e => { setDelPw(e.target.value); setDelErr(''); }}
                    style={inputStyle}
                  />
                  {delErr && (
                    <div style={{ marginTop: 12, padding: '10px 12px', background: '#fef0ee', border: '1px solid #f3cdc3', borderRadius: 10, color: '#a63b25', fontSize: 13 }}>
                      {delErr}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                    <button
                      onClick={delBusy ? undefined : cancelDelete}
                      disabled={delBusy}
                      style={{ flex: '0 0 auto', padding: '14px 22px', background: '#ece6db', color: '#1a1a1a', borderRadius: 14, border: 'none', fontSize: 14, fontWeight: 600, cursor: delBusy ? 'default' : 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={delBusy ? undefined : confirmDelete}
                      disabled={delBusy}
                      style={{ flex: 1, padding: 14, background: delBusy ? '#c47a6b' : '#a63b25', color: '#fff', borderRadius: 14, border: 'none', fontSize: 14, fontWeight: 600, cursor: delBusy ? 'default' : 'pointer' }}
                    >
                      {delBusy ? 'Deleting…' : 'Yes, delete my account'}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div style={{ height: 12 }} />
          </div>
        </div>
      </IOSDevice>
    </div>
  );
}

function Message({ msg }) {
  const ok = msg.ok;
  return (
    <div style={{
      marginTop: 12, padding: '10px 12px', borderRadius: 10, fontSize: 13,
      background: ok ? '#eef7ed' : '#fef0ee',
      border: `1px solid ${ok ? '#cce0c8' : '#f3cdc3'}`,
      color: ok ? '#3a6f3a' : '#a63b25',
    }}>
      {msg.text}
    </div>
  );
}

function primaryBtn(busy) {
  return {
    marginTop: 14, width: '100%', padding: 14, borderRadius: 14,
    background: busy ? '#4a443c' : '#1a1a1a', color: '#fff', border: 'none',
    fontSize: 14, fontWeight: 600, cursor: busy ? 'default' : 'pointer',
  };
}
