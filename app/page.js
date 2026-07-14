'use client';

import { useEffect, useMemo, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import IOSDevice from './IOSDevice';
import {
  LEVELS,
  PB_SETS_PER_COLOR,
  PB_SETS_TO_PASS,
  PASS_SCORE,
  KIND_LABEL,
  stepInfo,
  colorName,
  colorHex,
  colorsCleared,
  advanceProgress,
  reportXp,
  isPassing,
} from '../lib/ladder';

const GUIDES = [
  { category:'Method', title:'Using Power Builders the right way', read:4, done:true,
    body:"A Power Builder is more than a quiz — it's a feedback loop. Work it in three passes.\n\n1. Survey first. Before reading, skim the title, the bold terms, and the questions at the end. You're priming your brain to hunt for those answers.\n\n2. Read once, fully. Resist the urge to re-read sentences. Trust that the second pass will catch what you missed. Re-reading mid-passage kills your rate without helping comprehension.\n\n3. Answer, then check immediately. The moment between answering and seeing the correct answer is where learning happens. Don't batch your checking — do it card by card.\n\nLog every Power Builder set you finish. You need 6 passing sets in a color before its exit test — but consistency beats cramming: two sets a day beats fourteen on Sunday." },
  { category:'Speed', title:'Reading rate without losing comprehension', read:5, done:true,
    body:"Most readers leave speed on the table because of habits, not ability.\n\nStop subvocalizing every word. You don't need to 'hear' each word to understand it. Practice reading slightly faster than is comfortable for two minutes a day — your comprehension dips at first, then catches up.\n\nUse a visual pacer. Run a finger or pen under the line. It stops your eyes from drifting back and pulls you forward at a steady clip.\n\nWiden your fixations. Instead of one word per glance, aim for three or four. The page has fewer 'stops' and your rate climbs naturally.\n\nTrack speed in every report. Pair it with comprehension — a faster rate only counts if your understanding holds." },
  { category:'Basics', title:'Passing a color and its exit test', read:3,
    body:"Each color has 12 Power Builder sets, but you only need 6 with a passing score to unlock the color's exit test.\n\nAim for the sweet spot. If you're scoring perfect every time, the color may be too easy. If you're below passing, slow down — frustration teaches nothing.\n\nDon't rush the exit test. It's the gate to the next color. Make sure your last few sets were comfortably passing before you take it.\n\nAt the end of a level, the exit test becomes a level test. Passing it moves you up a whole level and places you at a starting color." },
  { category:'Vocabulary', title:'Building vocabulary from context', read:4,
    body:"You don't need a dictionary for most unfamiliar words — the passage usually defines them for you.\n\nLook for signal words. 'That is', 'in other words', 'such as', and dashes often introduce a definition right after a hard term.\n\nUse contrast clues. Words like 'but', 'unlike', and 'however' tell you the meaning is the opposite of something nearby.\n\nGuess before you confirm. Make a prediction from context, then verify. The act of guessing cements the word far better than looking it up cold." },
  { category:'Retention', title:'Active recall after every passage', read:5,
    body:"Reading puts information in. Recall is what keeps it there.\n\nAfter each passage, look away and say the main idea in one sentence. If you can't, you didn't read it — you looked at it.\n\nWrite three keywords from memory before checking the card. This tiny effort doubles retention compared to passive re-reading.\n\nSpace it out. Revisit yesterday's hardest passage for sixty seconds today. The forgetting curve flattens every time you pull the memory back up." },
  { category:'Advanced', title:'Beating comprehension plateaus', read:6,
    body:"Everyone stalls. A plateau means your current strategy has maxed out — not that you've hit your ceiling.\n\nChange the variable. If your rate is high but comprehension flat, slow down deliberately for a week. If comprehension is high but rate flat, push speed and accept a temporary dip.\n\nAnalyze your misses. Pull your last five reports. Are you missing main-idea questions or detail questions? Main-idea misses mean you're reading too fast; detail misses mean you're not surveying first.\n\nRest counts. Comprehension is cognitive — a tired brain reads worse. A rest day inside your streak often produces your best score the day after." },
];

const FEATURED = {
  category:'Featured', read:6, title:'The SQ3R method',
  blurb:'Survey, Question, Read, Recite, Review — the five-step system that turns passive reading into deliberate practice.',
  body:"SQ3R is the backbone of every other technique in this guide. Five steps, in order, every time.\n\nSurvey. Spend thirty seconds scanning the whole passage — headings, bold words, the shape of it. You're building a map before the journey.\n\nQuestion. Turn each heading into a question. 'Cell respiration' becomes 'How does cell respiration work?' Now you're reading to answer, not just to absorb.\n\nRead. Read actively, hunting for the answers to your questions. Don't re-read. Keep moving.\n\nRecite. After each section, look away and answer your question out loud or on paper. This is the step everyone skips and the one that matters most.\n\nReview. At the end, run back through your questions and answers. Five minutes of review now saves an hour of re-reading later.\n\nDo this on your next Power Builder and watch your comprehension score climb."
};

const periodLabel = p => ({ daily:'Daily', weekly:'Weekly', monthly:'Monthly' }[p] || p);
function relativeWhen(iso) {
  const d = new Date(iso); const now = Date.now(); const diff = (now - d.getTime()) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  if (diff < 86400*2) return 'Yesterday';
  if (diff < 86400*7) return `${Math.floor(diff/86400)}d ago`;
  if (diff < 86400*30) return `${Math.floor(diff/86400/7)}w ago`;
  return d.toLocaleDateString();
}
const shadow = hex => hex + '55';
const tint = hex => hex + '22';
const darken = (hex, a = 40) => {
  const n = i => Math.max(0, parseInt(hex.slice(i, i + 2), 16) - a).toString(16).padStart(2, '0');
  return '#' + n(1) + n(3) + n(5);
};
const mix = (hex, t) => {
  const c = i => { const v = parseInt(hex.slice(i, i + 2), 16); return Math.round(v + (255 - v) * t).toString(16).padStart(2, '0'); };
  return '#' + c(1) + c(3) + c(5);
};

const NotifIcon = ({ type }) => {
  switch (type) {
    case 'achievement':
      return <svg viewBox="0 0 24 24" fill="#fff" width="18" height="18"><path d="M12 2l2.9 6.3 6.8.7-5.1 4.6 1.4 6.7L12 17.8 5 21l1.4-6.7L1.3 9.7l6.8-.7z"/></svg>;
    case 'level':
      return <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" width="18" height="18" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>;
    case 'reminder':
      return <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" width="18" height="18" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case 'guide':
      return <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" width="18" height="18" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h7v15H4z"/><path d="M13 5h7v15h-7z"/></svg>;
    default:
      return <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" width="18" height="18" strokeLinecap="round" strokeLinejoin="round"><path d="M3 20h18"/><path d="M6 16v-4M11 16V8M16 16v-6"/></svg>;
  }
};

const LAST_LEVEL = LEVELS.length - 1;

export default function Page() {
  const [screen, setScreen] = useState('home');
  const [ladderTab, setLadderTab] = useState('climb');
  const [streak, setStreak] = useState(0);
  // Ladder position, owned by the server; mirrored here for display.
  const [levelIdx, setLevelIdx] = useState(0);
  const [colorIdx, setColorIdx] = useState(0);
  const [pbPassed, setPbPassed] = useState(0);
  const [showReminder, setShowReminder] = useState(false);
  const [daysSinceReport, setDaysSinceReport] = useState(0);
  const [reports, setReports] = useState([]);
  const { data: session } = useSession();
  const router = useRouter();

  const loadMe = async () => {
    try {
      const r = await fetch('/api/me', { credentials: 'same-origin' });
      if (r.status === 401) {
        await signOut({ callbackUrl: '/login' });
        return;
      }
      if (!r.ok) return;
      const j = await r.json();
      if (!j.user) return;
      if (typeof j.user.levelIdx === 'number') setLevelIdx(j.user.levelIdx);
      if (typeof j.user.colorIdx === 'number') setColorIdx(j.user.colorIdx);
      if (typeof j.user.pbPassed === 'number') setPbPassed(j.user.pbPassed);
      if (typeof j.user.streak === 'number') setStreak(j.user.streak);
      const last = j.user.lastReportAt ? new Date(j.user.lastReportAt).getTime() : null;
      const days = last != null ? Math.floor((Date.now() - last) / (24 * 60 * 60 * 1000)) : null;
      setDaysSinceReport(days ?? 0);
      setShowReminder(days != null && days >= 3);
    } catch {}
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadMe(); }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/reports', { credentials: 'same-origin' });
        if (!r.ok) return;
        const j = await r.json();
        if (!alive || !Array.isArray(j.reports)) return;
        const mapped = j.reports.map((rep) => ({
          id: rep.id,
          period: rep.period,
          kind: rep.kind,
          levelIdx: rep.levelIdx,
          colorIdx: rep.colorIdx,
          pbCount: rep.pbCount,
          score: rep.score,
          rate: rep.rate,
          passed: rep.passed,
          placementColorIdx: rep.placementColorIdx,
          xp: rep.xp,
          ts: new Date(rep.createdAt).getTime(),
          when: relativeWhen(rep.createdAt),
        }));
        setReports(mapped);
      } catch {}
    })();
    return () => { alive = false; };
  }, []);
  const [notifs, setNotifs] = useState([]);

  const loadNotifs = async () => {
    try {
      const r = await fetch('/api/notifications', { credentials: 'same-origin' });
      if (!r.ok) return;
      const j = await r.json();
      if (!Array.isArray(j.notifications)) return;
      setNotifs(j.notifications.map(n => ({
        id: n.id, type: n.type, title: n.title, body: n.body,
        when: relativeWhen(n.createdAt), unread: !n.read,
      })));
    } catch {}
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadNotifs(); }, []);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportStep, setReportStep] = useState(1);
  const [reportKind, setReportKind] = useState('powerbuilder');
  const [reportPeriod, setReportPeriod] = useState('weekly');
  const [reportPB, setReportPB] = useState(1);
  const [reportScore, setReportScore] = useState(8);
  const [reportRate, setReportRate] = useState(7);
  const [reportPlacementIdx, setReportPlacementIdx] = useState(0);

  const [guideOpen, setGuideOpen] = useState(false);
  const [activeGuideIdx, setActiveGuideIdx] = useState(-1);
  const [levelUpShown, setLevelUpShown] = useState(false);
  const [levelUpKind, setLevelUpKind] = useState('color'); // 'color' | 'level'
  const [levelUpFrom, setLevelUpFrom] = useState(null);

  const goAccount = () => router.push('/account');

  const goHome   = () => setScreen('home');
  const goGuide  = () => setScreen('guide');
  const goLadder = () => setScreen('ladder');
  const goStats  = () => setScreen('stats');
  const openNotifs = async () => {
    setScreen('notifs');
    setNotifs(n => n.map(x => ({ ...x, unread: false })));
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
    } catch {}
  };

  const openFeatured = () => { setGuideOpen(true); setActiveGuideIdx(-2); };
  const openGuide = i => () => { setGuideOpen(true); setActiveGuideIdx(i); };
  const closeGuide = () => setGuideOpen(false);

  const atLastColor = colorIdx >= LEVELS[levelIdx].colors.length - 1;
  const atLastLevel = levelIdx >= LAST_LEVEL;

  const openReport = () => {
    setReportOpen(true);
    setReportStep(1);
    // Default to the report kind that fits where the reader is right now.
    const suggested = atLastColor
      ? (atLastLevel ? 'powerbuilder' : 'level_test')
      : (pbPassed >= PB_SETS_TO_PASS ? 'exit_test' : 'powerbuilder');
    setReportKind(suggested);
    setReportPeriod('weekly');
    setReportPB(1);
    setReportScore(8);
    setReportRate(7);
    setReportPlacementIdx(0);
  };
  const closeReport = () => setReportOpen(false);

  const buildReportInput = () => ({
    period: reportPeriod,
    kind: reportKind,
    levelIdx,
    colorIdx,
    pbCount: reportKind === 'powerbuilder' ? reportPB : 0,
    score: reportScore,
    rate: reportRate,
    placementColorIdx: reportKind === 'level_test' ? reportPlacementIdx : undefined,
  });

  const submitReport = async () => {
    const input = buildReportInput();
    const earn = reportXp(input);
    const prev = { levelIdx, colorIdx, pbPassed };
    let serverReport = null;
    let serverUser = null;
    let serverColorAdvanced = false;
    let serverLeveledUp = false;
    try {
      const r = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(input),
      });
      if (r.ok) {
        const j = await r.json();
        serverReport = j?.report ?? null;
        serverUser = j?.user ?? null;
        serverColorAdvanced = !!j?.colorAdvanced;
        serverLeveledUp = !!j?.leveledUp;
      }
    } catch {}

    const rep = {
      id: serverReport?.id ?? `local-${Date.now()}`,
      period: reportPeriod,
      kind: reportKind,
      levelIdx: prev.levelIdx,
      colorIdx: prev.colorIdx,
      pbCount: input.pbCount,
      score: reportScore,
      rate: reportRate,
      passed: isPassing(reportScore),
      placementColorIdx: input.placementColorIdx ?? null,
      ts: serverReport?.createdAt ? new Date(serverReport.createdAt).getTime() : Date.now(),
      when: 'Just now',
      xp: serverReport?.xp ?? earn,
    };
    setReports(r => [rep, ...r]);

    if (serverUser) {
      setLevelIdx(serverUser.levelIdx);
      setColorIdx(serverUser.colorIdx);
      setPbPassed(serverUser.pbPassed);
      if (serverLeveledUp || serverColorAdvanced) {
        setLevelUpKind(serverLeveledUp ? 'level' : 'color');
        setLevelUpFrom(prev);
        setLevelUpShown(true);
      }
    } else {
      // Offline: mirror the same authoritative rules locally so the UI responds.
      const next = advanceProgress(prev, input);
      setLevelIdx(next.levelIdx);
      setColorIdx(next.colorIdx);
      setPbPassed(next.pbPassed);
      if (next.leveledUp || next.colorAdvanced) {
        setLevelUpKind(next.leveledUp ? 'level' : 'color');
        setLevelUpFrom(prev);
        setLevelUpShown(true);
      }
    }

    setReportOpen(false);
    setShowReminder(false);
    if (serverUser) { loadMe(); loadNotifs(); }
  };

  const rNextStep = () => { if (reportStep < 3) setReportStep(s => s + 1); else submitReport(); };
  const rPrevStep = () => setReportStep(s => Math.max(1, s - 1));

  const v = useMemo(() => {
    const cur = stepInfo(levelIdx, colorIdx);
    const accent = cur.hex;
    const accentDark = darken(cur.hex, 42);
    const accentLight = mix(cur.hex, 0.32);
    const accentTint = mix(cur.hex, 0.86);
    const accentBorder = mix(cur.hex, 0.66);
    const accentShadow = cur.hex + '73';

    const colorsInLevel = cur.colorsInLevel;
    const setsPct = Math.min(100, (pbPassed / PB_SETS_TO_PASS) * 100);
    const setsRemaining = Math.max(0, PB_SETS_TO_PASS - pbPassed);
    const exitReady = pbPassed >= PB_SETS_TO_PASS;

    // What comes next from the current position.
    let nextTarget;
    if (!cur.isLastColor) {
      const nx = stepInfo(levelIdx, colorIdx + 1);
      nextTarget = { kind: 'color', name: nx.name, code: cur.levelCode, hex: nx.hex };
    } else if (!cur.isLastLevel) {
      const nl = LEVELS[levelIdx + 1];
      const nx = stepInfo(levelIdx + 1, 0);
      nextTarget = { kind: 'level', name: `Level ${nl.code}`, code: nl.code, hex: nx.hex };
    } else {
      nextTarget = { kind: 'top', name: 'Top of the ladder', code: cur.levelCode, hex: cur.hex };
    }

    // Gate/action prompt for the current color.
    let action;
    if (cur.isLastColor && !cur.isLastLevel) {
      action = exitReady
        ? { ready: true, label: `Level test ready — pass it to reach ${LEVELS[levelIdx + 1].code}` }
        : { ready: false, label: `${setsRemaining} more passing ${setsRemaining === 1 ? 'set' : 'sets'} until the level test` };
    } else if (cur.isLastColor && cur.isLastLevel) {
      action = exitReady
        ? { ready: true, label: "You've cleared the top color — you're at the summit" }
        : { ready: false, label: `${setsRemaining} more passing ${setsRemaining === 1 ? 'set' : 'sets'} in the final color` };
    } else {
      action = exitReady
        ? { ready: true, label: `Exit test ready — pass it to reach ${stepInfo(levelIdx, colorIdx + 1).name}` }
        : { ready: false, label: `${setsRemaining} more passing ${setsRemaining === 1 ? 'set' : 'sets'} until the exit test` };
    }

    // Stats derived purely from the reader's real reports.
    const hasReports = reports.length > 0;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weeklyPB = reports
      .filter(r => r.kind === 'powerbuilder' && (r.ts ?? 0) >= weekAgo)
      .reduce((a, r) => a + (r.pbCount || 0), 0);
    const scored = reports.slice(0, 6);
    const avgScore = scored.length ? Math.round(scored.reduce((a, r) => a + r.score, 0) / scored.length) : 0;
    const avgRate = scored.length ? Math.round(scored.reduce((a, r) => a + r.rate, 0) / scored.length) : 0;
    const recentReports = reports.slice(0, 3).map(r => {
      const s = stepInfo(r.levelIdx, r.colorIdx);
      return { ...r, color: s ? s.hex : accent, kindLabel: KIND_LABEL[r.kind] || r.kind };
    });

    // Levels overview (1C → 3B).
    const levels = LEVELS.map((lvl, i) => {
      const done = i < levelIdx, current = i === levelIdx, locked = i > levelIdx;
      const rep = stepInfo(i, current ? colorIdx : 0);
      return {
        code: lvl.code, count: lvl.colors.length,
        done, current, locked,
        hex: rep.hex,
        bg: locked ? '#efe9dd' : (current ? rep.hex : mix(rep.hex, 0.5)),
        textColor: locked ? '#8a8175' : (current ? '#fff' : '#4a443c'),
      };
    });

    // Colors of the current level, as a vertical ladder.
    const levelColors = LEVELS[levelIdx].colors.map((key, i) => {
      const done = i < colorIdx, current = i === colorIdx, locked = i > colorIdx;
      const hex = colorHex(key);
      return {
        name: colorName(key), hex,
        numStr: String(i + 1).padStart(2, '0'),
        done, current, locked,
        opacity: locked ? 0.6 : 1,
        textColor: locked ? '#8a8175' : '#1a1a1a',
        discBg: locked ? '#efe9dd' : hex,
        discShadow: locked ? 'none' : ('0 4px 14px ' + shadow(hex)),
        upColor: i === 0 ? 'transparent' : (i <= colorIdx ? '#d8b8a0' : '#f0e9dc'),
        downColor: i === colorsInLevel - 1 ? 'transparent' : (i < colorIdx ? '#d8b8a0' : '#f0e9dc'),
        sep: i === colorsInLevel - 1 ? 'transparent' : '#f4efe6',
        statusLabel: done ? 'Cleared' : current ? `${pbPassed}/${PB_SETS_TO_PASS} sets` : 'Locked',
        statusColor: done ? '#8a8175' : current ? 'var(--accent)' : '#bdb5a6',
      };
    });

    const clearedColors = colorsCleared(levelIdx, colorIdx);
    const colorsRemaining = Math.max(0, colorsInLevel - 1 - colorIdx);
    const levelsRemaining = LAST_LEVEL - levelIdx;

    // Achievements — earned states computed from real progress + reports.
    const bestScore = reports.reduce((m, r) => Math.max(m, r.score || 0), 0);
    const hasPerfect = reports.some(r => r.score === 10);
    const lifetimePassingSets = reports
      .filter(r => r.kind === 'powerbuilder' && r.passed)
      .reduce((a, r) => a + (r.pbCount || 0), 0);

    const achDefs = [
      { name:'First Report',  desc:'Logged your first progress report', color:'#c8643d', earned: hasReports, xp:20 },
      { name:'Passing Grade', desc:`Scored ${PASS_SCORE}/10 or better on a report`, color:'#6fac6f', earned: bestScore >= PASS_SCORE, xp:30 },
      { name:'Perfect Set',   desc:'Hit a perfect 10/10 understanding', color:'#d9b850', earned: hasPerfect, xp:40 },
      { name:'Week Warrior',  desc:'Reached a 7-day streak', color:'#db8447', earned: streak >= 7, prog: Math.min(100, Math.round(streak/7*100)), progLabel:`${Math.min(streak,7)} / 7 days`, xp:40 },
      { name:'Power Surge',   desc:'10 Power Builder sets in one week', color:'#8c5ca8', earned: weeklyPB >= 10, prog: Math.min(100, Math.round(weeklyPB/10*100)), progLabel:`${Math.min(weeklyPB,10)} / 10 sets`, xp:50 },
      { name:'Color Climber', desc:'Cleared 3 colors', color:'#5c89c9', earned: clearedColors >= 3, prog: Math.min(100, Math.round(clearedColors/3*100)), progLabel:`${Math.min(clearedColors,3)} / 3 colors`, xp:60 },
      { name:'Level Up',      desc:'Passed a level test and moved up', color:'#4fa8a8', earned: levelIdx >= 1, xp:70 },
      { name:'Top of the Lab',desc:`Reach ${LEVELS[LAST_LEVEL].code} — the final level`, color:'#c95c5c', earned: levelIdx >= LAST_LEVEL, prog: Math.round(levelIdx/LAST_LEVEL*100), progLabel:`${LEVELS[levelIdx].code} / ${LEVELS[LAST_LEVEL].code}`, xp:100 },
    ];
    const achievements = achDefs.map(a => ({
      ...a,
      locked: !a.earned,
      opacity: a.earned ? 1 : 0.92,
      badgeBg: a.earned ? a.color : '#f0e9dc',
      badgeShadow: a.earned ? ('0 6px 16px ' + shadow(a.color)) : 'none',
      nameColor: a.earned ? '#1a1a1a' : '#8a8175',
      showProgress: !a.earned && a.prog != null,
      progPct: a.prog || 0,
      progLabel: a.progLabel || '',
    }));
    const earnedCount = achDefs.filter(a => a.earned).length;
    const totalBadgeXp = achDefs.filter(a => a.earned).reduce((x, a) => x + a.xp, 0);

    const lifetimePB = reports.filter(r => r.kind === 'powerbuilder').reduce((a, r) => a + (r.pbCount || 0), 0);
    const trendSrc = reports.slice(0, 6).slice().reverse();
    const trend = trendSrc.map(r => ({
      score: r.score,
      label: (KIND_LABEL[r.kind] || '?').slice(0, 1),
      h: Math.round((r.score / 10) * 84) + 6,
      hex: r.score >= 8 ? 'var(--accent)' : 'var(--accent-light)',
      hex2: r.score >= 8 ? 'var(--accent-dark)' : 'var(--accent)',
    }));
    const trendDelta = trendSrc.length ? '+' + Math.max(0, trendSrc[trendSrc.length - 1].score - trendSrc[0].score) + ' pts' : '';
    const allReports = reports.map(r => {
      const s = stepInfo(r.levelIdx, r.colorIdx);
      const hex = s ? s.hex : accent;
      return {
        ...r,
        color: hex,
        tint: tint(hex),
        colorName: s ? `${s.name} · ${s.levelCode}` : '—',
        kindLabel: KIND_LABEL[r.kind] || r.kind,
      };
    });

    const notifications = notifs.map(n => ({
      ...n,
      iconBg: 'var(--accent)',
      bg: n.unread ? '#fff' : '#f7f3ec',
      border: n.unread ? '#ece6db' : '#f0e9dc',
    }));
    const unreadCount = notifs.filter(n => n.unread).length;

    // Report sheet preview.
    const reportInput = {
      period: reportPeriod, kind: reportKind, levelIdx, colorIdx,
      pbCount: reportKind === 'powerbuilder' ? reportPB : 0, score: reportScore, rate: reportRate,
      placementColorIdx: reportKind === 'level_test' ? reportPlacementIdx : undefined,
    };
    const projected = advanceProgress({ levelIdx, colorIdx, pbPassed }, reportInput);
    const projectedStep = stepInfo(projected.levelIdx, projected.colorIdx);
    const nextLevelColors = levelIdx < LAST_LEVEL ? LEVELS[levelIdx + 1].colors : [];

    return {
      cur, accent, accentDark, accentLight, accentTint, accentBorder, accentShadow,
      colorsInLevel, setsPct, setsRemaining, exitReady, nextTarget, action,
      hasReports, weeklyPB, avgScore, avgRate, recentReports,
      levels, levelColors, clearedColors, colorsRemaining, levelsRemaining,
      achievements, earnedCount, achTotal: achDefs.length, totalBadgeXp,
      lifetimePB, lifetimePassingSets, trend, trendDelta, allReports,
      notifications, unreadCount,
      reportXp: reportXp(reportInput),
      projected, projectedStep, nextLevelColors,
    };
  }, [levelIdx, colorIdx, pbPassed, streak, reports, notifs, reportKind, reportPeriod, reportPB, reportScore, reportRate, reportPlacementIdx]);

  const confetti = useMemo(() => {
    if (!levelUpShown) return [];
    return Array.from({ length: 40 }).map((_, i) => ({
      left: Math.random() * 100,
      color: ['#fff', v.cur.hex, '#e89556', '#fffbe6'][i % 4],
      dur: 2 + Math.random() * 2,
      delay: Math.random() * 0.6,
      dx: (Math.random() - 0.5) * 220,
    }));
  }, [levelUpShown, v.cur.hex]);

  const isHome = screen === 'home';
  const isGuide = screen === 'guide';
  const isLadder = screen === 'ladder';
  const isStats = screen === 'stats';
  const isNotifs = screen === 'notifs';
  const showNav = screen !== 'notifs';

  const themeStyle = {
    position:'relative', height:'100%', width:'100%', background:'#faf7f2', overflow:'hidden',
    fontFamily:"'Inter',sans-serif", color:'#1a1a1a',
    '--accent': v.accent, '--accent-dark': v.accentDark, '--accent-light': v.accentLight,
    '--accent-tint': v.accentTint, '--accent-border': v.accentBorder, '--accent-shadow': v.accentShadow,
  };

  const activeGuide = activeGuideIdx === -2 ? FEATURED : (GUIDES[activeGuideIdx] || GUIDES[0]);

  // Which report kinds fit the reader's current position (for gentle guidance;
  // the server is always the real gate).
  const kindFits = {
    powerbuilder: true,
    exit_test: !atLastColor && pbPassed >= PB_SETS_TO_PASS,
    level_test: atLastColor && !atLastLevel && pbPassed >= PB_SETS_TO_PASS,
  };
  const kindOptions = [
    { key:'powerbuilder', label:'Power Builder set', sub:'Log stories & activities you read and answered' },
    { key:'exit_test',    label:'Exit color test',   sub:`Move to the next color after ${PB_SETS_TO_PASS} passing sets` },
    { key:'level_test',   label:'Level test',        sub:'End-of-level test that places you in the next level' },
  ];

  const navItem = (label, active, onClick, iconPath) => (
    <div onClick={onClick} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor:'pointer', padding:'6px 0' }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#1a1a1a' : '#bdb5a6'} strokeWidth={active ? 2.2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
        {iconPath}
      </svg>
      <div style={{ fontSize:9, letterSpacing:.3, fontWeight:600, color: active ? '#1a1a1a' : '#bdb5a6' }}>{label}</div>
    </div>
  );

  return (
    <div className="app-shell">
      <IOSDevice>
        <div style={themeStyle}>
          {/* HOME */}
          {isHome && (
            <div className="scroll-hide" style={{ position:'absolute', inset:0, paddingTop:54, paddingBottom:96, overflowY:'auto', animation:'sra-fadeIn .3s' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 20px 18px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div onClick={goAccount} title="Account" style={{ width:38, height:38, borderRadius:'50%', background:`linear-gradient(135deg,${v.accent},${v.accentDark})`, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:600, fontSize:14, cursor:'pointer' }}>
                    {(session?.user?.name || session?.user?.email || 'M').trim().charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize:11, color:'#8a8175', letterSpacing:.8, textTransform:'uppercase', fontWeight:500 }}>Welcome back</div>
                    <div style={{ fontSize:16, fontWeight:600, marginTop:1 }}>{session?.user?.name || session?.user?.email?.split('@')[0] || 'Reader'}</div>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div onClick={openNotifs} style={{ position:'relative', width:38, height:38, borderRadius:'50%', background:'#fff', border:'1px solid #ece6db', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 004 0"/></svg>
                    {v.unreadCount > 0 && (
                      <div style={{ position:'absolute', top:7, right:8, minWidth:15, height:15, padding:'0 3px', borderRadius:999, background:'var(--accent)', color:'#fff', fontSize:9, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid #fff' }}>{v.unreadCount}</div>
                    )}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 12px 9px 10px', background:'#fff', borderRadius:999, border:'1px solid #ece6db' }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent)' }}/>
                    <div style={{ fontSize:13, fontWeight:600, fontVariantNumeric:'tabular-nums' }}>{streak}</div>
                    <div style={{ fontSize:10, color:'#8a8175', letterSpacing:.5, textTransform:'uppercase', fontWeight:500 }}>days</div>
                  </div>
                </div>
              </div>

              {showReminder && (
                <div style={{ margin:'0 20px 16px', padding:'14px 16px', background:'var(--accent-tint)', border:'1px solid var(--accent-border)', borderRadius:18, display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:34, height:34, borderRadius:10, background:'var(--accent)', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:600 }}>No report in {daysSinceReport} {daysSinceReport === 1 ? 'day' : 'days'}</div>
                    <div style={{ fontSize:11, color:'#8a7d6e', marginTop:1 }}>
                      {streak > 0 ? `Log one to protect your ${streak}-day streak.` : 'Log one to get your streak going again.'}
                    </div>
                  </div>
                  <div onClick={openReport} style={{ padding:'8px 12px', background:'var(--accent)', color:'#fff', borderRadius:10, fontSize:11, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>Log now</div>
                </div>
              )}

              <div style={{ margin:'0 20px', background:'#fff', borderRadius:24, padding:24, border:'1px solid #ece6db', position:'relative', overflow:'hidden' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div style={{ fontSize:10, color:'#8a8175', letterSpacing:1.2, textTransform:'uppercase', fontWeight:600 }}>Current Color</div>
                    <div style={{ display:'flex', alignItems:'center', gap:9, marginTop:8 }}>
                      <div style={{ fontFamily:"'Instrument Serif',serif", fontSize:42, fontWeight:400, lineHeight:1, letterSpacing:'-.5px' }}>{v.cur.name}</div>
                      <div style={{ padding:'4px 9px', background:'var(--accent-tint)', border:'1px solid var(--accent-border)', borderRadius:8, fontSize:12, fontWeight:700, color:'var(--accent-dark)', letterSpacing:.5 }}>{v.cur.levelCode}</div>
                    </div>
                    <div style={{ fontSize:12, color:'#8a8175', marginTop:6, fontVariantNumeric:'tabular-nums' }}>Level {v.cur.levelCode} · Color {colorIdx + 1} of {v.colorsInLevel}</div>
                  </div>
                  <div style={{ width:64, height:64, borderRadius:18, background:v.cur.hex, position:'relative', boxShadow:`0 6px 20px ${shadow(v.cur.hex)}`, animation:'sra-glow 3s ease-in-out infinite' }}>
                    <div style={{ position:'absolute', inset:8, borderRadius:12, background:'linear-gradient(135deg, rgba(255,255,255,.35), rgba(255,255,255,0) 50%)' }}/>
                  </div>
                </div>
                <div style={{ marginTop:24 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8 }}>
                    <div style={{ fontSize:11, letterSpacing:.8, textTransform:'uppercase', color:'#8a8175', fontWeight:500 }}>Passing sets</div>
                    <div style={{ fontSize:13, fontWeight:600, fontVariantNumeric:'tabular-nums' }}>{pbPassed} <span style={{ color:'#bdb5a6', fontWeight:400 }}>/ {PB_SETS_TO_PASS}</span></div>
                  </div>
                  <div style={{ height:8, background:'#f4efe6', borderRadius:999, overflow:'hidden', position:'relative' }}>
                    <div style={{ height:'100%', borderRadius:999, background:`linear-gradient(90deg, ${v.cur.hex}, ${v.nextTarget.hex})`, width:`${v.setsPct}%`, transition:'width .8s cubic-bezier(.2,.8,.2,1)', position:'relative', overflow:'hidden' }}>
                      <div style={{ position:'absolute', inset:0, background:'linear-gradient(90deg, transparent, rgba(255,255,255,.5), transparent)', animation:'sra-shimmer 2.4s linear infinite' }}/>
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8 }}>
                    <div style={{ fontSize:10, color:'#bdb5a6' }}>{PB_SETS_PER_COLOR} sets available in this color</div>
                  </div>
                  <div style={{ marginTop:12, padding:'10px 12px', borderRadius:12, background: v.action.ready ? 'var(--accent-tint)' : '#f7f3ec', border:`1px solid ${v.action.ready ? 'var(--accent-border)' : '#f0e9dc'}`, display:'flex', alignItems:'center', gap:8 }}>
                    {v.action.ready
                      ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-dark)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>
                      : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8a8175" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></svg>}
                    <div style={{ fontSize:11, fontWeight:600, color: v.action.ready ? 'var(--accent-dark)' : '#8a7d6e' }}>{v.action.label}</div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:14 }}>
                    <div style={{ fontSize:11, color:'#8a8175' }}>Up next</div>
                    <div style={{ width:12, height:12, borderRadius:4, background:v.nextTarget.hex }}/>
                    <div style={{ fontSize:11, fontWeight:600 }}>{v.nextTarget.name}</div>
                    <div style={{ flex:1 }}/>
                    <div style={{ fontSize:11, color:'#8a8175', fontVariantNumeric:'tabular-nums' }}>{v.setsRemaining} {v.setsRemaining === 1 ? 'set' : 'sets'} to go</div>
                  </div>
                </div>
              </div>

              <div style={{ margin:'18px 20px 0', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                <div style={{ background:'#fff', border:'1px solid #ece6db', borderRadius:18, padding:'14px 12px' }}>
                  <div style={{ fontSize:10, letterSpacing:.5, textTransform:'uppercase', color:'#8a8175', fontWeight:500 }}>Power Builders</div>
                  <div style={{ display:'flex', alignItems:'baseline', gap:3, marginTop:6 }}>
                    <div style={{ fontSize:24, fontWeight:700, fontVariantNumeric:'tabular-nums', letterSpacing:'-.5px' }}>{v.weeklyPB}</div>
                    <div style={{ fontSize:11, color:'#8a8175' }}>/wk</div>
                  </div>
                </div>
                <div style={{ background:'#fff', border:'1px solid #ece6db', borderRadius:18, padding:'14px 12px' }}>
                  <div style={{ fontSize:10, letterSpacing:.5, textTransform:'uppercase', color:'#8a8175', fontWeight:500 }}>Understanding</div>
                  <div style={{ display:'flex', alignItems:'baseline', gap:1, marginTop:6 }}>
                    <div style={{ fontSize:24, fontWeight:700, fontVariantNumeric:'tabular-nums', letterSpacing:'-.5px', color:'var(--accent)' }}>{v.avgScore}</div>
                    <div style={{ fontSize:13, color:'var(--accent)', fontWeight:700 }}>/10</div>
                  </div>
                </div>
                <div style={{ background:'#fff', border:'1px solid #ece6db', borderRadius:18, padding:'14px 12px' }}>
                  <div style={{ fontSize:10, letterSpacing:.5, textTransform:'uppercase', color:'#8a8175', fontWeight:500 }}>Speed</div>
                  <div style={{ display:'flex', alignItems:'baseline', gap:2, marginTop:6 }}>
                    <div style={{ fontSize:24, fontWeight:700, fontVariantNumeric:'tabular-nums', letterSpacing:'-.5px' }}>{v.avgRate}</div>
                    <div style={{ fontSize:10, color:'#8a8175' }}>/10</div>
                  </div>
                </div>
              </div>

              <div style={{ margin:'24px 20px 0' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:12, padding:'0 4px' }}>
                  <div style={{ fontSize:11, letterSpacing:1, textTransform:'uppercase', color:'#8a8175', fontWeight:600 }}>Recent reports</div>
                  <div onClick={goStats} style={{ fontSize:11, color:'var(--accent)', fontWeight:500, cursor:'pointer' }}>See all</div>
                </div>
                <div style={{ background:'#fff', border:'1px solid #ece6db', borderRadius:20, overflow:'hidden' }}>
                  {v.recentReports.map((r, i) => (
                    <div key={r.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderBottom: i < v.recentReports.length - 1 ? '1px solid #f4efe6' : 'none' }}>
                      <div style={{ width:36, height:36, borderRadius:10, background:r.color, flexShrink:0, position:'relative' }}>
                        <div style={{ position:'absolute', inset:6, borderRadius:6, background:'linear-gradient(135deg,rgba(255,255,255,.3),transparent 60%)' }}/>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600 }}>{r.kindLabel}</div>
                        <div style={{ fontSize:11, color:'#8a8175', marginTop:2 }}>
                          {r.kind === 'powerbuilder' ? `${r.pbCount} ${r.pbCount === 1 ? 'set' : 'sets'} · ` : ''}{r.score}/10 · {r.passed ? 'passed' : 'not passed'}
                        </div>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:'var(--accent)', fontVariantNumeric:'tabular-nums' }}>+{r.xp}</div>
                        <div style={{ fontSize:10, color:'#bdb5a6' }}>{r.when}</div>
                      </div>
                    </div>
                  ))}
                  {!v.hasReports && (
                    <div onClick={openReport} style={{ padding:'22px 16px', textAlign:'center', cursor:'pointer' }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a' }}>No reports yet</div>
                      <div style={{ fontSize:11, color:'#8a8175', marginTop:3 }}>Log your first Power Builder set to start tracking your progress.</div>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ height:20 }}/>
            </div>
          )}

          {/* GUIDE */}
          {isGuide && (
            <div className="scroll-hide" style={{ position:'absolute', inset:0, paddingTop:54, paddingBottom:96, overflowY:'auto', animation:'sra-fadeIn .3s' }}>
              <div style={{ padding:'8px 24px 14px' }}>
                <div style={{ fontSize:10, letterSpacing:1.4, textTransform:'uppercase', color:'var(--accent)', fontWeight:700 }}>Reading Guide</div>
                <div style={{ fontFamily:"'Instrument Serif',serif", fontSize:34, lineHeight:1.05, marginTop:6, letterSpacing:'-.5px' }}>
                  Read sharper, <em style={{ color:'var(--accent)' }}>climb faster.</em>
                </div>
              </div>

              <div style={{ margin:'0 20px 18px', background:'var(--accent-tint)', border:'1px solid var(--accent-border)', borderRadius:20, padding:'16px 18px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                  <div style={{ fontSize:11, letterSpacing:.6, textTransform:'uppercase', color:'var(--accent-dark)', fontWeight:700 }}>Your reading toolkit</div>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--accent-dark)', fontVariantNumeric:'tabular-nums' }}>{GUIDES.filter(g=>g.done).length}/{GUIDES.length} read</div>
                </div>
                <div style={{ height:7, background:'#fff', borderRadius:999, overflow:'hidden', marginTop:10 }}>
                  <div style={{ height:'100%', width:`${Math.round(GUIDES.filter(g=>g.done).length/GUIDES.length*100)}%`, background:'var(--accent)', borderRadius:999, transition:'width .6s ease' }}/>
                </div>
                <div style={{ fontSize:11, color:'var(--accent-dark)', opacity:.8, marginTop:9, lineHeight:1.4 }}>
                  Finish the set to master comprehension at <strong>{v.cur.name}</strong> ({v.cur.levelCode}).
                </div>
              </div>

              <div onClick={openFeatured} style={{ margin:'0 20px 0', background:'#1a1a1a', color:'#fff', borderRadius:24, padding:22, cursor:'pointer', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:-40, right:-30, width:150, height:150, borderRadius:'50%', background:'radial-gradient(circle,var(--accent),transparent 68%)', opacity:.55 }}/>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:22, height:22, borderRadius:7, background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="#fff"><path d="M12 2l2.9 6.3 6.8.7-5.1 4.6 1.4 6.7L12 17.8 5 21l1.4-6.7L1.3 9.7l6.8-.7z"/></svg>
                  </div>
                  <div style={{ fontSize:10, letterSpacing:1.2, textTransform:'uppercase', color:'var(--accent-light)', fontWeight:700 }}>Method of the week</div>
                </div>
                <div style={{ fontFamily:"'Instrument Serif',serif", fontSize:30, lineHeight:1.08, marginTop:14, position:'relative' }}>{FEATURED.title}</div>
                <div style={{ fontSize:12.5, color:'#cfc8bd', marginTop:10, lineHeight:1.55, maxWidth:'90%', position:'relative' }}>{FEATURED.blurb}</div>
                <div style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop:18, padding:'9px 16px', background:'var(--accent)', borderRadius:999, position:'relative' }}>
                  <div style={{ fontSize:12, color:'#fff', fontWeight:700 }}>Read the method</div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                </div>
              </div>

              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', margin:'26px 24px 12px' }}>
                <div style={{ fontSize:11, letterSpacing:1, textTransform:'uppercase', color:'#8a8175', fontWeight:600 }}>All methods</div>
                <div style={{ fontSize:11, color:'#bdb5a6', fontVariantNumeric:'tabular-nums' }}>{GUIDES.length} guides</div>
              </div>
              <div style={{ margin:'0 20px' }}>
                {GUIDES.map((g, i) => (
                  <div key={i} onClick={openGuide(i)} style={{ display:'flex', alignItems:'center', gap:15, padding:'15px 16px', background:'#fff', border:`1px solid ${g.done ? 'var(--accent-border)' : '#ece6db'}`, borderRadius:18, marginBottom:10, cursor:'pointer', position:'relative', overflow:'hidden' }}>
                    <div style={{ position:'absolute', left:0, top:0, bottom:0, width:4, background: g.done ? 'var(--accent)' : 'transparent' }}/>
                    <div style={{ width:46, height:46, borderRadius:14, background:'var(--accent-tint)', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
                      <div style={{ fontFamily:"'Instrument Serif',serif", fontSize:22, color:'var(--accent-dark)', lineHeight:1 }}>{String(i+1).padStart(2,'0')}</div>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:10, letterSpacing:.6, textTransform:'uppercase', color:'var(--accent)', fontWeight:700 }}>{g.category}</div>
                      <div style={{ fontSize:14, fontWeight:600, marginTop:3, lineHeight:1.25 }}>{g.title}</div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:5 }}>
                        <div style={{ fontSize:11, color:'#8a8175' }}>{g.read} min read</div>
                        {g.done && (
                          <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>
                            <div style={{ fontSize:11, color:'var(--accent)', fontWeight:600 }}>Read</div>
                          </div>
                        )}
                      </div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#cbc3b4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><path d="M9 6l6 6-6 6"/></svg>
                  </div>
                ))}
              </div>
              <div style={{ height:20 }}/>
            </div>
          )}

          {/* LADDER */}
          {isLadder && (
            <div className="scroll-hide" style={{ position:'absolute', inset:0, paddingTop:54, paddingBottom:96, overflowY:'auto', animation:'sra-fadeIn .3s' }}>
              <div style={{ padding:'8px 24px 8px' }}>
                <div style={{ fontSize:10, letterSpacing:1.4, textTransform:'uppercase', color:'#8a8175', fontWeight:600 }}>The Climb</div>
                <div style={{ fontFamily:"'Instrument Serif',serif", fontSize:34, lineHeight:1.05, marginTop:6, letterSpacing:'-.5px' }}>
                  {LEVELS.length} levels. <em style={{ color:'var(--accent)' }}>Every color.</em>
                </div>
                <div style={{ fontSize:12, color:'#8a8175', marginTop:8, lineHeight:1.5 }}>
                  {LEVELS[0].code} to {LEVELS[LAST_LEVEL].code} — you&apos;re on {v.cur.name}, level {v.cur.levelCode}.
                </div>
              </div>

              <div style={{ display:'flex', gap:6, margin:'12px 20px 0', background:'#f0e9dc', borderRadius:14, padding:4 }}>
                <div onClick={() => setLadderTab('climb')} style={{ flex:1, textAlign:'center', padding:9, borderRadius:10, fontSize:12, fontWeight:600, cursor:'pointer', background: ladderTab==='climb'?'#fff':'transparent', color: ladderTab==='climb'?'#1a1a1a':'#8a8175' }}>Color ladder</div>
                <div onClick={() => setLadderTab('ach')} style={{ flex:1, textAlign:'center', padding:9, borderRadius:10, fontSize:12, fontWeight:600, cursor:'pointer', background: ladderTab==='ach'?'#fff':'transparent', color: ladderTab==='ach'?'#1a1a1a':'#8a8175' }}>Achievements</div>
              </div>

              {ladderTab === 'climb' && (
                <>
                  {/* Levels overview */}
                  <div style={{ margin:'16px 20px 0' }}>
                    <div style={{ fontSize:10, letterSpacing:.8, textTransform:'uppercase', color:'#8a8175', fontWeight:600, marginBottom:10, padding:'0 2px' }}>Levels</div>
                    <div className="scroll-hide" style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:4 }}>
                      {v.levels.map((lv, i) => (
                        <div key={i} style={{ flex:'0 0 auto', minWidth:64, textAlign:'center', padding:'12px 12px', borderRadius:16, background:lv.bg, color:lv.textColor, position:'relative', border: lv.current ? '2px solid #1a1a1a' : '2px solid transparent' }}>
                          <div style={{ fontSize:16, fontWeight:700, letterSpacing:.4 }}>{lv.code}</div>
                          <div style={{ fontSize:9, marginTop:3, opacity:.85 }}>{lv.count} colors</div>
                          {lv.done && <div style={{ position:'absolute', top:5, right:5 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={lv.textColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg></div>}
                          {lv.locked && <div style={{ position:'absolute', top:5, right:5 }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#a59c8c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg></div>}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Current level colors */}
                  <div style={{ margin:'20px 20px 0', display:'flex', justifyContent:'space-between', alignItems:'baseline', padding:'0 2px' }}>
                    <div style={{ fontSize:10, letterSpacing:.8, textTransform:'uppercase', color:'#8a8175', fontWeight:600 }}>Level {v.cur.levelCode} colors</div>
                    <div style={{ fontSize:10, color:'#bdb5a6' }}>{v.colorsRemaining} to go</div>
                  </div>
                  <div style={{ margin:'10px 20px 0', background:'#fff', border:'1px solid #ece6db', borderRadius:24, padding:'14px 16px 18px' }}>
                    {v.levelColors.map((lvl, i) => (
                      <div key={i} style={{ display:'flex', alignItems:'stretch', gap:16, minHeight:56, opacity:lvl.opacity }}>
                        <div style={{ position:'relative', width:48, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <div style={{ position:'absolute', top:0, bottom:'50%', left:'50%', width:4, transform:'translateX(-50%)', background:lvl.upColor }}/>
                          <div style={{ position:'absolute', top:'50%', bottom:0, left:'50%', width:4, transform:'translateX(-50%)', background:lvl.downColor }}/>
                          <div style={{ position:'relative', zIndex:1, width:44, height:44, borderRadius:'50%', background:lvl.discBg, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:lvl.discShadow }}>
                            <div style={{ position:'absolute', inset:6, borderRadius:'50%', background:'linear-gradient(135deg,rgba(255,255,255,.35),transparent 55%)' }}/>
                            {lvl.done && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ position:'relative', zIndex:2 }}><path d="M5 13l4 4L19 7"/></svg>}
                            {lvl.current && <div style={{ position:'absolute', inset:-5, borderRadius:'50%', border:`3px solid ${lvl.hex}`, opacity:.45, animation:'sra-pulse 2s ease-in-out infinite' }}/>}
                            {lvl.locked && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a59c8c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position:'relative', zIndex:2 }}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>}
                          </div>
                        </div>
                        <div style={{ flex:1, minWidth:0, display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:`1px solid ${lvl.sep}`, padding:'8px 0' }}>
                          <div>
                            <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                              <div style={{ fontSize:10, color:'#bdb5a6', fontVariantNumeric:'tabular-nums', fontWeight:600 }}>{lvl.numStr}</div>
                              <div style={{ fontFamily:"'Instrument Serif',serif", fontSize:22, lineHeight:1, color:lvl.textColor }}>{lvl.name}</div>
                            </div>
                          </div>
                          <div style={{ textAlign:'right', flexShrink:0 }}>
                            <div style={{ fontSize:10, color:lvl.statusColor, letterSpacing:.5, textTransform:'uppercase', fontWeight:600 }}>{lvl.statusLabel}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {ladderTab === 'ach' && (
                <div style={{ margin:'16px 20px 0', animation:'sra-fadeIn .3s' }}>
                  <div style={{ display:'flex', gap:10, marginBottom:14 }}>
                    <div style={{ flex:1, background:'#1a1a1a', color:'#fff', borderRadius:18, padding:16 }}>
                      <div style={{ fontSize:28, fontWeight:700, fontVariantNumeric:'tabular-nums', letterSpacing:'-1px' }}>{v.earnedCount}<span style={{ fontSize:15, color:'#8a8175' }}>/{v.achTotal}</span></div>
                      <div style={{ fontSize:11, color:'#bdb5a6', marginTop:2 }}>Achievements earned</div>
                    </div>
                    <div style={{ flex:1, background:'#fff', border:'1px solid #ece6db', borderRadius:18, padding:16 }}>
                      <div style={{ fontSize:28, fontWeight:700, fontVariantNumeric:'tabular-nums', letterSpacing:'-1px', color:'var(--accent)' }}>{v.totalBadgeXp}</div>
                      <div style={{ fontSize:11, color:'#8a8175', marginTop:2 }}>Bonus XP from badges</div>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    {v.achievements.map((a, i) => (
                      <div key={i} style={{ background:'#fff', border:'1px solid #ece6db', borderRadius:18, padding:16, textAlign:'center', position:'relative', opacity:a.opacity }}>
                        {a.earned && <div style={{ position:'absolute', top:10, right:10, fontSize:9, letterSpacing:.4, textTransform:'uppercase', fontWeight:700, color:a.color }}>+{a.xp}</div>}
                        <div style={{ width:56, height:56, borderRadius:'50%', margin:'0 auto', background:a.badgeBg, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:a.badgeShadow }}>
                          {a.earned && <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff"><path d="M12 2l2.9 6.3 6.8.7-5.1 4.6 1.4 6.7L12 17.8 5 21l1.4-6.7L1.3 9.7l6.8-.7z"/></svg>}
                          {a.locked && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#b3aa99" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>}
                        </div>
                        <div style={{ fontSize:13, fontWeight:700, marginTop:12, color:a.nameColor }}>{a.name}</div>
                        <div style={{ fontSize:11, color:'#8a8175', marginTop:4, lineHeight:1.4 }}>{a.desc}</div>
                        {a.showProgress && (
                          <div style={{ marginTop:10 }}>
                            <div style={{ height:5, background:'#f0e9dc', borderRadius:999, overflow:'hidden' }}>
                              <div style={{ height:'100%', width:`${a.progPct}%`, background:'var(--accent)', borderRadius:999 }}/>
                            </div>
                            <div style={{ fontSize:10, color:'#bdb5a6', marginTop:5, fontVariantNumeric:'tabular-nums' }}>{a.progLabel}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ height:20 }}/>
            </div>
          )}

          {/* STATS */}
          {isStats && (
            <div className="scroll-hide" style={{ position:'absolute', inset:0, paddingTop:54, paddingBottom:96, overflowY:'auto', animation:'sra-fadeIn .3s' }}>
              <div style={{ padding:'8px 24px 12px' }}>
                <div style={{ fontSize:10, letterSpacing:1.4, textTransform:'uppercase', color:'#8a8175', fontWeight:600 }}>Progress</div>
                <div style={{ fontFamily:"'Instrument Serif',serif", fontSize:34, lineHeight:1.05, marginTop:6, letterSpacing:'-.5px' }}>Your reports</div>
              </div>

              <div style={{ margin:'8px 20px 0', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                <div style={{ background:'#fff', border:'1px solid #ece6db', borderRadius:18, padding:'14px 12px' }}>
                  <div style={{ fontSize:23, fontWeight:700, fontVariantNumeric:'tabular-nums', letterSpacing:'-.5px' }}>{v.lifetimePB}</div>
                  <div style={{ fontSize:10, color:'#8a8175', marginTop:2 }}>Power Builders</div>
                </div>
                <div style={{ background:'#fff', border:'1px solid #ece6db', borderRadius:18, padding:'14px 12px' }}>
                  <div style={{ fontSize:23, fontWeight:700, fontVariantNumeric:'tabular-nums', letterSpacing:'-.5px', color:'var(--accent)' }}>{v.avgScore}/10</div>
                  <div style={{ fontSize:10, color:'#8a8175', marginTop:2 }}>Avg understanding</div>
                </div>
                <div style={{ background:'#fff', border:'1px solid #ece6db', borderRadius:18, padding:'14px 12px' }}>
                  <div style={{ fontSize:23, fontWeight:700, fontVariantNumeric:'tabular-nums', letterSpacing:'-.5px' }}>{v.clearedColors}</div>
                  <div style={{ fontSize:10, color:'#8a8175', marginTop:2 }}>Colors cleared</div>
                </div>
              </div>

              <div style={{ margin:'20px 20px 0', background:'#fff', border:'1px solid #ece6db', borderRadius:20, padding:18 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:16 }}>
                  <div style={{ fontSize:11, letterSpacing:.8, textTransform:'uppercase', color:'#8a8175', fontWeight:600 }}>Understanding trend</div>
                  <div style={{ fontSize:11, color:'var(--accent)', fontWeight:600 }}>{v.trendDelta}</div>
                </div>
                {v.hasReports ? (
                  <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:8, height:96 }}>
                    {v.trend.map((t, i) => (
                      <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6, height:'100%', justifyContent:'flex-end' }}>
                        <div style={{ fontSize:9, fontWeight:600, color:'#1a1a1a', fontVariantNumeric:'tabular-nums' }}>{t.score}</div>
                        <div style={{ width:'100%', maxWidth:26, height:t.h, background:`linear-gradient(180deg,${t.hex},${t.hex2})`, borderRadius:7 }}/>
                        <div style={{ fontSize:9, color:'#bdb5a6' }}>{t.label}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ height:96, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'#8a8175', textAlign:'center' }}>
                    Log reports to see your understanding trend.
                  </div>
                )}
              </div>

              <div style={{ margin:'24px 20px 0' }}>
                <div style={{ fontSize:11, letterSpacing:1, textTransform:'uppercase', color:'#8a8175', fontWeight:600, padding:'0 4px 12px' }}>All progress reports</div>
                <div style={{ background:'#fff', border:'1px solid #ece6db', borderRadius:20, overflow:'hidden' }}>
                  {v.allReports.map((r, i) => (
                    <div key={r.id} style={{ padding:'14px 16px', borderBottom: i < v.allReports.length - 1 ? '1px solid #f4efe6' : 'none' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <div style={{ width:34, height:34, borderRadius:10, background:r.color, flexShrink:0, position:'relative' }}>
                          <div style={{ position:'absolute', inset:5, borderRadius:6, background:'linear-gradient(135deg,rgba(255,255,255,.3),transparent 60%)' }}/>
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                            <div style={{ fontSize:13, fontWeight:600 }}>{r.kindLabel}</div>
                            <div style={{ fontSize:9, letterSpacing:.4, textTransform:'uppercase', fontWeight:600, color:r.color, background:r.tint, padding:'2px 6px', borderRadius:6 }}>{r.colorName}</div>
                          </div>
                          <div style={{ fontSize:11, color:'#8a8175', marginTop:3 }}>
                            {r.kind === 'powerbuilder' ? `${r.pbCount} ${r.pbCount === 1 ? 'set' : 'sets'} · ` : ''}speed {r.rate}/10 · {r.passed ? 'passed' : 'not passed'}
                          </div>
                        </div>
                        <div style={{ textAlign:'right', flexShrink:0 }}>
                          <div style={{ fontSize:15, fontWeight:700, color:'var(--accent)', fontVariantNumeric:'tabular-nums' }}>{r.score}/10</div>
                          <div style={{ fontSize:10, color:'#bdb5a6' }}>{r.when}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!v.hasReports && (
                    <div style={{ padding:'22px 16px', textAlign:'center', fontSize:12, color:'#8a8175' }}>
                      No reports logged yet.
                    </div>
                  )}
                </div>
              </div>
              <div style={{ height:20 }}/>
            </div>
          )}

          {/* NOTIFICATIONS */}
          {isNotifs && (
            <div className="scroll-hide" style={{ position:'absolute', inset:0, paddingTop:54, paddingBottom:40, overflowY:'auto', animation:'sra-fadeIn .3s', background:'#faf7f2' }}>
              <div style={{ display:'flex', alignItems:'center', gap:14, padding:'8px 20px 18px' }}>
                <div onClick={goHome} style={{ width:38, height:38, borderRadius:'50%', background:'#fff', border:'1px solid #ece6db', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
                </div>
                <div style={{ fontFamily:"'Instrument Serif',serif", fontSize:28, letterSpacing:'-.4px' }}>Notifications</div>
              </div>
              <div style={{ margin:'0 20px' }}>
                {v.notifications.map(n => (
                  <div key={n.id} style={{ display:'flex', gap:13, padding:16, background:n.bg, border:`1px solid ${n.border}`, borderRadius:18, marginBottom:10, position:'relative' }}>
                    <div style={{ width:40, height:40, borderRadius:12, background:n.iconBg, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <NotifIcon type={n.type} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                        <div style={{ fontSize:13, fontWeight:600 }}>{n.title}</div>
                        {n.unread && <div style={{ width:7, height:7, borderRadius:'50%', background:'var(--accent)' }}/>}
                      </div>
                      <div style={{ fontSize:12, color:'#7a7163', marginTop:3, lineHeight:1.45 }}>{n.body}</div>
                      <div style={{ fontSize:10, color:'#bdb5a6', marginTop:6 }}>{n.when}</div>
                    </div>
                  </div>
                ))}
                {v.notifications.length === 0 && (
                  <div style={{ textAlign:'center', color:'#8a8175', fontSize:13, padding:'48px 20px', lineHeight:1.6 }}>
                    You&apos;re all caught up.<br />New notifications will show up here.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* BOTTOM NAV */}
          {showNav && (
            <div style={{ position:'absolute', left:0, right:0, bottom:0, padding:'8px 14px 24px', background:'linear-gradient(180deg, rgba(250,247,242,0), rgba(250,247,242,1) 30%)', pointerEvents:'none', zIndex:50 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-around', background:'#fff', border:'1px solid #ece6db', borderRadius:28, padding:'8px 4px', boxShadow:'0 6px 24px rgba(0,0,0,.06)', pointerEvents:'auto', height:60 }}>
                {navItem('HOME', isHome, goHome, <><path d="M3 12L12 4l9 8"/><path d="M5 10v10h14V10"/></>)}
                {navItem('GUIDE', isGuide, goGuide, <><path d="M4 5h7v15H4z"/><path d="M13 5h7v15h-7z"/></>)}
                <div onClick={openReport} style={{ flex:'0 0 56px', display:'flex', flexDirection:'column', alignItems:'center', cursor:'pointer', transform:'translateY(-12px)' }}>
                  <div style={{ width:54, height:54, borderRadius:18, background:`linear-gradient(135deg,var(--accent),var(--accent-dark))`, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 8px 22px var(--accent-shadow)' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6a1 1 0 011 1v1h1a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h1V4a1 1 0 011-1z"/><path d="M9 12l2 2 4-4"/></svg>
                  </div>
                </div>
                {navItem('LADDER', isLadder, goLadder, <><path d="M7 3v18"/><path d="M17 3v18"/><path d="M7 7h10"/><path d="M7 12h10"/><path d="M7 17h10"/></>)}
                {navItem('STATS', isStats, goStats, <><path d="M3 20h18"/><rect x="5" y="12" width="3" height="8"/><rect x="10.5" y="7" width="3" height="13"/><rect x="16" y="14" width="3" height="6"/></>)}
              </div>
            </div>
          )}

          {/* GUIDE READER SHEET */}
          {guideOpen && (
            <>
              <div onClick={closeGuide} style={{ position:'absolute', inset:0, background:'rgba(20,15,10,.4)', zIndex:90, animation:'sra-fadeIn .25s', backdropFilter:'blur(2px)' }}/>
              <div className="scroll-hide" style={{ position:'absolute', left:0, right:0, bottom:0, top:60, zIndex:100, background:'#faf7f2', borderRadius:'28px 28px 0 0', animation:'sra-slideUp .35s cubic-bezier(.2,.8,.2,1)', boxShadow:'0 -12px 40px rgba(0,0,0,.18)', overflowY:'auto' }}>
                <div style={{ position:'sticky', top:0, background:'#faf7f2', padding:'14px 20px 10px', zIndex:2 }}>
                  <div style={{ display:'flex', justifyContent:'center' }}><div style={{ width:40, height:4, borderRadius:2, background:'#e0d8c8' }}/></div>
                  <div style={{ display:'flex', justifyContent:'flex-end', marginTop:-2 }}>
                    <div onClick={closeGuide} style={{ width:32, height:32, borderRadius:'50%', background:'#ece6db', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M6 18L18 6"/></svg>
                    </div>
                  </div>
                </div>
                <div style={{ padding:'4px 26px 40px' }}>
                  <div style={{ fontSize:10, letterSpacing:.8, textTransform:'uppercase', color:'var(--accent)', fontWeight:700 }}>{activeGuide.category} · {activeGuide.read} min</div>
                  <div style={{ fontFamily:"'Instrument Serif',serif", fontSize:32, lineHeight:1.1, marginTop:8, letterSpacing:'-.5px' }}>{activeGuide.title}</div>
                  <div style={{ fontSize:15, color:'#4a443c', lineHeight:1.7, marginTop:18, whiteSpace:'pre-line' }}>{activeGuide.body}</div>
                </div>
              </div>
            </>
          )}

          {/* REPORT SHEET */}
          {reportOpen && (
            <>
              <div onClick={closeReport} style={{ position:'absolute', inset:0, background:'rgba(20,15,10,.4)', zIndex:90, animation:'sra-fadeIn .25s', backdropFilter:'blur(2px)' }}/>
              <div className="scroll-hide" style={{ position:'absolute', left:0, right:0, bottom:0, zIndex:100, background:'#faf7f2', borderRadius:'28px 28px 0 0', padding:'14px 0 28px', animation:'sra-slideUp .35s cubic-bezier(.2,.8,.2,1)', boxShadow:'0 -12px 40px rgba(0,0,0,.18)', maxHeight:'92%', overflowY:'auto' }}>
                <div style={{ display:'flex', justifyContent:'center' }}><div style={{ width:40, height:4, borderRadius:2, background:'#e0d8c8' }}/></div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 24px 6px' }}>
                  <div>
                    <div style={{ fontSize:10, letterSpacing:1, textTransform:'uppercase', color:'#8a8175', fontWeight:600 }}>Progress report · Step {reportStep} of 3</div>
                    <div style={{ fontFamily:"'Instrument Serif',serif", fontSize:26, lineHeight:1.1, marginTop:2, letterSpacing:'-.3px' }}>
                      {reportStep === 1 ? 'What did you do?' : reportStep === 2 ? 'The numbers' : 'Confirm'}
                    </div>
                  </div>
                  <div onClick={closeReport} style={{ width:32, height:32, borderRadius:'50%', background:'#ece6db', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M6 18L18 6"/></svg>
                  </div>
                </div>
                <div style={{ display:'flex', gap:6, padding:'14px 24px 4px' }}>
                  <div style={{ flex:1, height:3, borderRadius:2, background: reportStep>=1?'#c8643d':'#ece6db' }}/>
                  <div style={{ flex:1, height:3, borderRadius:2, background: reportStep>=2?'#c8643d':'#ece6db' }}/>
                  <div style={{ flex:1, height:3, borderRadius:2, background: reportStep>=3?'#c8643d':'#ece6db' }}/>
                </div>

                {reportStep === 1 && (
                  <div style={{ padding:'18px 20px 8px', animation:'sra-fadeIn .3s' }}>
                    <div style={{ fontSize:12, color:'#8a8175', marginBottom:12, lineHeight:1.5 }}>
                      Logging for <strong style={{ color:'#1a1a1a' }}>{v.cur.name}</strong> ({v.cur.levelCode}) · {pbPassed}/{PB_SETS_TO_PASS} passing sets done.
                    </div>
                    {kindOptions.map(k => {
                      const selected = reportKind === k.key;
                      const fits = kindFits[k.key];
                      return (
                        <div key={k.key} onClick={() => setReportKind(k.key)} style={{ display:'flex', alignItems:'center', gap:14, padding:'16px 16px', background:'#fff', borderRadius:18, marginBottom:10, border:`2px solid ${selected ? '#c8643d' : 'transparent'}`, cursor:'pointer' }}>
                          <div style={{ width:44, height:44, borderRadius:13, background: selected ? 'var(--accent-tint)' : '#f4efe6', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                            {k.key === 'powerbuilder'
                              ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={selected ? 'var(--accent)' : '#8a8175'} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h7v15H4z"/><path d="M13 5h7v15h-7z"/></svg>
                              : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={selected ? 'var(--accent)' : '#8a8175'} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                              <div style={{ fontSize:15, fontWeight:600 }}>{k.label}</div>
                              {fits && <div style={{ fontSize:8, letterSpacing:.4, textTransform:'uppercase', fontWeight:700, color:'var(--accent-dark)', background:'var(--accent-tint)', padding:'2px 5px', borderRadius:5 }}>Suggested</div>}
                            </div>
                            <div style={{ fontSize:12, color:'#8a8175', marginTop:2 }}>{k.sub}</div>
                          </div>
                          {selected && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>}
                        </div>
                      );
                    })}
                    <div style={{ fontSize:11, letterSpacing:.8, textTransform:'uppercase', color:'#8a8175', fontWeight:600, margin:'14px 0 10px' }}>Reporting period</div>
                    <div style={{ display:'flex', gap:8 }}>
                      {['daily','weekly','monthly'].map(p => {
                        const sel = reportPeriod === p;
                        return (
                          <div key={p} onClick={() => setReportPeriod(p)} style={{ flex:1, textAlign:'center', padding:'10px 0', borderRadius:12, fontSize:12, fontWeight:600, cursor:'pointer', background: sel ? 'var(--accent)' : '#fff', color: sel ? '#fff' : '#8a8175', border:`1px solid ${sel ? 'var(--accent)' : '#ece6db'}` }}>{periodLabel(p)}</div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {reportStep === 2 && (
                  <div style={{ padding:'18px 24px 8px', animation:'sra-fadeIn .3s' }}>
                    {reportKind === 'powerbuilder' && (
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#fff', border:'1px solid #ece6db', borderRadius:16, padding:'14px 16px' }}>
                        <div>
                          <div style={{ fontSize:13, fontWeight:600 }}>Power Builder sets</div>
                          <div style={{ fontSize:11, color:'#8a8175', marginTop:2 }}>Sets completed in this report</div>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                          <div onClick={() => setReportPB(p => Math.max(1, p-1))} style={{ width:32, height:32, borderRadius:'50%', background:'#f0e9dc', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:20, fontWeight:600, color:'#1a1a1a' }}>−</div>
                          <div style={{ fontSize:22, fontWeight:700, fontVariantNumeric:'tabular-nums', minWidth:26, textAlign:'center' }}>{reportPB}</div>
                          <div onClick={() => setReportPB(p => Math.min(PB_SETS_PER_COLOR, p+1))} style={{ width:32, height:32, borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:20, fontWeight:600, color:'#fff' }}>+</div>
                        </div>
                      </div>
                    )}

                    {reportKind !== 'powerbuilder' && (
                      <div style={{ background:'var(--accent-tint)', border:'1px solid var(--accent-border)', borderRadius:16, padding:'14px 16px' }}>
                        <div style={{ fontSize:13, fontWeight:600, color:'var(--accent-dark)' }}>
                          {reportKind === 'exit_test' ? 'Exit color test' : 'Level test'}
                        </div>
                        <div style={{ fontSize:11, color:'var(--accent-dark)', opacity:.85, marginTop:3, lineHeight:1.5 }}>
                          {pbPassed >= PB_SETS_TO_PASS
                            ? `You've done your ${PB_SETS_TO_PASS} passing sets — a passing score here advances you.`
                            : `You still need ${PB_SETS_TO_PASS - pbPassed} more passing set${PB_SETS_TO_PASS - pbPassed === 1 ? '' : 's'} before this counts.`}
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop:24 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', lineHeight:1.4 }}>
                        {reportKind === 'powerbuilder' ? 'How well did you understand the sets?' : 'What was your test score?'}
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginTop:10 }}>
                        <div style={{ fontSize:10, color:'#bdb5a6' }}>Barely</div>
                        <div style={{ fontSize:20, fontWeight:700, fontVariantNumeric:'tabular-nums', color:'var(--accent)' }}>
                          {reportScore}<span style={{ fontSize:12, color:'#8a8175', fontWeight:500 }}>/10</span>
                          <span style={{ fontSize:10, marginLeft:8, fontWeight:700, color: reportScore >= PASS_SCORE ? '#3a6f3a' : '#a63b25' }}>{reportScore >= PASS_SCORE ? 'PASS' : 'BELOW'}</span>
                        </div>
                        <div style={{ fontSize:10, color:'#bdb5a6' }}>Fully</div>
                      </div>
                      <input type="range" min="1" max="10" step="1" value={reportScore} onChange={e => setReportScore(parseInt(e.target.value,10))} style={{ width:'100%', marginTop:6 }}/>
                    </div>

                    <div style={{ marginTop:24 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', lineHeight:1.4 }}>How fast could you read and answer?</div>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginTop:10 }}>
                        <div style={{ fontSize:10, color:'#bdb5a6' }}>Slow</div>
                        <div style={{ fontSize:20, fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{reportRate}<span style={{ fontSize:12, color:'#8a8175', fontWeight:500 }}>/10</span></div>
                        <div style={{ fontSize:10, color:'#bdb5a6' }}>Fast</div>
                      </div>
                      <input type="range" min="1" max="10" step="1" value={reportRate} onChange={e => setReportRate(parseInt(e.target.value,10))} style={{ width:'100%', marginTop:6 }}/>
                    </div>

                    {reportKind === 'level_test' && v.nextLevelColors.length > 0 && (
                      <>
                        <div style={{ fontSize:11, letterSpacing:.8, textTransform:'uppercase', color:'#8a8175', fontWeight:600, marginTop:22, marginBottom:6 }}>Placed at ({LEVELS[levelIdx + 1].code})</div>
                        <div style={{ fontSize:11, color:'#8a8175', marginBottom:10, lineHeight:1.5 }}>The level test decides which color you start on in the next level. Record where you were placed.</div>
                        <div className="scroll-hide" style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:4 }}>
                          {v.nextLevelColors.map((key, i) => {
                            const selected = reportPlacementIdx === i;
                            const hex = colorHex(key);
                            return (
                              <div key={key} onClick={() => setReportPlacementIdx(i)} style={{ flex:'0 0 auto', textAlign:'center', cursor:'pointer' }}>
                                <div style={{ width:46, height:46, borderRadius:14, background:hex, border:`3px solid ${selected ? '#1a1a1a' : 'transparent'}`, position:'relative' }}>
                                  <div style={{ position:'absolute', inset:5, borderRadius:9, background:'linear-gradient(135deg,rgba(255,255,255,.35),transparent 55%)' }}/>
                                </div>
                                <div style={{ fontSize:10, marginTop:5, color:selected?'#1a1a1a':'#8a8175', fontWeight: selected?700:500 }}>{colorName(key)}</div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {reportStep === 3 && (
                  <div style={{ padding:'18px 24px 8px', animation:'sra-fadeIn .3s' }}>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ width:72, height:72, borderRadius:22, background:v.cur.hex, margin:'0 auto', position:'relative', boxShadow:`0 12px 30px ${shadow(v.cur.hex)}`, animation:'sra-pop .5s cubic-bezier(.2,1.4,.5,1)' }}>
                        <div style={{ position:'absolute', inset:9, borderRadius:13, background:'linear-gradient(135deg,rgba(255,255,255,.35),transparent 50%)' }}/>
                      </div>
                      <div style={{ fontFamily:"'Instrument Serif',serif", fontSize:28, lineHeight:1.1, marginTop:16, letterSpacing:'-.4px' }}>Submit {KIND_LABEL[reportKind].toLowerCase()}?</div>
                    </div>
                    <div style={{ marginTop:20, padding:18, background:'#fff', border:'1px solid #ece6db', borderRadius:18 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 0' }}><div style={{ fontSize:12, color:'#8a8175' }}>Activity</div><div style={{ fontSize:13, fontWeight:600 }}>{KIND_LABEL[reportKind]}</div></div>
                      <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderTop:'1px solid #f4efe6' }}><div style={{ fontSize:12, color:'#8a8175' }}>Color</div><div style={{ fontSize:13, fontWeight:600 }}>{v.cur.name} · {v.cur.levelCode}</div></div>
                      {reportKind === 'powerbuilder' && (
                        <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderTop:'1px solid #f4efe6' }}><div style={{ fontSize:12, color:'#8a8175' }}>Sets</div><div style={{ fontSize:13, fontWeight:600, fontVariantNumeric:'tabular-nums' }}>{reportPB}</div></div>
                      )}
                      <div style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderTop:'1px solid #f4efe6', borderBottom:'1px solid #f4efe6', margin:'4px 0' }}><div style={{ fontSize:12, color:'#8a8175' }}>Understanding</div><div style={{ fontSize:13, fontWeight:600, color: reportScore >= PASS_SCORE ? '#3a6f3a' : '#a63b25' }}>{reportScore}/10 · {reportScore >= PASS_SCORE ? 'pass' : 'below'}</div></div>
                      <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 0' }}><div style={{ fontSize:12, color:'#8a8175' }}>Speed</div><div style={{ fontSize:13, fontWeight:600 }}>{reportRate}/10</div></div>
                      {reportKind === 'level_test' && v.nextLevelColors.length > 0 && (
                        <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderTop:'1px solid #f4efe6' }}><div style={{ fontSize:12, color:'#8a8175' }}>Placement</div><div style={{ fontSize:13, fontWeight:600 }}>{colorName(v.nextLevelColors[reportPlacementIdx])} · {LEVELS[levelIdx+1].code}</div></div>
                      )}
                      <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0 4px', marginTop:6, borderTop:'1px solid #f4efe6' }}><div style={{ fontSize:12, color:'#8a8175' }}>XP reward</div><div style={{ fontSize:15, fontWeight:700, color:'var(--accent)', fontVariantNumeric:'tabular-nums' }}>+{v.reportXp}</div></div>
                    </div>
                    <div style={{ marginTop:14, padding:'14px 16px', background:'#1a1a1a', color:'#fff', borderRadius:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ fontSize:12, color:'#bdb5a6' }}>After this report</div>
                      <div style={{ fontSize:14, fontWeight:600 }}>
                        {v.projected.leveledUp
                          ? `Level up → ${v.projectedStep.levelCode} · ${v.projectedStep.name}`
                          : v.projected.colorAdvanced
                            ? `Advance → ${v.projectedStep.name}`
                            : `${v.projected.pbPassed}/${PB_SETS_TO_PASS} sets in ${v.cur.name}`}
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ padding:'20px 20px 0', display:'flex', gap:10 }}>
                  {reportStep > 1 && (
                    <div onClick={rPrevStep} style={{ flex:'0 0 auto', padding:'14px 22px', background:'#ece6db', color:'#1a1a1a', borderRadius:16, fontSize:14, fontWeight:600, cursor:'pointer' }}>Back</div>
                  )}
                  <div onClick={rNextStep} style={{ flex:1, padding:14, background:'#1a1a1a', color:'#fff', borderRadius:16, textAlign:'center', fontSize:14, fontWeight:600, cursor:'pointer' }}>
                    {reportStep === 1 ? 'Continue' : reportStep === 2 ? 'Review' : 'Submit report  →'}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* LEVEL / COLOR UP OVERLAY */}
          {levelUpShown && (
            <div style={{ position:'absolute', inset:0, zIndex:200, background:`linear-gradient(180deg, ${v.cur.hex}, ${darken(v.cur.hex, 55)})`, animation:'sra-fadeIn .4s', overflow:'hidden' }}>
              <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
                {confetti.map((p, i) => (
                  <div key={i} style={{ position:'absolute', top:'30%', left:`${p.left}%`, width:8, height:14, background:p.color, borderRadius:2, animation:`sra-confetti ${p.dur}s ease-out forwards`, animationDelay:`${p.delay}s`, '--dx':`${p.dx}px` }}/>
                ))}
              </div>
              <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:40, textAlign:'center', color:'#fff' }}>
                <div style={{ fontSize:11, letterSpacing:2.5, textTransform:'uppercase', fontWeight:700, opacity:.85, animation:'sra-rise .5s .1s both' }}>{levelUpKind === 'level' ? 'Level up' : 'New color'}</div>
                <div style={{ margin:'30px 0', position:'relative', animation:'sra-pop .8s .2s cubic-bezier(.2,1.4,.5,1) both' }}>
                  <div style={{ width:140, height:140, borderRadius:40, background:'#fff', boxShadow:'0 24px 60px rgba(0,0,0,.25)', position:'relative' }}>
                    <div style={{ position:'absolute', inset:14, borderRadius:28, background:v.cur.hex }}>
                      <div style={{ position:'absolute', inset:10, borderRadius:20, background:'linear-gradient(135deg,rgba(255,255,255,.4),transparent 55%)' }}/>
                    </div>
                  </div>
                  <div style={{ position:'absolute', inset:-14, borderRadius:54, border:'3px solid rgba(255,255,255,.4)', animation:'sra-pulse 2s ease-in-out infinite' }}/>
                </div>
                <div style={{ fontFamily:"'Instrument Serif',serif", fontSize:64, lineHeight:1, letterSpacing:'-1px', animation:'sra-rise .5s .35s both' }}>{v.cur.name}</div>
                <div style={{ fontSize:13, opacity:.85, marginTop:14, maxWidth:280, lineHeight:1.5, animation:'sra-rise .5s .5s both' }}>
                  {levelUpKind === 'level'
                    ? <>You passed the level test and reached <strong>{v.cur.levelCode}</strong>, starting on <strong>{v.cur.name}</strong>. {v.levelsRemaining === 0 ? "You're at the top level!" : `${v.levelsRemaining} ${v.levelsRemaining === 1 ? 'level' : 'levels'} to ${LEVELS[LAST_LEVEL].code}.`}</>
                    : <>You cleared the exit test and moved on to <strong>{v.cur.name}</strong> in level <strong>{v.cur.levelCode}</strong>. {v.colorsRemaining} more {v.colorsRemaining === 1 ? 'color' : 'colors'} in this level.</>}
                </div>
                <div onClick={() => setLevelUpShown(false)} style={{ marginTop:40, padding:'16px 36px', background:'#fff', color:'#1a1a1a', borderRadius:999, fontSize:14, fontWeight:600, cursor:'pointer', animation:'sra-rise .5s .7s both', boxShadow:'0 8px 24px rgba(0,0,0,.18)' }}>
                  Keep climbing
                </div>
              </div>
            </div>
          )}

        </div>
      </IOSDevice>
    </div>
  );
}
