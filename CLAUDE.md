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
  day being viewed), optional time, Section (chips) and the Important switch (right under the name). "More options"
  holds only repeat, tell me ahead and notes. No dropdowns: the owner finds them clunky (prefer tap chips).
- **Project tasks** use their own short form (`openProjectTaskSheet`): name, Milestone chips, Add to my schedule
  (reveals date/time), notes. Repeat days only for a repeating task. No Section, Important or More options.
  Adding a milestone = just its name; tap a milestone to rename it, give it a date, or delete it.
- Unfinished one-time tasks from earlier days get a "Not finished" box on today: Move to today, Not completed
  (task leaves the lists but is tracked: `missed` flag, shown in Settings → Pushed off & not completed) or Delete.
- **Ideas** live in Projects as a fourth segment (Active · Radar · Ideas · Done; quick-add bar at the top), kept separate from tasks. The + button is only for
  Task / Event / Recurring, and it only shows on the Planner tab.
- Bottom tabs: **Planner** (was Home) · **Projects** · **Settings** (was More; still holds backup,
  planning, history, sections, info, etc.). Internally the tabs are still 'home' and 'more'.
- **Projects**: cards show days in progress (`startedAt`, set when status first becomes In progress; older
  projects fall back to `createdAt`). Levels (keep it to these three): the project is the overall goal →
  **Milestones** (the major parts, stored in `project.miniGoals`) → tasks needed to reach each milestone
  (`task.milestoneId`; tasks without one show under "Other tasks"). **No steps** inside tasks (the owner doesn't
  want them; old `task.steps` data is kept but not shown). Milestones are checked off **by hand only** (the owner
  adds tasks to them over time). **Projects stay off the schedule for now**: no target dates or milestones on the
  Planner; a project task only shows there if the owner turns on **Add to my schedule** in its edit sheet (then a
  date appears; off = no date). Project tasks have no Important switch. Say **Milestones**, never "mini goals" (the data field is still `miniGoals`).
  Every project page uses the same layout: add-a-milestone bar at the top → each milestone with its tasks
  (one-time first, then **repeating tasks that belong to that milestone**, never in a separate box) → Other tasks →
  Notes → **Details** at the bottom (status, section, progress, target date, last worked on: low priority for the owner).
  Project repeating tasks are different from Routines: they belong to a milestone.
  A possible next step: an optional **Due by** date on tasks, separate from the "do on" date.
  Tying projects into the daily task list is a
  future feature; the owner wants to design it before anything changes on the Projects screens.
- **Radar** projects are real projects, just not on the top list right now: same page as Active (milestones →
  tasks), no "Radar project" wording. **Ideas** are lighter: quick one-line thoughts that may get dropped, no planning.
- **Goals** are switched off for now (`GOALS_ON` in `js/store.js`); the data is kept. The owner may bring it back later.
