# UIUC Course Sniper

A browser-console script for UIUC's Banner registration (Student Self-Service → Register for Classes). It watches the sections you pick and registers you the moment every section in one of your chosen combinations has an open seat, for example a lecture plus a discussion.

- **No password stored anywhere.** It runs inside your own signed-in Banner tab and uses that session. Duo works normally because you sign in yourself.
- **Handles linked sections.** You list whole combinations (lecture + discussion, lecture + lab + discussion), and it only registers a combination when every part has a seat.
- **Shows conflicts.** `sniperSections()` prints every section of a course with times, open seats, and which of your current classes it would clash with.
- **Alerts you.** You get a beep, a desktop notification, and a changed tab title when it registers you, or if Banner signs you out.
- **Never drops anything.** It only adds the CRNs you list.
- **CHANGING THE MS DELAY TO ANYTHING LOWER THAN 30 SECONDS MIGHT FLAG YOU ACCOUNT LOWER IT AT YOUR OWN RISK
  

## Quick start

1. **Open Banner.** Go to [Banner registration](https://banner.apps.uillinois.edu/StudentRegistrationSSB/ssb/registration?mepCode=1UIUC), sign in, open **Register for Classes**, and pick your term. Keep this tab just for the script.
2. **Open the Console.** Press <kbd>F12</kbd> (or <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>J</kbd>, or <kbd>Cmd</kbd>+<kbd>Option</kbd>+<kbd>J</kbd> on Mac) and click **Console**. If Chrome warns about pasting, type `allow pasting` and press Enter.
3. **Find your CRNs.** Paste all of [`course-sniper.js`](course-sniper.js) as it is, with an empty `watch` list, and press Enter. Then run:
   ```js
   sniperSections('CS', '225')
   ```
   You get a table like this:

   | CRN | section | type | time | seats | conflictsWith |
   |---|---|---|---|---|---|
   | 12345 | AL1 | Lecture | MWF 1000-1050 | 0 | - |
   | 23456 | AD1 | Discussion/Recitation | R 0930-1050 | 3 | - |
   | 34567 | AD2 | Discussion/Recitation | R 1300-1350 | 1 | MATH 241 |

   Linked sections usually share a section-code prefix: lectures `AL1` and `AL2` go with discussions `AD1`, `AD2`, and so on. Banner's **View Linked** button shows exactly which sections go together.
4. **Edit `CONFIG`** at the top of the script. Set your term and list the combinations you'd accept, best first:
   ```js
   const CONFIG = {
     term: '120271',     // Spring 2027 (see "Term codes" below)
     everyMs: 30000,     // check every 30 seconds
     watch: [
       { subject: 'CS', number: '225', combos: [
         ['12345', '23456'],   // lecture AL1 + discussion AD1
         ['12345', '45678'],   // lecture AL1 + discussion AD3
       ] },
       { subject: 'STAT', number: '400', combos: [
         ['36133', '36137'],
       ] },
     ],
   };
   ```
5. **Start watching.** Paste the edited script into the Console again. It logs one line per check:
   ```
   [SNIPER] 10:42:03 PM check 12 CS 225: 12345:0 23456:2 45678:0
   ```
   When a combination opens, the script switches to **Enter CRNs**, types the CRNs, clicks **Add to Summary** and **Submit**, and checks that each one shows **Registered**. If something fails, it logs why and tries again on the next check. Once a course is registered, it stops watching that course.

## Commands

| Command | What it does |
|---|---|
| `sniperSections('SUBJ', 'NUM')` | Table of every section: CRN, type, time, seats, conflicts with your current schedule |
| `sniperStop()` | Stop watching |

## Term codes

The term code is `1` + year + a semester digit:

| Term | Code |
|---|---|
| Spring 2027 | `120271` |
| Summer 2027 | `120275` |
| Fall 2027 | `120278` |

If you're unsure, run a search in Banner and look for `txt_term=` in the Network tab of DevTools.

## Tips and limits

- **Keep the computer awake** with Chrome open. Sleep, a closed lid, or a dropped network connection pause the checks. The script uses a Web Worker timer, so a background tab keeps checking.
- **Banner signs you out after a while.** The script notices, beeps, and stops. Sign back in and paste it again.
- **Don't search for other classes in that tab while it runs.** Banner remembers one search per session, and each check re-runs its own search. Use a different browser profile if you need to browse at the same time.
- **Be reasonable with `everyMs`.** 30 seconds is plenty. Hammering Banner doesn't help and could get your session flagged.
- **Registration rules still apply.** It can't get around holds, prerequisites, restrictions, time-conflict errors, or your credit-hour maximum. If Banner rejects a CRN, the log shows why.
- **The add-and-submit step clicks Banner's own buttons.** If UIUC changes the Register for Classes page layout, that part may need updating.

## Disclaimer

This is an unofficial personal tool, not affiliated with or endorsed by the University of Illinois. You're responsible for following UIUC's acceptable-use and registration policies. Use it at your own risk.
