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
// CONFIG.watch is a list of "combos". A combo is every CRN you need to add
// together (e.g. lecture + discussion, or lecture + lab + discussion).
// Combos are tried top to bottom; the first one where EVERY CRN has a seat
// gets registered, and then the rest of that course is skipped.
// Leave watch empty ([]) to just look up sections with sniperSections().
// ------------------------------------------------------------------
const CONFIG = {
  term: '120271',          // Spring 2027 = 120271 (shown in Banner URLs/requests)
  everyMs: 30000,          // how often to check (30s; don't go much lower)
  watch: [
    // Example (replace with your own CRNs from sniperSections):
    // { subject: 'CS', number: '225', combos: [
    //   ['11111', '22222'],   // lecture A + discussion 1
    //   ['11111', '33333'],   // lecture A + discussion 2
    // ] },
  ],
};

(() => {
  const base = '/StudentRegistrationSSB/ssb';
  const H = { headers: { 'X-Requested-With': 'XMLHttpRequest' } };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const log = (...a) => console.log('%c[SNIPER]', 'color:#e84a27;font-weight:bold', new Date().toLocaleTimeString(), ...a);
  const done = new Set();          // courses already registered
  let busy = false, stopped = false, checks = 0, w = null, iv = null;

  function beep() {
    try {
      const c = new AudioContext();
      [0, 0.4, 0.8].forEach(t => { const o = c.createOscillator(); o.frequency.value = 880; o.connect(c.destination); o.start(c.currentTime + t); o.stop(c.currentTime + t + 0.25); });
    } catch (e) {}
  }
  function notify(msg) {
    document.title = msg; beep();
    try { if (Notification.permission === 'granted') new Notification('Course sniper', { body: msg }); } catch (e) {}
  }
  try { Notification.requestPermission(); } catch (e) {}

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

  function setVal(el, v) {
    el.focus(); el.value = v;
    ['input', 'keyup', 'change'].forEach(t => el.dispatchEvent(new Event(t, { bubbles: true })));
  }
  async function register(crns) {
    document.querySelector('#enterCRNs-tab').click(); await sleep(800);
    for (let i = 0; i < crns.length; i++) {
      let el = document.querySelector('#txt_crn' + (i + 1));
      if (!el) { document.querySelector('#addAnotherCRN').click(); await sleep(500); el = document.querySelector('#txt_crn' + (i + 1)); }
      if (!el) return 'could not find CRN box #' + (i + 1);
      setVal(el, crns[i]);
    }
    document.querySelector('#addCRNbutton').click();
    for (let i = 0; i < 20 && document.querySelector('#saveButton').disabled; i++) await sleep(250);
    document.querySelector('#saveButton').click();
    await sleep(4000);
    const rows = [...document.querySelectorAll('[id*=summary] tbody tr')].map(r => r.innerText.replace(/\s+/g, ' '));
    const status = crn => rows.find(r => r.includes(crn)) || '';
    return crns.every(c => /Registered/.test(status(c))) ? 'ok' : rows.filter(r => crns.some(c => r.includes(c))).join(' | ');
  }

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
        notify(`${name} OPEN - registering ${combo.join(' + ')}`);
        const res = await register(combo);
        if (res === 'ok') { done.add(name); notify(`REGISTERED: ${name} (${combo.join(' + ')})`); log('Registered', name, combo); }
        else log(`${name}: registration did not go through: ${res} - will keep trying.`);
      }
      if (CONFIG.watch.length && CONFIG.watch.every(c => done.has(`${c.subject} ${c.number}`))) { log('All courses registered. Stopping.'); stop(); }
    } catch (e) { log('error', e.message); }
    finally { busy = false; }
  }

  function stop() { stopped = true; if (w) w.terminate(); if (iv) clearInterval(iv); }
  window.sniperStop = () => { stop(); log('stopped'); };

  if (!CONFIG.watch.length) { log('No courses in CONFIG.watch. Use sniperSections("SUBJ", "NUM") to look up CRNs.'); return; }
  try {   // Worker timer keeps ticking when the tab is in the background
    w = new Worker(URL.createObjectURL(new Blob([`setInterval(()=>postMessage(0),${CONFIG.everyMs})`])));
    w.onmessage = () => tick();
  } catch (e) { iv = setInterval(tick, CONFIG.everyMs); }
  tick();
  log(`Watching ${CONFIG.watch.map(c => c.subject + ' ' + c.number).join(', ')} every ${CONFIG.everyMs / 1000}s. sniperStop() to stop, sniperSections("SUBJ","NUM") to look up sections.`);
})();
