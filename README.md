# Life Tracker

My personal iPhone app for organizing my life. It's a free web app (PWA) that I add to my Home Screen from Safari and host on GitHub Pages. Only I use it.

All data stays on my phone. There are no accounts and no servers, and it works offline.

## What's built

All six stages are built:

1. **Tasks, sections, recurring tasks, Day/Week/Month views, mini calendar, Export/Import**
2. **Events** (single or multi-day) with "tell me ahead" lead times, the **Forecast** with countdowns, and the **Daily Check**. You're warned when you schedule a task during a multi-day event.
3. **Projects**: an Active list in drag-to-reorder priority order, plus Radar and Done. Each project has notes, a task checklist, mini goals with dates, a target date, a status, and "last worked on". When you finish a project, the app offers to move the next Radar project up.
4. **Goals**: yearly goals, quarterly goals, weekly targets with streaks, mini goals, task linking, slipping goals, reminders to set goals (2 weeks before each quarter, and in December for next year), and a review of last quarter.
5. **Info and Lists**
6. **Sunday Planning**, **History** (a weekly chart broken down by section, project or goal), **Most Pushed Off**, and **Settings**

## Recent changes

- **Goals is switched off for now.** The Goals tab, goal pickers and goal cards are hidden, and your goal data is kept. To bring it back, set `GOALS_ON = true` in `js/store.js` and put the Goals tab button back in `index.html`.
- **Day page:** events are in their own box, then an **At work** box on weekdays, then **Today's Tasks**. Open tasks are numbered in the order you plan to do them. Drag the handle on the right to reorder, or move a task in or out of At work. Finished tasks go into a collapsed **Done** box.
- **Simpler Add task:** just the name, the date (already set to the day you are on) and an optional time. Repeat, section, project, Important and notes are under **More options**. To put a task in At work, use "+ Add a task for work" or drag it in.

- **Routines** (was Daily Check): simple things you repeat each week, all year. Pick the days each one shows on and, optionally, a category (e.g. Work, Maintenance) to group them. Routines can repeat every week or every other week. A routine on one day (e.g. fish tank on Monday) stays on your list from that day until you check it off. Add one with **+ → Routine**; change it with **Edit routines**.
- **Daily reflection** (replaces the End-of-day review): four short questions at the end of the day. Answers save as you type.
- **Info** (More → Info): things to keep handy, like codes and phone numbers.
- **Backup:** **More → Back up to Files** (top of More). Every Sunday the Home screen shows a reminder banner until you back up that day.

## Files

| File | What it does |
|---|---|
| `index.html` | The page itself: tab bar, + button |
| `css/styles.css` | All colors, sizes and layout (light and dark mode) |
| `js/app.js` | The switchboard: picks which screen to draw and passes taps along |
| `js/store.js` | Saves and loads data on the device, plus all the rules (repeats, pushed off, Forecast, goal progress) |
| `js/dates.js` | Date helpers (weeks, quarters, countdowns) |
| `js/ui.js` | Shared pieces: icons, pop-up sheets, progress bars |
| `js/forms.js` | Add/edit screens for tasks, events and sections |
| `js/home.js` | Home tab: Day/Week/Month, Daily Check, Forecast |
| `js/projects.js` | Projects tab |
| `js/goals.js` | Goals tab |
| `js/lists.js` | Lists and Info |
| `js/more.js` | More tab: Sunday Planning, History, Most Pushed Off, Settings, Backup |
| `js/vendor/Sortable.min.js` | Drag-to-reorder library (SortableJS, MIT license) |
| `sw.js` | Lets the app work offline. Bump `VERSION` after big changes |
| `manifest.webmanifest`, `icons/` | App name and Home Screen icon |

## Putting it on my iPhone

1. In the GitHub repository, go to **Settings → Pages**. Under "Build and deployment", set Source to **Deploy from a branch**, Branch to **main**, and folder to **/ (root)**. Tap **Save**.
2. Wait about a minute. The page shows the address, something like `https://tbertelsman18.github.io/Life-Track/`.
3. Open that address in **Safari** on the iPhone.
4. Tap the **Share** button, then **Add to Home Screen**, then **Add**.
5. From now on, always open the app from the Home Screen icon.

**Important:** the Home Screen app keeps its own data, separate from the Safari tab. Add tasks only in the Home Screen app.

## Backups

**More → Export backup → Save to Files → iCloud Drive.** Do this regularly, for example every Sunday. If you delete the app or switch phones, use **More → Import backup** to restore everything.
