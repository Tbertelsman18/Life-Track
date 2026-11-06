# Life Tracker: notes for building

Personal iPhone PWA (plain HTML/CSS/JS, no build step), hosted on GitHub Pages from `main`.
See README.md for the file map. Bump `VERSION` in `sw.js` and `APP_VERSION` in `js/more.js` with each update.

## How the owner likes to build (follow this)

- Start simple, make each piece good, then grow the next feature out of it. One step at a time.
- Keep the owner dialed down: don't expand ideas too fast or pile on new features. If an idea is bigger than
  the request, mention it briefly as a "later" idea instead of building it or pitching several options.
- Clean up and polish the simple functions before developing anything into something big.
- When the owner says "good idea, but let's clean up the simple functions first", that's the plan: park the idea.

## How the owner thinks about each part (keep these in mind when adding features)

- **Recurring tasks** (called Routines in the code: `dailyCheck` data, `routine*` functions) are small, recurring chores the owner likes to do every week (e.g. check Ava results on weekdays,
  3P tests at work, fish tank water change on Mondays). They use the same **Sections** as tasks (so a later weekly score per section can cover both). They are *not* part of a project. Keep them separate
  from Projects; don't fold them into project features.
- **Tasks** are one-off things planned for a day. Adding a task should stay simple: name, date (defaults to the
  day being viewed) and optional time. Everything else lives under "More options".
- **Projects**: project tasks are planned inside the project itself. Tying projects into the daily task list is a
  future feature; the owner wants to design it before anything changes on the Projects screens.
- **Goals** are switched off for now (`GOALS_ON` in `js/store.js`); the data is kept. The owner may bring it back later.
