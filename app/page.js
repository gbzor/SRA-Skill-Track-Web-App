'use client';

import { useEffect, useMemo, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import IOSDevice from './IOSDevice';

const LADDER = [
  { code:'1C', name:'Rose',   hex:'#c96d8a' },
  { code:'1B', name:'Red',    hex:'#c95c5c' },
  { code:'1A', name:'Orange', hex:'#db8447' },
  { code:'2C', name:'Gold',   hex:'#d9b850' },
  { code:'2B', name:'Green',  hex:'#6fac6f' },
  { code:'2A', name:'Olive',  hex:'#7d8a45' },
  { code:'3C', name:'Aqua',   hex:'#4fa8a8' },
  { code:'3B', name:'Blue',   hex:'#5c89c9' },
  { code:'3A', name:'Purple', hex:'#8c5ca8' },
];

const GUIDES = [
  { category:'Method', title:'Using Power Builders the right way', read:4, done:true,
    body:"A Power Builder is more than a quiz — it's a feedback loop. Work it in three passes.\n\n1. Survey first. Before reading, skim the title, the bold terms, and the questions at the end. You're priming your brain to hunt for those answers.\n\n2. Read once, fully. Resist the urge to re-read sentences. Trust that the second pass will catch what you missed. Re-reading mid-passage kills your rate without helping comprehension.\n\n3. Answer, then check immediately. The moment between answering and seeing the correct answer is where learning happens. Don't batch your checking — do it card by card.\n\nLog every Power Builder you finish. The number matters less than the consistency: two cards a day beats fourteen on Sunday." },
  { category:'Speed', title:'Reading rate without losing comprehension', read:5, done:true,
    body:"Most readers leave speed on the table because of habits, not ability.\n\nStop subvocalizing every word. You don't need to 'hear' each word to understand it. Practice reading slightly faster than is comfortable for two minutes a day — your comprehension dips at first, then catches up.\n\nUse a visual pacer. Run a finger or pen under the line. It stops your eyes from drifting back and pulls you forward at a steady clip.\n\nWiden your fixations. Instead of one word per glance, aim for three or four. The page has fewer 'stops' and your rate climbs naturally.\n\nTrack WPM in every report. Pair it with comprehension — a faster rate only counts if your score holds above 80%." },
  { category:'Basics', title:'Picking the right color level', read:3,
    body:"The color you work in should be just hard enough to stretch you.\n\nIf you're scoring 95%+ consistently, the level is too easy — move up a color. You're not learning, you're rehearsing.\n\nIf you're below 70%, drop back one color. Frustration teaches nothing.\n\nThe sweet spot is 80–90% comprehension. Hard enough that you have to concentrate, easy enough that you finish. Stay there until two weeks of reports hold above 90%, then climb." },
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

const ACHIEVEMENTS = [
  { name:'First Report',  desc:'Logged your first progress report', color:'#c8643d', earned:true,  xp:20 },
  { name:'Sharp Eye',     desc:'Hit 90%+ comprehension',            color:'#6fac6f', earned:true,  xp:30 },
  { name:'Week Warrior',  desc:'Reached a 7-day streak',            color:'#db8447', earned:true,  xp:40 },
  { name:'Power Surge',   desc:'10 Power Builders in one week',     color:'#8c5ca8', earned:true,  xp:50 },
  { name:'Color Climber', desc:'Cleared 3 SRA levels',              color:'#5c89c9', earned:true,  xp:60 },
  { name:'Speed Reader',  desc:'250+ wpm at 85%+ comp',             color:'#4fa8a8', earned:false, prog:88,  progLabel:'220 / 250 wpm' },
  { name:'Iron Month',    desc:'Reach a 30-day streak',             color:'#c95c5c', earned:false, prog:40,  progLabel:'12 / 30 days' },
  { name:'Top of the Lab',desc:'Reach 3A — the final level',        color:'#8c5ca8', earned:false, prog:67,  progLabel:'2A / 3A · rung 6 / 9' },
];

const INITIAL_REPORTS = [
  { id:1, period:'daily',   pb:2,  score:95, rate:230, colorIdx:5, when:'Yesterday',  xp:38 },
  { id:2, period:'weekly',  pb:8,  score:88, rate:215, colorIdx:5, when:'2d ago',     xp:141 },
  { id:3, period:'daily',   pb:3,  score:82, rate:205, colorIdx:5, when:'4d ago',     xp:49 },
  { id:4, period:'weekly',  pb:7,  score:91, rate:220, colorIdx:4, when:'Last week',  xp:127 },
  { id:5, period:'daily',   pb:2,  score:78, rate:195, colorIdx:4, when:'8d ago',     xp:31 },
  { id:6, period:'monthly', pb:24, score:86, rate:210, colorIdx:3, when:'Last month', xp:413 },
  { id:7, period:'daily',   pb:3,  score:90, rate:200, colorIdx:3, when:'5w ago',     xp:54 },
  { id:8, period:'weekly',  pb:6,  score:84, rate:198, colorIdx:2, when:'6w ago',     xp:101 },
];

const INITIAL_NOTIFS = [
  { id:1, type:'achievement', title:'Achievement unlocked', body:'You earned "Power Surge" — 10 Power Builders in a week.', when:'2h ago', unread:true },
  { id:2, type:'level',       title:'Level up!',            body:'You reached Olive — two-thirds up the ladder.', when:'2d ago', unread:true },
  { id:3, type:'reminder',    title:'Progress report due',  body:"You haven't logged a report in 3 days. Keep your streak alive.", when:'3d ago', unread:false },
  { id:4, type:'guide',       title:'New guide added',      body:'"Reading rate without losing comprehension" is now in your Guide.', when:'4d ago', unread:false },
  { id:5, type:'account',     title:'Weekly summary ready', body:'Your week: 8 Power Builders, 88% average comprehension.', when:'1w ago', unread:false },
];

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

export default function Page() {
  const [screen, setScreen] = useState('home');
  const [ladderTab, setLadderTab] = useState('climb');
  const [streak] = useState(12);
  const [currentRung, setCurrentRung] = useState(6);
  const [xp, setXp] = useState(340);
  const [showReminder, setShowReminder] = useState(true);
  const [reports, setReports] = useState(INITIAL_REPORTS);
  const { data: session } = useSession();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/reports', { credentials: 'same-origin' });
        if (!r.ok) return;
        const j = await r.json();
        if (!alive || !Array.isArray(j.reports) || j.reports.length === 0) return;
        const mapped = j.reports.map((rep, i) => ({
          id: rep.id,
          period: rep.period,
          pb: rep.pb,
          score: rep.score,
          rate: rep.rate,
          colorIdx: rep.colorIdx,
          xp: rep.xp,
          when: relativeWhen(rep.createdAt),
        }));
        setReports(mapped);
      } catch {}
    })();
    return () => { alive = false; };
  }, []);
  const [notifs, setNotifs] = useState(INITIAL_NOTIFS);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportStep, setReportStep] = useState(1);
  const [reportPeriod, setReportPeriod] = useState('weekly');
  const [reportPB, setReportPB] = useState(5);
  const [reportScore, setReportScore] = useState(85);
  const [reportRate, setReportRate] = useState(215);
  const [reportColorIdx, setReportColorIdx] = useState(5);

  const [guideOpen, setGuideOpen] = useState(false);
  const [activeGuideIdx, setActiveGuideIdx] = useState(-1);
  const [levelUpShown, setLevelUpShown] = useState(false);

  const goHome   = () => setScreen('home');
  const goGuide  = () => setScreen('guide');
  const goLadder = () => setScreen('ladder');
  const goStats  = () => setScreen('stats');
  const openNotifs = () => { setScreen('notifs'); setNotifs(n => n.map(x => ({ ...x, unread: false }))); };

  const openFeatured = () => { setGuideOpen(true); setActiveGuideIdx(-2); };
  const openGuide = i => () => { setGuideOpen(true); setActiveGuideIdx(i); };
  const closeGuide = () => setGuideOpen(false);

  const openReport = () => {
    setReportOpen(true); setReportStep(1); setReportPeriod('weekly');
    setReportPB(5); setReportScore(85); setReportRate(215); setReportColorIdx(currentRung - 1);
  };
  const closeReport = () => setReportOpen(false);

  const reportXpVal = () => Math.round(reportPB * (reportScore / 100) * 18);

  const submitReport = async () => {
    const earn = reportXpVal();
    // XP is recomputed server-side; client value is display-only.
    const payload = { period: reportPeriod, pb: reportPB, score: reportScore, rate: reportRate, colorIdx: reportColorIdx };
    let serverId = null;
    let serverXp = null;
    try {
      const r = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });
      if (r.ok) { const j = await r.json(); serverId = j?.report?.id ?? null; serverXp = j?.report?.xp ?? null; }
    } catch {}
    const actualEarn = serverXp ?? earn;
    const rep = { id: serverId ?? `local-${Date.now()}`, period: reportPeriod, pb: reportPB, score: reportScore, rate: reportRate, colorIdx: reportColorIdx, when: 'Just now', xp: actualEarn };
    let newXp = xp + actualEarn;
    let newRung = currentRung;
    let lvlUp = false;
    if (newXp >= 500 && newRung < LADDER.length) { newXp -= 500; newRung += 1; lvlUp = true; }
    setReports(r => [rep, ...r]);
    setXp(newXp);
    setCurrentRung(newRung);
    setReportOpen(false);
    setLevelUpShown(lvlUp);
    setShowReminder(false);
  };

  const rNextStep = () => { if (reportStep < 3) setReportStep(s => s + 1); else submitReport(); };
  const rPrevStep = () => setReportStep(s => Math.max(1, s - 1));

  const v = useMemo(() => {
    const cur = LADDER[currentRung - 1];
    const accent = cur.hex;
    const accentDark = darken(cur.hex, 42);
    const accentLight = mix(cur.hex, 0.32);
    const accentTint = mix(cur.hex, 0.86);
    const accentBorder = mix(cur.hex, 0.66);
    const accentShadow = cur.hex + '73';
    const nIdx = Math.min(currentRung, LADDER.length - 1);
    const nx = LADDER[nIdx];
    const xpPercent = Math.min(100, (xp / 500) * 100);
    const xpRemaining = Math.max(0, 500 - xp);

    const weeklyReports = reports.filter(r => ['Yesterday','2d ago','4d ago','Just now'].includes(r.when) || r.when.includes('h ago'));
    const totalPB = weeklyReports.reduce((a, r) => a + r.pb, 0) || reports[0].pb;
    const scored = reports.slice(0, 6);
    const avgScore = Math.round(scored.reduce((a, r) => a + r.score, 0) / scored.length);
    const avgRate = Math.round(scored.reduce((a, r) => a + r.rate, 0) / scored.length);
    const recentReports = reports.slice(0, 3).map(r => ({ ...r, color: LADDER[r.colorIdx].hex, periodLabel: periodLabel(r.period) }));

    const curIdx = currentRung - 1;
    const trackOn = '#d8b8a0', trackOff = '#f0e9dc';
    const ladder = LADDER.map((l, i) => {
      const num = i + 1, done = i < curIdx, current = i === curIdx, locked = i > curIdx;
      return {
        name: l.name, code: l.code, hex: l.hex,
        numStr: String(num).padStart(2, '0'),
        label: 'Level ' + l.code,
        done, current, locked,
        opacity: locked ? 0.6 : 1,
        textColor: locked ? '#8a8175' : '#1a1a1a',
        discBg: locked ? '#efe9dd' : l.hex,
        discShadow: locked ? 'none' : ('0 4px 14px ' + shadow(l.hex)),
        upColor: i === 0 ? 'transparent' : (i <= curIdx ? trackOn : trackOff),
        downColor: i === LADDER.length - 1 ? 'transparent' : (i < curIdx ? trackOn : trackOff),
        sep: i === LADDER.length - 1 ? 'transparent' : '#f4efe6',
        xpNeeded: (num - currentRung) * 500,
      };
    });
    const rungsRemaining = LADDER.length - currentRung;

    const achievements = ACHIEVEMENTS.map(a => ({
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
    const earnedCount = ACHIEVEMENTS.filter(a => a.earned).length;
    const totalBadgeXp = ACHIEVEMENTS.filter(a => a.earned).reduce((x, a) => x + a.xp, 0);

    const lifetimePB = reports.reduce((a, r) => a + r.pb, 0);
    const trendSrc = reports.slice(0, 6).slice().reverse();
    const trend = trendSrc.map(r => ({
      score: r.score,
      label: periodLabel(r.period).slice(0, 1),
      h: Math.round((r.score / 100) * 84) + 6,
      hex: r.score >= 88 ? 'var(--accent)' : 'var(--accent-light)',
      hex2: r.score >= 88 ? 'var(--accent-dark)' : 'var(--accent)',
    }));
    const trendDelta = '+' + Math.max(0, trendSrc[trendSrc.length - 1].score - trendSrc[0].score) + ' pts';
    const allReports = reports.map(r => ({
      ...r,
      color: LADDER[r.colorIdx].hex,
      tint: tint(LADDER[r.colorIdx].hex),
      colorName: LADDER[r.colorIdx].name + ' · ' + LADDER[r.colorIdx].code,
      periodLabel: periodLabel(r.period) + ' report',
    }));

    const notifications = notifs.map(n => ({
      ...n,
      iconBg: 'var(--accent)',
      bg: n.unread ? '#fff' : '#f7f3ec',
      border: n.unread ? '#ece6db' : '#f0e9dc',
    }));
    const unreadCount = notifs.filter(n => n.unread).length;

    const rc = LADDER[reportColorIdx];

    return {
      cur, accent, accentDark, accentLight, accentTint, accentBorder, accentShadow,
      nextColor: { ...nx, shadow: shadow(nx.hex), darker: darken(nx.hex, 55) },
      currentColor: { ...cur, shadow: shadow(cur.hex) },
      xpPercent, xpRemaining, totalPB, avgScore, avgRate, recentReports,
      ladder, rungsRemaining,
      achievements, earnedCount, achTotal: ACHIEVEMENTS.length, totalBadgeXp,
      lifetimePB, trend, trendDelta, allReports,
      notifications, unreadCount,
      reportColor: rc,
      reportXp: Math.round(reportPB * (reportScore / 100) * 18),
      projectedTotal: Math.min(500, xp + Math.round(reportPB * (reportScore / 100) * 18)),
    };
  }, [currentRung, xp, reports, notifs, reportPB, reportScore, reportColorIdx]);

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
                  <div onClick={() => signOut({ callbackUrl: '/login' })} title="Sign out" style={{ width:38, height:38, borderRadius:'50%', background:`linear-gradient(135deg,${v.accent},${v.accentDark})`, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:600, fontSize:14, cursor:'pointer' }}>
                    {(session?.user?.name || session?.user?.email || 'M').trim().charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize:11, color:'#8a8175', letterSpacing:.8, textTransform:'uppercase', fontWeight:500 }}>Good evening</div>
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
                    <div style={{ fontSize:12, fontWeight:600 }}>No report in 3 days</div>
                    <div style={{ fontSize:11, color:'#8a7d6e', marginTop:1 }}>Log one to protect your {streak}-day streak.</div>
                  </div>
                  <div onClick={openReport} style={{ padding:'8px 12px', background:'var(--accent)', color:'#fff', borderRadius:10, fontSize:11, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>Log now</div>
                </div>
              )}

              <div style={{ margin:'0 20px', background:'#fff', borderRadius:24, padding:24, border:'1px solid #ece6db', position:'relative', overflow:'hidden' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div style={{ fontSize:10, color:'#8a8175', letterSpacing:1.2, textTransform:'uppercase', fontWeight:600 }}>Current Level</div>
                    <div style={{ display:'flex', alignItems:'center', gap:9, marginTop:8 }}>
                      <div style={{ fontFamily:"'Instrument Serif',serif", fontSize:42, fontWeight:400, lineHeight:1, letterSpacing:'-.5px' }}>{v.currentColor.name}</div>
                      <div style={{ padding:'4px 9px', background:'var(--accent-tint)', border:'1px solid var(--accent-border)', borderRadius:8, fontSize:12, fontWeight:700, color:'var(--accent-dark)', letterSpacing:.5 }}>{v.currentColor.code}</div>
                    </div>
                    <div style={{ fontSize:12, color:'#8a8175', marginTop:6, fontVariantNumeric:'tabular-nums' }}>SRA level · Rung {currentRung} of 9</div>
                  </div>
                  <div style={{ width:64, height:64, borderRadius:18, background:v.currentColor.hex, position:'relative', boxShadow:`0 6px 20px ${v.currentColor.shadow}`, animation:'sra-glow 3s ease-in-out infinite' }}>
                    <div style={{ position:'absolute', inset:8, borderRadius:12, background:'linear-gradient(135deg, rgba(255,255,255,.35), rgba(255,255,255,0) 50%)' }}/>
                  </div>
                </div>
                <div style={{ marginTop:24 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8 }}>
                    <div style={{ fontSize:11, letterSpacing:.8, textTransform:'uppercase', color:'#8a8175', fontWeight:500 }}>XP toward next</div>
                    <div style={{ fontSize:13, fontWeight:600, fontVariantNumeric:'tabular-nums' }}>{xp} <span style={{ color:'#bdb5a6', fontWeight:400 }}>/ 500</span></div>
                  </div>
                  <div style={{ height:8, background:'#f4efe6', borderRadius:999, overflow:'hidden', position:'relative' }}>
                    <div style={{ height:'100%', borderRadius:999, background:`linear-gradient(90deg, ${v.currentColor.hex}, ${v.nextColor.hex})`, width:`${v.xpPercent}%`, transition:'width .8s cubic-bezier(.2,.8,.2,1)', position:'relative', overflow:'hidden' }}>
                      <div style={{ position:'absolute', inset:0, background:'linear-gradient(90deg, transparent, rgba(255,255,255,.5), transparent)', animation:'sra-shimmer 2.4s linear infinite' }}/>
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:14 }}>
                    <div style={{ fontSize:11, color:'#8a8175' }}>Up next</div>
                    <div style={{ width:12, height:12, borderRadius:4, background:v.nextColor.hex }}/>
                    <div style={{ fontSize:11, fontWeight:600 }}>{v.nextColor.name}</div>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--accent-dark)', background:'var(--accent-tint)', padding:'1px 6px', borderRadius:5, letterSpacing:.4 }}>{v.nextColor.code}</div>
                    <div style={{ flex:1 }}/>
                    <div style={{ fontSize:11, color:'#8a8175', fontVariantNumeric:'tabular-nums' }}>{v.xpRemaining} XP to go</div>
                  </div>
                </div>
              </div>

              <div style={{ margin:'18px 20px 0', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                <div style={{ background:'#fff', border:'1px solid #ece6db', borderRadius:18, padding:'14px 12px' }}>
                  <div style={{ fontSize:10, letterSpacing:.5, textTransform:'uppercase', color:'#8a8175', fontWeight:500 }}>Power Builders</div>
                  <div style={{ display:'flex', alignItems:'baseline', gap:3, marginTop:6 }}>
                    <div style={{ fontSize:24, fontWeight:700, fontVariantNumeric:'tabular-nums', letterSpacing:'-.5px' }}>{v.totalPB}</div>
                    <div style={{ fontSize:11, color:'#8a8175' }}>/wk</div>
                  </div>
                </div>
                <div style={{ background:'#fff', border:'1px solid #ece6db', borderRadius:18, padding:'14px 12px' }}>
                  <div style={{ fontSize:10, letterSpacing:.5, textTransform:'uppercase', color:'#8a8175', fontWeight:500 }}>Comprehension</div>
                  <div style={{ display:'flex', alignItems:'baseline', gap:1, marginTop:6 }}>
                    <div style={{ fontSize:24, fontWeight:700, fontVariantNumeric:'tabular-nums', letterSpacing:'-.5px', color:'var(--accent)' }}>{v.avgScore}</div>
                    <div style={{ fontSize:13, color:'var(--accent)', fontWeight:700 }}>%</div>
                  </div>
                </div>
                <div style={{ background:'#fff', border:'1px solid #ece6db', borderRadius:18, padding:'14px 12px' }}>
                  <div style={{ fontSize:10, letterSpacing:.5, textTransform:'uppercase', color:'#8a8175', fontWeight:500 }}>Reading rate</div>
                  <div style={{ display:'flex', alignItems:'baseline', gap:2, marginTop:6 }}>
                    <div style={{ fontSize:24, fontWeight:700, fontVariantNumeric:'tabular-nums', letterSpacing:'-.5px' }}>{v.avgRate}</div>
                    <div style={{ fontSize:10, color:'#8a8175' }}>wpm</div>
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
                        <div style={{ fontSize:13, fontWeight:600 }}>{r.periodLabel} report</div>
                        <div style={{ fontSize:11, color:'#8a8175', marginTop:2 }}>{r.pb} Power Builders · {r.score}% comp</div>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:'var(--accent)', fontVariantNumeric:'tabular-nums' }}>+{r.xp}</div>
                        <div style={{ fontSize:10, color:'#bdb5a6' }}>{r.when}</div>
                      </div>
                    </div>
                  ))}
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
                  Finish the set to master comprehension at <strong>{v.currentColor.name}</strong> level.
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
                  9 levels. <em style={{ color:'var(--accent)' }}>One ladder.</em>
                </div>
                <div style={{ fontSize:12, color:'#8a8175', marginTop:8, lineHeight:1.5 }}>1C to 3A — you're {v.rungsRemaining} rungs from the top.</div>
              </div>

              <div style={{ display:'flex', gap:6, margin:'12px 20px 0', background:'#f0e9dc', borderRadius:14, padding:4 }}>
                <div onClick={() => setLadderTab('climb')} style={{ flex:1, textAlign:'center', padding:9, borderRadius:10, fontSize:12, fontWeight:600, cursor:'pointer', background: ladderTab==='climb'?'#fff':'transparent', color: ladderTab==='climb'?'#1a1a1a':'#8a8175' }}>Color ladder</div>
                <div onClick={() => setLadderTab('ach')} style={{ flex:1, textAlign:'center', padding:9, borderRadius:10, fontSize:12, fontWeight:600, cursor:'pointer', background: ladderTab==='ach'?'#fff':'transparent', color: ladderTab==='ach'?'#1a1a1a':'#8a8175' }}>Achievements</div>
              </div>

              {ladderTab === 'climb' && (
                <div style={{ margin:'16px 20px 0', background:'#fff', border:'1px solid #ece6db', borderRadius:24, padding:'14px 16px 18px' }}>
                  {v.ladder.map((lvl, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'stretch', gap:16, minHeight:60, opacity:lvl.opacity }}>
                      <div style={{ position:'relative', width:48, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <div style={{ position:'absolute', top:0, bottom:'50%', left:'50%', width:4, transform:'translateX(-50%)', background:lvl.upColor }}/>
                        <div style={{ position:'absolute', top:'50%', bottom:0, left:'50%', width:4, transform:'translateX(-50%)', background:lvl.downColor }}/>
                        <div style={{ position:'relative', zIndex:1, width:46, height:46, borderRadius:'50%', background:lvl.discBg, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:lvl.discShadow }}>
                          <div style={{ position:'absolute', inset:6, borderRadius:'50%', background:'linear-gradient(135deg,rgba(255,255,255,.35),transparent 55%)' }}/>
                          {lvl.done && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ position:'relative', zIndex:2 }}><path d="M5 13l4 4L19 7"/></svg>}
                          {lvl.current && <div style={{ position:'absolute', inset:-5, borderRadius:'50%', border:`3px solid ${lvl.hex}`, opacity:.45, animation:'sra-pulse 2s ease-in-out infinite' }}/>}
                          {lvl.locked && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a59c8c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position:'relative', zIndex:2 }}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>}
                        </div>
                      </div>
                      <div style={{ flex:1, minWidth:0, display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:`1px solid ${lvl.sep}`, padding:'8px 0' }}>
                        <div>
                          <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                            <div style={{ fontSize:10, color:'#bdb5a6', fontVariantNumeric:'tabular-nums', fontWeight:600 }}>{lvl.numStr}</div>
                            <div style={{ fontFamily:"'Instrument Serif',serif", fontSize:22, lineHeight:1, color:lvl.textColor }}>{lvl.name}</div>
                          </div>
                          <div style={{ fontSize:11, color:'#8a8175', marginTop:4 }}>{lvl.label}</div>
                        </div>
                        <div style={{ textAlign:'right', flexShrink:0 }}>
                          {lvl.done && <div style={{ fontSize:10, color:'#8a8175', letterSpacing:.5, textTransform:'uppercase', fontWeight:500 }}>Cleared</div>}
                          {lvl.current && <div style={{ fontSize:10, color:'var(--accent)', letterSpacing:.5, textTransform:'uppercase', fontWeight:600 }}>You are here</div>}
                          {lvl.locked && <div style={{ fontSize:10, color:'#bdb5a6', letterSpacing:.5, textTransform:'uppercase', fontWeight:500, fontVariantNumeric:'tabular-nums' }}>{lvl.xpNeeded} XP</div>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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
                  <div style={{ fontSize:23, fontWeight:700, fontVariantNumeric:'tabular-nums', letterSpacing:'-.5px', color:'var(--accent)' }}>{v.avgScore}%</div>
                  <div style={{ fontSize:10, color:'#8a8175', marginTop:2 }}>Avg comp.</div>
                </div>
                <div style={{ background:'#fff', border:'1px solid #ece6db', borderRadius:18, padding:'14px 12px' }}>
                  <div style={{ fontSize:23, fontWeight:700, fontVariantNumeric:'tabular-nums', letterSpacing:'-.5px' }}>{v.avgRate}</div>
                  <div style={{ fontSize:10, color:'#8a8175', marginTop:2 }}>Avg WPM</div>
                </div>
              </div>

              <div style={{ margin:'20px 20px 0', background:'#fff', border:'1px solid #ece6db', borderRadius:20, padding:18 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:16 }}>
                  <div style={{ fontSize:11, letterSpacing:.8, textTransform:'uppercase', color:'#8a8175', fontWeight:600 }}>Comprehension trend</div>
                  <div style={{ fontSize:11, color:'var(--accent)', fontWeight:600 }}>{v.trendDelta}</div>
                </div>
                <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:8, height:96 }}>
                  {v.trend.map((t, i) => (
                    <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6, height:'100%', justifyContent:'flex-end' }}>
                      <div style={{ fontSize:9, fontWeight:600, color:'#1a1a1a', fontVariantNumeric:'tabular-nums' }}>{t.score}</div>
                      <div style={{ width:'100%', maxWidth:26, height:t.h, background:`linear-gradient(180deg,${t.hex},${t.hex2})`, borderRadius:7 }}/>
                      <div style={{ fontSize:9, color:'#bdb5a6' }}>{t.label}</div>
                    </div>
                  ))}
                </div>
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
                            <div style={{ fontSize:13, fontWeight:600 }}>{r.periodLabel}</div>
                            <div style={{ fontSize:9, letterSpacing:.4, textTransform:'uppercase', fontWeight:600, color:r.color, background:r.tint, padding:'2px 6px', borderRadius:6 }}>{r.colorName}</div>
                          </div>
                          <div style={{ fontSize:11, color:'#8a8175', marginTop:3 }}>{r.pb} Power Builders · {r.rate} wpm</div>
                        </div>
                        <div style={{ textAlign:'right', flexShrink:0 }}>
                          <div style={{ fontSize:15, fontWeight:700, color:'var(--accent)', fontVariantNumeric:'tabular-nums' }}>{r.score}%</div>
                          <div style={{ fontSize:10, color:'#bdb5a6' }}>{r.when}</div>
                        </div>
                      </div>
                    </div>
                  ))}
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
                      {reportStep === 1 ? 'How often?' : reportStep === 2 ? 'The numbers' : 'Confirm'}
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
                    {[
                      { key:'daily', label:'Daily check-in', sub:'One study session today' },
                      { key:'weekly', label:'Weekly report', sub:'Your week in Power Builders' },
                      { key:'monthly', label:'Monthly summary', sub:'The big-picture view' },
                    ].map(p => {
                      const selected = reportPeriod === p.key;
                      return (
                        <div key={p.key} onClick={() => setReportPeriod(p.key)} style={{ display:'flex', alignItems:'center', gap:14, padding:'18px 16px', background:'#fff', borderRadius:18, marginBottom:10, border:`2px solid ${selected ? '#c8643d' : 'transparent'}`, cursor:'pointer' }}>
                          <div style={{ width:44, height:44, borderRadius:13, background: selected ? 'var(--accent-tint)' : '#f4efe6', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={selected ? 'var(--accent)' : '#8a8175'} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:15, fontWeight:600 }}>{p.label}</div>
                            <div style={{ fontSize:12, color:'#8a8175', marginTop:2 }}>{p.sub}</div>
                          </div>
                          {selected && <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {reportStep === 2 && (
                  <div style={{ padding:'18px 24px 8px', animation:'sra-fadeIn .3s' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#fff', border:'1px solid #ece6db', borderRadius:16, padding:'14px 16px' }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:600 }}>Power Builders completed</div>
                        <div style={{ fontSize:11, color:'#8a8175', marginTop:2 }}>Comprehension cards finished</div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                        <div onClick={() => setReportPB(p => Math.max(1, p-1))} style={{ width:32, height:32, borderRadius:'50%', background:'#f0e9dc', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:20, fontWeight:600, color:'#1a1a1a' }}>−</div>
                        <div style={{ fontSize:22, fontWeight:700, fontVariantNumeric:'tabular-nums', minWidth:26, textAlign:'center' }}>{reportPB}</div>
                        <div onClick={() => setReportPB(p => Math.min(40, p+1))} style={{ width:32, height:32, borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:20, fontWeight:600, color:'#fff' }}>+</div>
                      </div>
                    </div>

                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginTop:22 }}>
                      <div style={{ fontSize:11, letterSpacing:.8, textTransform:'uppercase', color:'#8a8175', fontWeight:600 }}>Avg comprehension</div>
                      <div style={{ fontSize:18, fontWeight:700, fontVariantNumeric:'tabular-nums', color:'var(--accent)' }}>{reportScore}%</div>
                    </div>
                    <input type="range" min="0" max="100" step="1" value={reportScore} onChange={e => setReportScore(parseInt(e.target.value,10))} style={{ width:'100%', marginTop:8 }}/>

                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginTop:22 }}>
                      <div style={{ fontSize:11, letterSpacing:.8, textTransform:'uppercase', color:'#8a8175', fontWeight:600 }}>Reading rate</div>
                      <div style={{ fontSize:18, fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{reportRate}<span style={{ fontSize:12, color:'#8a8175', fontWeight:500, marginLeft:3 }}>wpm</span></div>
                    </div>
                    <input type="range" min="100" max="350" step="5" value={reportRate} onChange={e => setReportRate(parseInt(e.target.value,10))} style={{ width:'100%', marginTop:8 }}/>

                    <div style={{ fontSize:11, letterSpacing:.8, textTransform:'uppercase', color:'#8a8175', fontWeight:600, marginTop:22, marginBottom:10 }}>Color level practiced</div>
                    <div className="scroll-hide" style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:4 }}>
                      {LADDER.map((l, i) => {
                        const selected = reportColorIdx === i;
                        return (
                          <div key={i} onClick={() => setReportColorIdx(i)} style={{ flex:'0 0 auto', textAlign:'center', cursor:'pointer' }}>
                            <div style={{ width:46, height:46, borderRadius:14, background:l.hex, border:`3px solid ${selected ? '#1a1a1a' : 'transparent'}`, position:'relative' }}>
                              <div style={{ position:'absolute', inset:5, borderRadius:9, background:'linear-gradient(135deg,rgba(255,255,255,.35),transparent 55%)' }}/>
                            </div>
                            <div style={{ fontSize:10, marginTop:5, color:selected?'#1a1a1a':'#8a8175', fontWeight: selected?700:500 }}>{l.code}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {reportStep === 3 && (
                  <div style={{ padding:'18px 24px 8px', animation:'sra-fadeIn .3s' }}>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ width:72, height:72, borderRadius:22, background:v.reportColor.hex, margin:'0 auto', position:'relative', boxShadow:`0 12px 30px ${shadow(v.reportColor.hex)}`, animation:'sra-pop .5s cubic-bezier(.2,1.4,.5,1)' }}>
                        <div style={{ position:'absolute', inset:9, borderRadius:13, background:'linear-gradient(135deg,rgba(255,255,255,.35),transparent 50%)' }}/>
                      </div>
                      <div style={{ fontFamily:"'Instrument Serif',serif", fontSize:28, lineHeight:1.1, marginTop:16, letterSpacing:'-.4px' }}>Submit {periodLabel(reportPeriod).toLowerCase()} report?</div>
                    </div>
                    <div style={{ marginTop:20, padding:18, background:'#fff', border:'1px solid #ece6db', borderRadius:18 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 0' }}><div style={{ fontSize:12, color:'#8a8175' }}>Power Builders</div><div style={{ fontSize:13, fontWeight:600, fontVariantNumeric:'tabular-nums' }}>{reportPB}</div></div>
                      <div style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderTop:'1px solid #f4efe6', borderBottom:'1px solid #f4efe6', margin:'4px 0' }}><div style={{ fontSize:12, color:'#8a8175' }}>Comprehension</div><div style={{ fontSize:13, fontWeight:600, color:'#6fac6f' }}>{reportScore}%</div></div>
                      <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 0' }}><div style={{ fontSize:12, color:'#8a8175' }}>Reading rate · Color</div><div style={{ fontSize:13, fontWeight:600 }}>{reportRate} wpm · {v.reportColor.name} · {v.reportColor.code}</div></div>
                      <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0 4px', marginTop:6, borderTop:'1px solid #f4efe6' }}><div style={{ fontSize:12, color:'#8a8175' }}>XP reward</div><div style={{ fontSize:15, fontWeight:700, color:'var(--accent)', fontVariantNumeric:'tabular-nums' }}>+{v.reportXp}</div></div>
                    </div>
                    <div style={{ marginTop:14, padding:'14px 16px', background:'#1a1a1a', color:'#fff', borderRadius:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ fontSize:12, color:'#bdb5a6' }}>After this report</div>
                      <div style={{ fontSize:14, fontWeight:600, fontVariantNumeric:'tabular-nums' }}>{v.projectedTotal} / 500 XP</div>
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

          {/* LEVEL UP OVERLAY */}
          {levelUpShown && (
            <div style={{ position:'absolute', inset:0, zIndex:200, background:`linear-gradient(180deg, ${v.nextColor.hex}, ${v.nextColor.darker})`, animation:'sra-fadeIn .4s', overflow:'hidden' }}>
              <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
                {confetti.map((p, i) => (
                  <div key={i} style={{ position:'absolute', top:'30%', left:`${p.left}%`, width:8, height:14, background:p.color, borderRadius:2, animation:`sra-confetti ${p.dur}s ease-out forwards`, animationDelay:`${p.delay}s`, '--dx':`${p.dx}px` }}/>
                ))}
              </div>
              <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:40, textAlign:'center', color:'#fff' }}>
                <div style={{ fontSize:11, letterSpacing:2.5, textTransform:'uppercase', fontWeight:700, opacity:.85, animation:'sra-rise .5s .1s both' }}>Level up</div>
                <div style={{ margin:'30px 0', position:'relative', animation:'sra-pop .8s .2s cubic-bezier(.2,1.4,.5,1) both' }}>
                  <div style={{ width:140, height:140, borderRadius:40, background:'#fff', boxShadow:'0 24px 60px rgba(0,0,0,.25)', position:'relative' }}>
                    <div style={{ position:'absolute', inset:14, borderRadius:28, background:v.nextColor.hex }}>
                      <div style={{ position:'absolute', inset:10, borderRadius:20, background:'linear-gradient(135deg,rgba(255,255,255,.4),transparent 55%)' }}/>
                    </div>
                  </div>
                  <div style={{ position:'absolute', inset:-14, borderRadius:54, border:'3px solid rgba(255,255,255,.4)', animation:'sra-pulse 2s ease-in-out infinite' }}/>
                </div>
                <div style={{ fontFamily:"'Instrument Serif',serif", fontSize:64, lineHeight:1, letterSpacing:'-1px', animation:'sra-rise .5s .35s both' }}>{v.nextColor.name}</div>
                <div style={{ fontSize:13, opacity:.85, marginTop:14, maxWidth:280, lineHeight:1.5, animation:'sra-rise .5s .5s both' }}>
                  You reached level <strong>{v.nextColor.code}</strong>, up from <strong>{v.currentColor.name}</strong>. {v.rungsRemaining} rungs to 3A.
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
