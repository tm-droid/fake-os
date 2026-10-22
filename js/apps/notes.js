// Notes: a sidebar of text files and an autosaving editor. Notes live in Documents/Notes.
import { HOME, basename, joinPath, normalize, segments } from '../kernel/fs.js';
import { glyph } from '../ui/icons.js';

const NOTES_DIR = `${HOME}/Documents/Notes`;
const SAVE_DELAY = 300;

// "Name.ext" -> { stem: "Name", ext: ".ext" }. A name without a dot is all stem.
function split(name) {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? { stem: name.slice(0, dot), ext: name.slice(dot) } : { stem: name, ext: '' };
}

// Where a path ends up after a rename: the item itself, or anything inside a renamed folder.
function movedPath(path, from, to) {
  if (path === from) return to;
  return path.startsWith(`${from}/`) ? to + path.slice(from.length) : path;
}

function countsOf(text) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return `${words} ${words === 1 ? 'word' : 'words'} · ${text.length} ${text.length === 1 ? 'character' : 'characters'}`;
}

export default {
  id: 'notes',
  name: 'Notes',
  glyph: 'note',
  tile: 'linear-gradient(#fff6b0, #ffd60a)',
  pinned: true,
  width: 680,
  height: 460,
  minWidth: 360,
  minHeight: 260,

  open(ctx) {
    const { fs, dialogs } = ctx;
    const body = ctx.window.body;
    body.innerHTML = `
      <div class="notes-app">
        <aside class="notes-sidebar">
          <div class="notes-tools">
            <button type="button" class="btn notes-new">${glyph('plus')}<span>New Note</span></button>
            <button type="button" class="btn notes-delete" aria-label="Delete note" title="Move to Trash">${glyph('trash')}</button>
          </div>
          <ul class="notes-list"></ul>
        </aside>
        <section class="notes-main">
          <div class="notes-editor-wrap">
            <textarea class="notes-editor" aria-label="Note text"></textarea>
            <footer class="notes-status">
              <span class="notes-state"></span>
              <span class="notes-count"></span>
            </footer>
          </div>
          <div class="notes-empty" hidden>
            <p class="notes-empty-text"></p>
            <button type="button" class="btn primary notes-empty-new">New Note</button>
          </div>
        </section>
      </div>`;
    const $ = (sel) => body.querySelector(sel);
    const editor = $('.notes-editor');
    const editorWrap = $('.notes-editor-wrap');
    const empty = $('.notes-empty');
    const emptyText = $('.notes-empty-text');
    const list = $('.notes-list');
    const stateEl = $('.notes-state');
    const countEl = $('.notes-count');

    let current = null; // path of the open note, or null
    let dirty = false; // the editor holds text that is not written yet
    let timer = null;
    let title = '';

    // Notes in the folder, plus the open note when it lives elsewhere.
    function notePaths() {
      let paths = [];
      try {
        paths = fs
          .list(NOTES_DIR)
          .filter((item) => item.type === 'file' && /\.txt$/i.test(item.name))
          .map((item) => item.path);
      } catch {
        // the folder is missing, so the list stays empty
      }
      if (current && !paths.includes(current)) paths.unshift(current);
      return paths;
    }

    function renderList() {
      list.replaceChildren(
        ...notePaths().map((path) => {
          const li = document.createElement('li');
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'notes-item';
          btn.textContent = split(basename(path)).stem;
          btn.title = basename(path);
          if (path === current) {
            btn.classList.add('is-selected');
            btn.setAttribute('aria-current', 'true');
          }
          btn.addEventListener('click', () => show(path));
          li.append(btn);
          return li;
        }),
      );
    }

    function refresh() {
      renderList();
      const next = current ? split(basename(current)).stem : 'Notes';
      if (next !== title) {
        title = next;
        ctx.window.setTitle(next);
      }
    }

    function setState(text) {
      stateEl.textContent = text;
    }

    function updateCounts() {
      countEl.textContent = countsOf(editor.value);
    }

    function save() {
      clearTimeout(timer);
      timer = null;
      if (!current || !dirty) return;
      dirty = false;
      setState('Saving...');
      try {
        fs.write(current, editor.value);
        setState('Saved');
      } catch (err) {
        dirty = true;
        setState('Not saved');
        dialogs.alert(err.message, { title: 'Save failed' });
      }
    }

    function show(path) {
      if (path === current) {
        editor.focus();
        return;
      }
      let text;
      try {
        text = fs.read(path);
      } catch (err) {
        dialogs.alert(err.message, { title: 'Cannot open note' });
        return;
      }
      save();
      current = path;
      dirty = false;
      editor.value = text;
      editorWrap.hidden = false;
      empty.hidden = true;
      setState('Saved');
      updateCounts();
      refresh();
      editor.focus();
    }

    function showEmpty() {
      clearTimeout(timer);
      timer = null;
      current = null;
      dirty = false;
      editor.value = '';
      editorWrap.hidden = true;
      empty.hidden = false;
      emptyText.textContent = notePaths().length ? 'No note open.' : 'You have no notes yet.';
      refresh();
    }

    // Writes an empty "Untitled.txt" (or "Untitled 2.txt", ...) and returns its path.
    function createNote() {
      let dir = '';
      for (const part of segments(NOTES_DIR)) {
        dir += `/${part}`;
        if (!fs.exists(dir)) fs.mkdir(dir);
      }
      let name = 'Untitled.txt';
      for (let n = 2; fs.exists(joinPath(NOTES_DIR, name)); n += 1) name = `Untitled ${n}.txt`;
      const path = joinPath(NOTES_DIR, name);
      fs.write(path, '');
      return path;
    }

    function newNote() {
      try {
        show(createNote());
      } catch (err) {
        dialogs.alert(err.message, { title: 'New Note' });
      }
    }

    async function rename() {
      const target = current;
      if (!target) return;
      const name = basename(target);
      const { stem, ext } = split(name);
      const value = await dialogs.prompt('Enter a new name for this note.', {
        title: 'Rename',
        ok: 'Rename',
        input: { value: stem },
      });
      let base = (value ?? '').trim();
      if (ext && base.toLowerCase().endsWith(ext.toLowerCase())) base = base.slice(0, -ext.length).trim();
      if (!base || base + ext === name || !fs.exists(target)) return;
      try {
        fs.rename(target, base + ext);
      } catch (err) {
        dialogs.alert(err.message, { title: 'Rename' });
      }
    }

    async function deleteCurrent() {
      const target = current;
      if (!target) return;
      const yes = await dialogs.confirm(`Move "${split(basename(target)).stem}" to the Trash?`, {
        title: 'Move to Trash',
        ok: 'Move to Trash',
        destructive: true,
      });
      if (!yes || !fs.exists(target)) return;
      const paths = notePaths();
      const i = paths.indexOf(target);
      const next = paths[i + 1] ?? paths[i - 1] ?? null;
      try {
        fs.trash(target);
      } catch (err) {
        dialogs.alert(err.message, { title: 'Move to Trash' });
        return;
      }
      if (next) show(next);
    }

    // Keeps the view in step with the disk, whoever made the change.
    function onFsChange(ev = {}) {
      if (current && ev.op === 'rename') current = movedPath(current, ev.path, ev.to);
      if (current && !fs.exists(current)) {
        showEmpty();
        return;
      }
      if (current && !dirty) {
        const text = fs.read(current);
        if (text !== editor.value) {
          editor.value = text;
          updateCounts();
        }
      }
      refresh();
    }

    editor.addEventListener('input', () => {
      dirty = true;
      setState('Not saved');
      updateCounts();
      clearTimeout(timer);
      timer = setTimeout(save, SAVE_DELAY);
    });

    $('.notes-new').addEventListener('click', newNote);
    $('.notes-empty-new').addEventListener('click', newNote);
    $('.notes-delete').addEventListener('click', deleteCurrent);

    body.addEventListener('keydown', (event) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'n') {
        event.preventDefault();
        newNote();
      } else if (key === 'backspace') {
        event.preventDefault();
        deleteCurrent();
      }
    });

    ctx.window.setMenu([
      {
        title: 'File',
        items: [
          { label: 'New Note', action: newNote, shortcut: 'Cmd+N' },
          { label: 'Rename...', action: rename },
          { label: 'Move to Trash', action: deleteCurrent, shortcut: 'Cmd+Backspace' },
          '-',
          { label: 'Close Window', action: () => ctx.window.close(), shortcut: 'Cmd+W' },
        ],
      },
      {
        title: 'Edit',
        items: [
          {
            label: 'Select All',
            action: () => {
              editor.focus();
              editor.select();
            },
            shortcut: 'Cmd+A',
          },
        ],
      },
    ]);

    ctx.on('fs:change', onFsChange);
    ctx.window.onClose(save);

    const requested = ctx.args?.path ? normalize(ctx.args.path) : null;
    if (requested && fs.exists(requested) && !fs.isDir(requested)) show(requested);
    else show(notePaths()[0] ?? createNote());
  },
};
