# UIUC Course Sniper

A browser-console script for UIUC's Banner registration (Student Self-Service → Register for Classes). It watches the sections you pick and registers you the moment every section in one of your chosen combinations has an open seat, for example a lecture plus a discussion.

- **No password stored anywhere.** It runs inside your own signed-in Banner tab and uses that session. Duo works normally because you sign in yourself.
- **Handles linked sections.** You list whole combinations (lecture + discussion, lecture + lab + discussion), and it only registers a combination when every part has a seat.
- **Shows conflicts.** `sniperSections()` prints every section of a course with times, open seats, and which of your current classes it would clash with.
- **Can swap a class out.** Optionally drop classes you name, for example one that time-conflicts with the course you want, in the same step it registers you. There's built-in recovery if the add fails.
- **Alerts you.** You get a beep, a desktop notification, and a changed tab title when it registers you, or if Banner signs you out.
- **Only drops what you list.** It never drops anything you didn't put in `drop`.
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

## Dropping a class to make room

If the course you want conflicts with a class you're already in, or would put you over your credit-hour maximum, add `drop` to that course. The script then drops those CRNs when it registers you:

```js
watch: [
  { subject: 'STAT', number: '400',
    combos: [
      ['36133', '36137'],          // lecture + discussion you want
    ],
    drop: ['46074', '52979'],      // lecture + discussion of the class to give up
    dropMode: 'together',          // or 'after' (see below)
  },
],
```

Run `sniperSections()` on the course you want: its `conflictsWith` column tells you which class is in the way. The CRNs to drop are listed in Banner's **Summary** panel.

**Drop modes**

| `dropMode` | How it works | Use when |
|---|---|---|
| `'together'` (default) | Adds the new CRNs and marks the drop CRNs as **Web Drop Course** in **one** submit | The new class time-conflicts with the one you're dropping, or you'd go over your credit-hour max. Banner needs the drop and the add in the same submit. |
| `'after'` | Adds first. Only drops once every new CRN shows **Registered** | The add doesn't depend on the drop, for example you just want to stop taking a class. This is the safest mode: you never lose a class unless you gained the new one. |

**Safety in `'together'` mode.** UIUC's Banner doesn't offer "conditional add/drop", so if the add fails (the seat got taken a second earlier, a prerequisite or restriction error, and so on), the drop can still go through. When the script sees that happen, it **immediately re-adds the classes it just dropped**. Your old seat was just freed, so it's almost always still there. Then it keeps watching. If the re-add also fails, it beeps repeatedly, stops, and tells you which CRN to re-register by hand right away.

Before it starts watching, the script checks that you're actually registered in every `drop` CRN, and warns you if you aren't.

> Drops can't be undone once someone else takes your old seat. Double-check the `drop` CRNs, and prefer `'after'` whenever the add doesn't need the drop.

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
- **Registration rules still apply.** It can't get around holds, prerequisites, or restrictions. For time conflicts and the credit-hour max, use `drop` (above). If Banner rejects a CRN, the log shows why.
- **The add-and-submit step clicks Banner's own buttons.** If UIUC changes the Register for Classes page layout, that part may need updating.

## Disclaimer

This is an unofficial personal tool, not affiliated with or endorsed by the University of Illinois. You're responsible for following UIUC's acceptable-use and registration policies. Use it at your own risk.
