# Life Tracker

My personal iPhone app for organizing my life. It's a free web app (PWA) that I add to my Home Screen from Safari and host on GitHub Pages. Only I use it.

All data stays on my phone. There are no accounts and no servers, and it works offline.

## What's built so far

**Stage 1 (done):** tasks, sections, recurring tasks, Day/Week/Month views, the mini calendar, and Export/Import.

Coming next:
2. Events, Forecast with lead times, Daily Check
3. Projects and Radar
4. Goals
5. Info and Lists
6. Sunday Planning, History, Most Pushed Off, Settings

## Files

| File | What it does |
|---|---|
| `index.html` | The page itself: tab bar, + button |
| `css/styles.css` | All colors, sizes and layout (light and dark mode) |
| `js/app.js` | Draws each screen and handles taps |
| `js/store.js` | Saves and loads data on the phone; task rules (repeats, pushed off) |
| `js/dates.js` | Date helpers |
| `sw.js` | Lets the app work offline |
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
