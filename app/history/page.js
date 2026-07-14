'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import IOSDevice from '../IOSDevice';
import {
  LEVELS,
  PB_SETS_TO_PASS,
  PB_SETS_PER_COLOR,
  KIND_LABEL,
  stepInfo,
  colorName,
  colorHex,
  colorsCleared,
} from '../../lib/ladder';

const darken = (hex, a = 40) => {
  const n = i => Math.max(0, parseInt(hex.slice(i, i + 2), 16) - a).toString(16).padStart(2, '0');
  return '#' + n(1) + n(3) + n(5);
};
const mix = (hex, t) => {
  const c = i => { const v = parseInt(hex.slice(i, i + 2), 16); return Math.round(v + (255 - v) * t).toString(16).padStart(2, '0'); };
  return '#' + c(1) + c(3) + c(5);
};

function whenLabel(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const cardStyle = { margin: '0 20px 16px', background: '#fff', border: '1px solid #ece6db', borderRadius: 20, padding: 18 };
const sectionLabel = { fontSize: 11, color: '#8a8175', letterSpacing: .5, textTransform: 'uppercase', fontWeight: 600 };

// A read-only record of the reader's SRA progression. Nothing on this screen is
// interactive except the back arrow — it exists purely to view history the
// system recorded, not to change it.
export default function HistoryPage() {
  const router = useRouter();

  const [levelIdx, setLevelIdx] = useState(0);
  const [colorIdx, setColorIdx] = useState(0);
  const [pbPassed, setPbPassed] = useState(0);
  const [reports, setReports] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [meRes, repRes] = await Promise.all([
          fetch('/api/me', { credentials: 'same-origin' }),
          fetch('/api/reports', { credentials: 'same-origin' }),
        ]);
        if (meRes.status === 401) { await signOut({ callbackUrl: '/login' }); return; }
        if (meRes.ok) {
          const j = await meRes.json();
          if (alive && j.user) {
            if (typeof j.user.levelIdx === 'number') setLevelIdx(j.user.levelIdx);
            if (typeof j.user.colorIdx === 'number') setColorIdx(j.user.colorIdx);
            if (typeof j.user.pbPassed === 'number') setPbPassed(j.user.pbPassed);
          }
        }
        if (repRes.ok) {
          const j = await repRes.json();
          if (alive && Array.isArray(j.reports)) setReports(j.reports);
        }
      } catch {}
      if (alive) setLoaded(true);
    })();
    return () => { alive = false; };
  }, []);

  const goAccount = () => router.push('/account');

  const v = useMemo(() => {
    const cur = stepInfo(levelIdx, colorIdx) || stepInfo(0, 0);
    const accent = cur.hex;
    const clearedColors = colorsCleared(levelIdx, colorIdx);

    // Full level → color progression map with a status for every color.
    const levels = LEVELS.map((lvl, li) => ({
      code: lvl.code,
      done: li < levelIdx,
      current: li === levelIdx,
      locked: li > levelIdx,
      colors: lvl.colors.map((key, ci) => {
        let status;
        if (li < levelIdx) status = 'done';
        else if (li > levelIdx) status = 'locked';
        else if (ci < colorIdx) status = 'done';
        else if (ci === colorIdx) status = 'current';
        else status = 'locked';
        return { key, name: colorName(key), hex: colorHex(key), status };
      }),
    }));

    const recorded = reports
      .map((r) => {
        const s = stepInfo(r.levelIdx, r.colorIdx);
        const place = r.kind === 'level_test' && typeof r.placementColorIdx === 'number'
          ? stepInfo(r.levelIdx + 1, r.placementColorIdx)
          : null;
        return {
          id: r.id,
          kindLabel: KIND_LABEL[r.kind] || r.kind,
          kind: r.kind,
          pbCount: r.pbCount,
          score: r.score,
          rate: r.rate,
          passed: r.passed,
          when: whenLabel(r.createdAt),
          hex: s ? s.hex : accent,
          colorLabel: s ? `${s.name} · ${s.levelCode}` : '—',
          placementLabel: place ? `${place.name} · ${place.levelCode}` : null,
        };
      });

    return { cur, accent, clearedColors, levels, recorded };
  }, [levelIdx, colorIdx, reports]);

  const themeStyle = {
    position: 'relative', height: '100%', width: '100%', background: '#faf7f2', overflow: 'hidden',
    fontFamily: "'Inter',sans-serif", color: '#1a1a1a',
    '--accent': v.accent, '--accent-dark': darken(v.accent, 42),
    '--accent-tint': mix(v.accent, 0.86), '--accent-border': mix(v.accent, 0.66),
  };

  const statusDot = (status, hex) => {
    if (status === 'done') {
      return (
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: mix(hex, 0.15), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
        </div>
      );
    }
    if (status === 'current') {
      return (
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: hex, position: 'relative', flexShrink: 0, boxShadow: `0 0 0 3px ${hex}44` }}>
          <div style={{ position: 'absolute', inset: 6, borderRadius: '50%', background: 'rgba(255,255,255,.5)' }} />
        </div>
      );
    }
    return <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#efe9dd', border: '1px solid #e0d8c8', flexShrink: 0 }} />;
  };

  return (
    <div className="app-shell">
      <IOSDevice>
        <div style={themeStyle}>
          <div className="scroll-hide" style={{ position: 'absolute', inset: 0, paddingTop: 54, paddingBottom: 40, overflowY: 'auto', animation: 'sra-fadeIn .3s' }}>

            {/* Header with return-to-account arrow */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 20px 18px' }}>
              <div onClick={goAccount} title="Back to manage account" style={{ width: 38, height: 38, borderRadius: '50%', background: '#fff', border: '1px solid #ece6db', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
              </div>
              <div>
                <div style={{ fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', color: '#8a8175', fontWeight: 600 }}>Recorded by the system</div>
                <div style={{ fontFamily: "'Instrument Serif',serif", fontSize: 28, lineHeight: 1.05, letterSpacing: '-.4px' }}>SRA History</div>
              </div>
            </div>

            {/* Read-only notice */}
            <div style={{ margin: '0 20px 16px', padding: '10px 14px', background: 'var(--accent-tint)', border: '1px solid var(--accent-border)', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-dark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" /></svg>
              <div style={{ fontSize: 11, color: 'var(--accent-dark)', fontWeight: 600 }}>View only — this record can&apos;t be edited.</div>
            </div>

            {/* Current standing */}
            <div style={cardStyle}>
              <div style={sectionLabel}>Current standing</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: v.cur.hex, position: 'relative', flexShrink: 0, boxShadow: `0 6px 18px ${v.cur.hex}55` }}>
                  <div style={{ position: 'absolute', inset: 7, borderRadius: 10, background: 'linear-gradient(135deg,rgba(255,255,255,.35),transparent 55%)' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontFamily: "'Instrument Serif',serif", fontSize: 28, lineHeight: 1 }}>{v.cur.name}</div>
                    <div style={{ padding: '3px 8px', background: 'var(--accent-tint)', border: '1px solid var(--accent-border)', borderRadius: 7, fontSize: 11, fontWeight: 700, color: 'var(--accent-dark)' }}>{v.cur.levelCode}</div>
                  </div>
                  <div style={{ fontSize: 12, color: '#8a8175', marginTop: 4 }}>{pbPassed}/{PB_SETS_TO_PASS} passing sets · {PB_SETS_PER_COLOR} available</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <div style={{ flex: 1, background: '#f7f3ec', borderRadius: 12, padding: '10px 12px' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v.clearedColors}</div>
                  <div style={{ fontSize: 10, color: '#8a8175', marginTop: 2 }}>Colors cleared</div>
                </div>
                <div style={{ flex: 1, background: '#f7f3ec', borderRadius: 12, padding: '10px 12px' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v.recorded.length}</div>
                  <div style={{ fontSize: 10, color: '#8a8175', marginTop: 2 }}>Reports recorded</div>
                </div>
              </div>
            </div>

            {/* Progression map */}
            <div style={{ margin: '0 20px 8px', padding: '0 2px' }}>
              <div style={sectionLabel}>Progression</div>
            </div>
            {v.levels.map((lvl, li) => (
              <div key={lvl.code} style={{ ...cardStyle, marginBottom: 12, opacity: lvl.locked ? 0.75 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: .4 }}>Level {lvl.code}</div>
                    {lvl.current && <div style={{ fontSize: 9, letterSpacing: .4, textTransform: 'uppercase', fontWeight: 700, color: 'var(--accent-dark)', background: 'var(--accent-tint)', padding: '2px 6px', borderRadius: 5 }}>Current</div>}
                  </div>
                  <div style={{ fontSize: 10, color: '#bdb5a6', letterSpacing: .5, textTransform: 'uppercase', fontWeight: 600 }}>
                    {lvl.done ? 'Cleared' : lvl.locked ? 'Locked' : 'In progress'}
                  </div>
                </div>
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {lvl.colors.map((c, ci) => (
                    <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0' }}>
                      {statusDot(c.status, c.hex)}
                      <div style={{ width: 18, height: 18, borderRadius: 5, background: c.hex, flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: 13, fontWeight: c.status === 'current' ? 700 : 500, color: c.status === 'locked' ? '#a59c8c' : '#1a1a1a' }}>
                        {ci + 1}. {c.name}
                      </div>
                      <div style={{ fontSize: 10, color: c.status === 'current' ? 'var(--accent-dark)' : '#bdb5a6', letterSpacing: .4, textTransform: 'uppercase', fontWeight: 600 }}>
                        {c.status === 'done' ? 'Cleared' : c.status === 'current' ? 'Here' : 'Locked'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Recorded reports */}
            <div style={{ margin: '4px 20px 8px', padding: '0 2px' }}>
              <div style={sectionLabel}>Recorded reports</div>
            </div>
            <div style={{ margin: '0 20px 16px', background: '#fff', border: '1px solid #ece6db', borderRadius: 20, overflow: 'hidden' }}>
              {v.recorded.map((r, i) => (
                <div key={r.id} style={{ padding: '14px 16px', borderBottom: i < v.recorded.length - 1 ? '1px solid #f4efe6' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: r.hex, flexShrink: 0, position: 'relative' }}>
                      <div style={{ position: 'absolute', inset: 5, borderRadius: 5, background: 'linear-gradient(135deg,rgba(255,255,255,.3),transparent 60%)' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{r.kindLabel}</div>
                      <div style={{ fontSize: 11, color: '#8a8175', marginTop: 2 }}>
                        {r.colorLabel}{r.kind === 'powerbuilder' ? ` · ${r.pbCount} ${r.pbCount === 1 ? 'set' : 'sets'}` : ''}
                        {r.placementLabel ? ` · placed at ${r.placementLabel}` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: r.passed ? '#3a6f3a' : '#a63b25', fontVariantNumeric: 'tabular-nums' }}>{r.score}/10</div>
                      <div style={{ fontSize: 10, color: '#bdb5a6' }}>{r.when}</div>
                    </div>
                  </div>
                </div>
              ))}
              {loaded && v.recorded.length === 0 && (
                <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: '#8a8175' }}>
                  No reports recorded yet.
                </div>
              )}
            </div>

            <div style={{ height: 12 }} />
          </div>
        </div>
      </IOSDevice>
    </div>
  );
}
