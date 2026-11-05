# Life Tracker: notes for building

Personal iPhone PWA (plain HTML/CSS/JS, no build step), hosted on GitHub Pages from `main`.
See README.md for the file map. Bump `VERSION` in `sw.js` and `APP_VERSION` in `js/more.js` with each update.

## How the owner thinks about each part (keep these in mind when adding features)

- **Routines** are small, recurring chores the owner likes to do every week (e.g. check Ava results on weekdays,
  3P tests at work, fish tank water change on Mondays). They are *not* part of a project. Keep Routines separate
  from Projects; don't fold them into project features.
- **Tasks** are one-off things planned for a day. Adding a task should stay simple: name, date (defaults to the
  day being viewed) and optional time. Everything else lives under "More options".
- **Projects**: project tasks are planned inside the project itself. Tying projects into the daily task list is a
  future feature; the owner wants to design it before anything changes on the Projects screens.
- **Goals** are switched off for now (`GOALS_ON` in `js/store.js`); the data is kept. The owner may bring it back later.
