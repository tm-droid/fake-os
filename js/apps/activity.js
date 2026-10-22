// Activity Monitor window: a live table of running processes, refreshed each second.
// Rows are keyed by pid, so a Quit button keeps focus between refreshes.

// Uptime as m:ss, or h:mm:ss once it passes an hour.
function formatUptime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`;
  return `${minutes}:${seconds}`;
}

// Build an element with an optional class and text. Text goes in through textContent only.
function make(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

export default {
  id: 'activity',
  name: 'Activity Monitor',
  glyph: 'activity',
  tile: 'linear-gradient(#ff9500, #9a3b00)',
  width: 520,
  height: 380,
  minWidth: 360,
  minHeight: 240,
  resizable: true,
  open(ctx) {
    const body = ctx.window.body;
    body.classList.add('activity-body');

    const summary = make('div', 'activity-summary');
    const tbody = make('tbody');
    const table = make('table', 'activity-table');
    const scroll = make('div', 'activity-scroll');
    const empty = make('div', 'activity-empty', 'No processes are running.');

    const headRow = make('tr');
    const actionsHead = make('th', 'activity-actions');
    actionsHead.append(make('span', 'sr-only', 'Actions'));
    headRow.append(
      make('th', 'activity-num', 'PID'),
      make('th', '', 'App'),
      make('th', 'activity-num', 'Running'),
      actionsHead,
    );
    table.append(make('thead'), tbody);
    table.querySelector('thead').append(headRow);
    scroll.append(table, empty);

    const app = make('div', 'activity-app');
    app.append(summary, scroll);
    body.replaceChildren(app);

    // Per-pid row state. `since` is the time this window first saw the pid.
    const rows = new Map();

    function buildRow(proc, now) {
      const uptime = make('td', 'activity-num');
      const actions = make('td', 'activity-actions');
      // This app's own row gets no Quit button.
      if (proc.pid !== ctx.pid) {
        const pid = proc.pid;
        const quit = make('button', 'activity-quit', 'Quit');
        quit.type = 'button';
        quit.addEventListener('click', () => {
          ctx.processes.stop(pid);
          render();
        });
        actions.append(quit);
      }
      const row = make('tr');
      row.append(
        make('td', 'activity-num', String(proc.pid)),
        make('td', 'activity-name', proc.title || proc.appId),
        uptime,
        actions,
      );
      return { row, uptime, since: now };
    }

    function render() {
      const now = Date.now();
      const list = ctx.processes.running();
      const live = new Set(list.map((proc) => proc.pid));

      // Remove rows for processes that have stopped.
      for (const [pid, entry] of rows) {
        if (live.has(pid)) continue;
        entry.row.remove();
        rows.delete(pid);
      }

      for (const proc of list) {
        let entry = rows.get(proc.pid);
        if (!entry) {
          // New processes are appended, which matches the process table's start order.
          entry = buildRow(proc, now);
          rows.set(proc.pid, entry);
          tbody.append(entry.row);
        }
        // Use the record's start time if it has one. processes.js sets none, so the first sighting stands in.
        const started = typeof proc.startedAt === 'number' ? proc.startedAt : entry.since;
        entry.uptime.textContent = formatUptime(now - started);
      }

      summary.textContent = `${list.length} processes · ${ctx.wm.list().length} windows`;
      table.hidden = list.length === 0;
      empty.hidden = list.length > 0;
    }

    render();
    const timer = setInterval(render, 1000);
    ctx.window.onClose(() => clearInterval(timer));
  },
};
