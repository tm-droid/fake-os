// Entry point. Builds the kernel, registers apps, wires events to the UI, then runs the boot sequence.
import { events } from './kernel/events.js';
import { storage } from './kernel/storage.js';
import { createFileSystem, normalize, basename } from './kernel/fs.js';
import { createPrefs, WALLPAPERS, ACCENTS } from './kernel/prefs.js';
import { createProcesses } from './kernel/processes.js';
import { createCatalog } from './kernel/catalog.js';
import { createWindowManager } from './kernel/windows.js';
import { createDialogs } from './ui/dialogs.js';
import { createPopper } from './ui/popper.js';
import { createMenubar } from './ui/menubar.js';
import { createTaskbar } from './ui/taskbar.js';
import { createLauncher } from './ui/launcher.js';
import { createDesktop } from './ui/desktop.js';
import { createToaster } from './ui/toast.js';
import { runBoot } from './ui/login.js';
import filesApp from './apps/files.js';
import notesApp from './apps/notes.js';
import terminalApp from './apps/terminal.js';
import calculatorApp from './apps/calculator.js';
import paintApp from './apps/paint.js';
import settingsApp from './apps/settings.js';
import snakeApp from './apps/snake.js';
import clockApp from './apps/clock.js';
import activityApp from './apps/activity.js';
import storeApp from './apps/store.js';

const $ = (id) => document.getElementById(id);
const APPS = [
  filesApp,
  notesApp,
  terminalApp,
  calculatorApp,
  paintApp,
  settingsApp,
  snakeApp,
  clockApp,
  activityApp,
  storeApp,
];

function applyPrefs(prefs) {
  const root = document.documentElement;
  root.dataset.theme = prefs.appearance;
  root.style.setProperty('--accent', ACCENTS[prefs.accent].value);
  root.style.setProperty('--wallpaper', WALLPAPERS[prefs.wallpaper].css);
}

function extensionOf(path) {
  const name = basename(path);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot).toLowerCase() : '';
}

async function main() {
  const prefs = createPrefs();
  applyPrefs(prefs.get());
  events.on('prefs:change', applyPrefs);

  const fs = createFileSystem();
  const processes = createProcesses();
  const overlay = $('overlay-root');
  const dialogs = createDialogs(overlay);
  const popper = createPopper(overlay);
  const wm = createWindowManager({ layer: $('windows'), minWidth: 300, minHeight: 180 });

  for (const app of APPS) processes.register(app);
  const catalog = createCatalog({ apps: processes.apps() });

  const os = { events, fs, prefs, processes, catalog, wm, dialogs, popper, launch, openPath };

  function launch(appId, args = {}) {
    if (!catalog.isInstalled(appId)) {
      const name = processes.app(appId)?.name ?? appId;
      dialogs.alert(`${name} is not installed. Open the App Store to install it.`, { title: 'Cannot open app' });
      return null;
    }
    try {
      return processes.start(appId, args);
    } catch (err) {
      console.error(err);
      dialogs.alert(err.message, { title: 'Cannot open app' });
      return null;
    }
  }

  // Opens a folder in Files, a .png in Paint, and anything else in Notes.
  function openPath(path) {
    const target = normalize(path);
    let info;
    try {
      info = fs.stat(target);
    } catch (err) {
      dialogs.alert(err.message, { title: 'Cannot open item' });
      return null;
    }
    if (info.type === 'dir') return launch('files', { path: target });
    if (extensionOf(target) === '.png') return launch('paint', { path: target });
    return launch('notes', { path: target });
  }

  function makeContext(proc, win) {
    return {
      pid: proc.pid,
      args: proc.args,
      window: win,
      os,
      fs,
      prefs,
      dialogs,
      popper,
      events,
      processes,
      wm,
      launch,
      openPath,
      // Subscribes to a bus event and unsubscribes automatically when this window closes.
      on(name, fn) {
        const off = events.on(name, fn);
        win.onClose(off);
        return off;
      },
    };
  }

  function startProcess(proc) {
    const app = processes.app(proc.appId);
    const win = wm.open({
      pid: proc.pid,
      appId: app.id,
      appName: app.name,
      title: app.name,
      width: app.width,
      height: app.height,
      minWidth: app.minWidth,
      minHeight: app.minHeight,
      resizable: app.resizable !== false,
    });
    try {
      app.open(makeContext(proc, win));
    } catch (err) {
      console.error(`[${app.id}] failed to open`, err);
      wm.close(win.id);
      dialogs.alert(`${app.name} quit unexpectedly.\n\n${err.message}`, { title: app.name });
    }
  }

  events.on('proc:start', startProcess);
  events.on('win:close', ({ pid }) => processes.stop(pid));
  events.on('proc:stop', ({ pid }) => {
    for (const win of wm.list()) {
      if (win.pid === pid) wm.close(win.id);
    }
  });

  events.on('fs:error', ({ reason }) => {
    dialogs.alert(
      reason === 'quota'
        ? 'This browser has run out of space for FakeOS files. Delete something to make room, then try again.'
        : 'That change could not be saved.',
      { title: 'Storage problem' },
    );
  });

  // Removing an app closes its windows; either change tells the user what happened.
  events.on('apps:installed', ({ id, installed }) => {
    if (!installed) {
      for (const proc of processes.running(id)) processes.stop(proc.pid);
    }
    const name = processes.app(id)?.name ?? id;
    events.emit('notify', {
      icon: installed ? 'check' : 'trash',
      title: installed ? `${name} installed` : `${name} removed`,
      body: installed ? 'Find it in the launcher.' : 'Your files are still on the disk.',
    });
  });

  const launcher = createLauncher({ el: $('launcher'), catalog, launchApp: launch });
  const toggleLauncher = () => launcher.toggle();
  createToaster({ el: $('toasts'), events });
  createMenubar({ el: $('menubar'), os, toggleLauncher });
  createTaskbar({ el: $('taskbar'), os, toggleLauncher });
  createDesktop({ root: $('desktop'), iconsEl: $('desktop-icons'), os });

  await runBoot({ bootEl: $('boot'), lockEl: $('lock') });
  $('os').hidden = false;

  if (!storage.usable) {
    dialogs.alert('Browser storage is turned off, so files and settings will reset when you reload.', {
      title: 'Storage unavailable',
    });
  }
}

main().catch((err) => {
  console.error(err);
  const note = document.createElement('p');
  note.className = 'noscript';
  note.textContent = `FakeOS failed to start: ${err.message}`;
  document.body.replaceChildren(note);
});
