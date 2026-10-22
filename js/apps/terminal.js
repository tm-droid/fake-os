// Terminal window: a scrollback and a prompt. Commands run through terminal-engine.js against the virtual disk.
import { HOME } from '../kernel/fs.js';
import { runCommand } from './terminal-engine.js';

const HISTORY_LIMIT = 100;

function promptFor(cwd) {
  return `guest@fakeos ${cwd === HOME ? '~' : cwd} % `;
}

export default {
  id: 'terminal',
  name: 'Terminal',
  glyph: 'terminal',
  tile: 'linear-gradient(#5c5c60, #1c1c1e)',
  pinned: true,
  width: 640,
  height: 420,
  minWidth: 360,
  minHeight: 220,

  open(ctx) {
    const body = ctx.window.body;
    body.innerHTML = `
      <div class="terminal-app">
        <div class="terminal-scrollback" role="log"></div>
        <div class="terminal-input-row">
          <span class="terminal-prompt"></span>
          <input class="terminal-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Command">
        </div>
      </div>`;
    const scrollback = body.querySelector('.terminal-scrollback');
    const promptEl = body.querySelector('.terminal-prompt');
    const input = body.querySelector('.terminal-input');

    const session = {
      fs: ctx.fs,
      cwd: HOME,
      openApp: (appId) => ctx.launch(appId),
      openPath: (path) => ctx.openPath(path),
    };
    const history = [];
    let pos = 0;

    function append(node) {
      scrollback.append(node);
      scrollback.scrollTop = scrollback.scrollHeight;
    }

    function addLine(text, className = '') {
      const el = document.createElement('div');
      el.className = `terminal-line${className ? ` ${className}` : ''}`;
      el.textContent = text;
      append(el);
    }

    function echoLine(prompt, command) {
      const el = document.createElement('div');
      el.className = 'terminal-line';
      const promptPart = document.createElement('span');
      promptPart.className = 'terminal-line-prompt';
      promptPart.textContent = prompt;
      el.append(promptPart, command);
      append(el);
    }

    function clearScreen() {
      scrollback.replaceChildren();
    }

    function run(command) {
      const prompt = promptFor(session.cwd);
      const result = runCommand(command, session);
      if (result.clear) {
        clearScreen();
      } else {
        echoLine(prompt, command);
        for (const text of result.lines) addLine(text, result.error ? 'is-error' : '');
      }
      promptEl.textContent = promptFor(session.cwd);
    }

    function remember(command) {
      if (history.at(-1) !== command) history.push(command);
      if (history.length > HISTORY_LIMIT) history.shift();
      pos = history.length;
    }

    body.addEventListener('keydown', (event) => {
      if (event.isComposing) return;
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && (key === 'l' || key === 'k')) {
        event.preventDefault();
        clearScreen();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const command = input.value;
        input.value = '';
        if (command.trim()) remember(command);
        run(command);
      } else if (event.key === 'ArrowUp' && history.length) {
        event.preventDefault();
        pos = Math.max(0, pos - 1);
        input.value = history[pos];
      } else if (event.key === 'ArrowDown' && history.length) {
        event.preventDefault();
        pos = Math.min(history.length, pos + 1);
        input.value = history[pos] ?? '';
      }
    });

    body.addEventListener('click', () => input.focus());

    ctx.window.setMenu([
      {
        title: 'Shell',
        items: [
          { label: 'New Window', action: () => ctx.launch('terminal'), shortcut: 'Cmd+N' },
          '-',
          { label: 'Close Window', action: () => ctx.window.close(), shortcut: 'Cmd+W' },
        ],
      },
      { title: 'Edit', items: [{ label: 'Clear Screen', action: clearScreen, shortcut: 'Cmd+K' }] },
    ]);

    promptEl.textContent = promptFor(session.cwd);
    addLine('FakeOS Terminal. Type help for a list of commands.');
    input.focus();
  },
};
