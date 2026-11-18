// General course sniper for UIUC Banner (StudentRegistrationSSB)
// ------------------------------------------------------------------
// HOW TO USE
// 1. Open Banner -> Registration -> Register for Classes, pick the term, and
//    keep that tab just for this script.
// 2. Edit CONFIG below, then paste this whole file into that tab's DevTools
//    Console (F12). If Chrome blocks pasting, type: allow pasting
// 3. Commands you can type in the Console afterwards:
//      sniperSections('CS', '225')  -> table of every section: CRN, type, time,
//                                      seats, and whether it conflicts with you
//      sniperStop()                 -> stop watching
//
// CONFIG.watch is a list of courses. For each course:
//   combos   - every CRN you need to add together (lecture + discussion, etc.),
//              best first. The first combo where EVERY CRN has a seat is used.
//   drop     - (optional) CRNs you're registered in that should be dropped to
//              make room, e.g. a class that time-conflicts with the new one.
//   dropMode - (optional) how drops happen:
//              'together' (default): add + drop in ONE submit. Needed when the
//                 new class conflicts with the one you drop, or you'd go over
//                 your credit-hour max. If the add fails but the drop went
//                 through, the script immediately re-adds the dropped CRNs.
//              'after': add first, and drop only once the add succeeded.
//                 Safest, but only works if the add doesn't need the drop.
// Leave watch empty ([]) to just look up sections with sniperSections().
// ------------------------------------------------------------------
const CONFIG = {
  term: '120271',          // Spring 2027 = 120271 (shown in Banner URLs/requests)
  everyMs: 30000,          // how often to check (30s; don't go much lower)
  watch: [
    // Example (replace with your own CRNs from sniperSections):
    // { subject: 'CS', number: '225',
    //   combos: [
    //     ['11111', '22222'],   // lecture A + discussion 1
    //     ['11111', '33333'],   // lecture A + discussion 2
    //   ],
    //   drop: ['44444', '55555'],  // e.g. lecture + discussion of a class to give up
    //   dropMode: 'together',
    // },
  ],
};

(() => {
  const base = '/StudentRegistrationSSB/ssb';
  const H = { headers: { 'X-Requested-With': 'XMLHttpRequest' } };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const log = (...a) => console.log('%c[SNIPER]', 'color:#e84a27;font-weight:bold', new Date().toLocaleTimeString(), ...a);
  const $ = s => document.querySelector(s);
  const done = new Set();          // courses finished (registered or given up)
  let busy = false, stopped = false, checks = 0, w = null, iv = null;

  function beep(times = 3) {
    try {
      const c = new AudioContext();
      for (let i = 0; i < times; i++) { const o = c.createOscillator(); o.frequency.value = 880; o.connect(c.destination); o.start(c.currentTime + i * 0.4); o.stop(c.currentTime + i * 0.4 + 0.25); }
    } catch (e) {}
  }
  function notify(msg, times = 3) {
    document.title = msg; beep(times);
    try { if (Notification.permission === 'granted') new Notification('Course sniper', { body: msg }); } catch (e) {}
  }
  try { Notification.requestPermission(); } catch (e) {}

  // ---------- Banner data ----------
  async function search(subject, number) {
    await fetch(base + '/classSearch/resetDataForm', { method: 'POST', ...H });
    const r = await fetch(`${base}/searchResults/searchResults?txt_subject=${encodeURIComponent(subject)}&txt_courseNumber=${encodeURIComponent(number)}&txt_term=${CONFIG.term}&pageOffset=0&pageMaxSize=500&sortColumn=subjectDescription&sortDirection=asc&_=${Date.now()}`, H);
    const j = await r.json();
    const rows = (j.data || []).filter(c => c.subject === subject && c.courseNumber === number);
    if (!rows.length) throw new Error(`no sections found for ${subject} ${number} (check subject/number/term)`);
    return rows;
  }
  async function signedIn() {
    const r = await fetch(base + '/classRegistration/getRegistrationEvents?termFilter=&_=' + Date.now(), { ...H, redirect: 'manual' });
    return r.status === 200;
  }
  async function myMeetings() {
    const r = await fetch(base + '/classRegistration/getRegistrationEvents?termFilter=&_=' + Date.now(), H);
    return (await r.json()).map(e => ({ title: `${e.subject} ${e.courseNumber}`, day: new Date(e.start).getDay(), s: mins(new Date(e.start)), e: mins(new Date(e.end)) }));
  }
  const mins = d => d.getHours() * 60 + d.getMinutes();
  const hm = s => (s && s.length === 4) ? +s.slice(0, 2) * 60 + +s.slice(2) : null;
  function meetings(c) {
    const out = [];
    for (const mf of c.meetingsFaculty || []) {
      const t = mf.meetingTime, s = hm(t.beginTime), e = hm(t.endTime);
      if (s == null) continue;
      [['sunday', 0], ['monday', 1], ['tuesday', 2], ['wednesday', 3], ['thursday', 4], ['friday', 5], ['saturday', 6]]
        .forEach(([k, d]) => { if (t[k]) out.push({ day: d, s, e }); });
    }
    return out;
  }
  function when(c) {
    return (c.meetingsFaculty || []).map(mf => {
      const t = mf.meetingTime;
      const days = [['monday', 'M'], ['tuesday', 'T'], ['wednesday', 'W'], ['thursday', 'R'], ['friday', 'F'], ['saturday', 'S'], ['sunday', 'U']].filter(([k]) => t[k]).map(([, v]) => v).join('');
      return t.beginTime ? `${days} ${t.beginTime}-${t.endTime}` : 'online/arranged';
    }).join('; ');
  }

  // Console helper: list every section of a course with conflicts vs your schedule
  window.sniperSections = async (subject, number) => {
    const [rows, mine] = await Promise.all([search(subject, number), myMeetings()]);
    const table = rows.map(c => {
      const hits = meetings(c).flatMap(m => mine.filter(x => x.day === m.day && m.s < x.e && x.s < m.e).map(x => x.title));
      return { CRN: c.courseReferenceNumber, section: c.sequenceNumber, type: c.scheduleTypeDescription, time: when(c), seats: c.seatsAvailable, conflictsWith: [...new Set(hits)].join(', ') || '-' };
    });
    console.table(table);
    return `${table.length} sections of ${subject} ${number}`;
  };

  // ---------- Register-for-Classes page actions ----------
  function fire(el, ...types) {
    types.forEach(t => el.dispatchEvent(new Event(t, { bubbles: true })));
    if (window.jQuery) types.forEach(t => window.jQuery(el).trigger(t));
  }
  function setVal(el, v) { el.focus(); el.value = v; fire(el, 'input', 'keyup', 'change'); }
  const summaryRows = () => [...document.querySelectorAll('[id*=summary] tbody tr')].map(r => r.innerText.replace(/\s+/g, ' '));
  const rowOf = crn => summaryRows().find(r => r.includes(crn)) || '';
  const isRegistered = crn => /Registered/.test(rowOf(crn));
  const dropSelect = crn => $(`#action-${crn}-ddl`);

  async function enterCRNs(crns) {
    $('#enterCRNs-tab').click(); await sleep(800);
    for (let i = 0; i < crns.length; i++) {
      let el = $('#txt_crn' + (i + 1));
      if (!el) { $('#addAnotherCRN').click(); await sleep(500); el = $('#txt_crn' + (i + 1)); }
      if (!el) throw new Error('could not find CRN box #' + (i + 1));
      setVal(el, crns[i]);
    }
    $('#addCRNbutton').click();
    await sleep(1500);
  }
  function markDrops(crns) {
    for (const crn of crns) {
      const sel = dropSelect(crn);
      if (!sel) throw new Error(`no drop option for ${crn} (are you registered in it?)`);
      const opt = [...sel.options].find(o => /drop/i.test(o.text));
      if (!opt) throw new Error(`Banner offers no drop action for ${crn}`);
      sel.value = opt.value; fire(sel, 'change');
    }
  }
  function unmarkDrops(crns) {
    for (const crn of crns) {
      const sel = dropSelect(crn);
      if (sel && sel.value !== 'null') { sel.value = 'null'; fire(sel, 'change'); }
    }
  }
  async function submit() {
    for (let i = 0; i < 20 && $('#saveButton').disabled; i++) await sleep(250);
    $('#saveButton').click();
    await sleep(5000);
  }

  // Returns { ok, msg }
  async function register(adds, drops, mode) {
    drops = drops || [];
    if (!drops.length || mode === 'after') {
      await enterCRNs(adds);
      await submit();
      if (!adds.every(isRegistered)) return { ok: false, msg: 'add failed: ' + adds.map(c => `${c}: ${rowOf(c) || 'not in summary'}`).join(' | ') };
      if (!drops.length) return { ok: true, msg: 'added ' + adds.join(' + ') };
      markDrops(drops);
      await submit();
      const stillIn = drops.filter(isRegistered);
      return stillIn.length
        ? { ok: true, msg: `added ${adds.join(' + ')}, but could NOT drop ${stillIn.join(', ')} - drop it yourself` }
        : { ok: true, msg: `added ${adds.join(' + ')}, dropped ${drops.join(' + ')}` };
    }

    // 'together': add and drop in one submit, with recovery if the add fails
    const missing = drops.filter(c => !dropSelect(c));
    if (missing.length) throw new Error(`not registered in drop CRN(s) ${missing.join(', ')} - fix CONFIG`);
    await enterCRNs(adds);
    markDrops(drops);
    await submit();
    if (adds.every(isRegistered)) {
      const stillIn = drops.filter(isRegistered);
      return stillIn.length
        ? { ok: true, msg: `added ${adds.join(' + ')}, but ${stillIn.join(', ')} is still registered - check it` }
        : { ok: true, msg: `added ${adds.join(' + ')}, dropped ${drops.join(' + ')}` };
    }
    const lost = drops.filter(c => !isRegistered(c));
    unmarkDrops(drops);
    if (!lost.length) return { ok: false, msg: 'add failed, nothing was dropped: ' + adds.map(c => `${c}: ${rowOf(c) || 'not in summary'}`).join(' | ') };

    // The drop went through but the add didn't: put the dropped classes back right away.
    notify(`ADD FAILED - re-adding ${lost.join(', ')}`, 6);
    log(`Add failed and ${lost.join(', ')} got dropped. Re-adding now...`);
    await enterCRNs(lost);
    await submit();
    const back = lost.filter(isRegistered);
    if (back.length === lost.length) return { ok: false, recovered: true, msg: `add failed; re-added ${lost.join(', ')} successfully` };
    return { ok: false, fatal: true, msg: `ADD FAILED AND COULD NOT RE-ADD ${lost.filter(c => !back.includes(c)).join(', ')} - register for it manually NOW` };
  }

  // ---------- main loop ----------
  async function tick() {
    if (busy || stopped) return; busy = true;
    try {
      if (!(await signedIn())) { notify('SIGNED OUT - sign back in'); log('Signed out of Banner. Sign back in, then paste the script again.'); stop(); return; }
      checks++;
      for (const course of CONFIG.watch) {
        const name = `${course.subject} ${course.number}`;
        if (done.has(name)) continue;
        const seats = {};
        (await search(course.subject, course.number)).forEach(c => { seats[c.courseReferenceNumber] = c.seatsAvailable; });
        const watched = [...new Set(course.combos.flat())].map(c => `${c}:${seats[c] ?? '?'}`).join(' ');
        log(`check ${checks} ${name}: ${watched}`);
        const combo = course.combos.find(cr => cr.every(c => seats[c] > 0));
        if (!combo) continue;
        const drops = course.drop || [];
        notify(`${name} OPEN - registering ${combo.join(' + ')}${drops.length ? ', dropping ' + drops.join(' + ') : ''}`);
        const res = await register(combo, drops, course.dropMode || 'together');
        log(`${name}: ${res.msg}`);
        if (res.ok) { done.add(name); notify(`REGISTERED: ${name} (${combo.join(' + ')})`); }
        else if (res.fatal) { notify('PROBLEM - check the console', 10); stop(); return; }
        else log(`${name}: will keep trying.`);
      }
      if (CONFIG.watch.length && CONFIG.watch.every(c => done.has(`${c.subject} ${c.number}`))) { log('All courses done. Stopping.'); stop(); }
    } catch (e) { log('error', e.message); }
    finally { busy = false; }
  }

  function stop() { stopped = true; if (w) w.terminate(); if (iv) clearInterval(iv); }
  window.sniperStop = () => { stop(); log('stopped'); };

  if (!CONFIG.watch.length) { log('No courses in CONFIG.watch. Use sniperSections("SUBJ", "NUM") to look up CRNs.'); return; }
  // Sanity-check drop CRNs before starting
  for (const c of CONFIG.watch) {
    const bad = (c.drop || []).filter(crn => !dropSelect(crn));
    if (bad.length) log(`WARNING ${c.subject} ${c.number}: you don't appear to be registered in drop CRN(s) ${bad.join(', ')}. Open Register for Classes so the Summary panel shows your classes, and check the CRNs.`);
    if (c.drop && c.drop.length) log(`${c.subject} ${c.number}: will drop ${c.drop.join(' + ')} (${c.dropMode || 'together'} mode) when it registers.`);
  }
  try {   // Worker timer keeps ticking when the tab is in the background
    w = new Worker(URL.createObjectURL(new Blob([`setInterval(()=>postMessage(0),${CONFIG.everyMs})`])));
    w.onmessage = () => tick();
  } catch (e) { iv = setInterval(tick, CONFIG.everyMs); }
  tick();
  log(`Watching ${CONFIG.watch.map(c => c.subject + ' ' + c.number).join(', ')} every ${CONFIG.everyMs / 1000}s. sniperStop() to stop, sniperSections("SUBJ","NUM") to look up sections.`);
})();
