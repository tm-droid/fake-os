# FakeOS

A fake operating system that runs entirely in your browser. It has a menu bar, a desktop with draggable windows that snap to the edges, a taskbar with a launcher, and six working apps:

- **Files**: browse, rename, make folders, and move things to the Trash
- **Terminal**: a small shell with `ls`, `cd`, `cat`, `echo > file`, `open` and more
- **Notes**: autosaving text notes
- **Calculator**: classic left-to-right arithmetic with keyboard support
- **Paint**: a canvas with brush, eraser, undo, and save to Pictures
- **Settings**: appearance, accent color, wallpaper, and system reset

Live: https://tm-droid.github.io/fake-os/

## Run it

No build step and no dependencies. Serve the folder with any static server:

```bash
npm start
```

Then open http://localhost:8080.

## Test

```bash
npm test
```

The tests use `node:test` and cover the virtual disk, preferences, the terminal engine and the calculator engine.

## How it is organized

- `js/kernel/` is OS logic with no DOM: the event bus, storage, the virtual disk, preferences, the process table and the window manager.
- `js/ui/` is the shell: menu bar, taskbar, launcher, desktop, dialogs, popup menus, icons and the boot and lock screens.
- `js/apps/` holds one module per app. Each default-exports `{ id, name, glyph, tile, open(ctx) }`.
- `css/` holds the design tokens (`base.css`), shell pieces, and one stylesheet per app.

Files, notes and drawings are saved in your browser's local storage. They survive a reload, and clearing site data erases them.
