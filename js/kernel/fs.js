// Virtual disk: a tree of directories and text files, persisted as one JSON blob.
// Every mutation goes through here, so storage and the UI stay in sync via `fs:change`.
import { events as defaultEvents } from './events.js';
import { storage as defaultStorage } from './storage.js';

export const HOME = '/Users/guest';
export const TRASH = '/Trash';
export const STORAGE_KEY = 'fakeos.fs.v1';

const WELCOME_DESKTOP = [
  'Welcome to FakeOS.',
  '',
  'This desktop runs entirely in your browser. Files, notes and drawings',
  'are saved in this browser, so they survive a reload. Clearing site data',
  'erases them.',
  '',
  'Try the Terminal, open Notes, or drag a window by its title bar.',
].join('\n');

const WELCOME_NOTE = [
  'Getting Started',
  '',
  'Notes autosave as you type. Use the Files app to make folders,',
  'rename things, and move items to the Trash.',
].join('\n');

export class FsError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = 'FsError';
    this.code = code;
  }
}

const stamp = () => new Date().toISOString();
const dir = (children = {}) => ({ type: 'dir', children, modified: stamp() });
const file = (content = '') => ({ type: 'file', content, modified: stamp() });

export function seedTree() {
  return dir({
    Users: dir({
      guest: dir({
        Desktop: dir({ 'Welcome.txt': file(WELCOME_DESKTOP) }),
        Documents: dir({ Notes: dir({ 'Getting Started.txt': file(WELCOME_NOTE) }) }),
        Downloads: dir(),
        Pictures: dir(),
      }),
    }),
    Trash: dir(),
  });
}

export function segments(path) {
  const out = [];
  for (const part of String(path).split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out;
}

export function normalize(path) {
  return `/${segments(path).join('/')}`;
}

export function joinPath(dirPath, name) {
  return normalize(`${dirPath}/${name}`);
}

// Resolves user input against a working directory. Handles "~", absolute and relative paths.
export function resolve(cwd, input = '') {
  const p = String(input).trim();
  if (p === '') return normalize(cwd);
  if (p === '~') return HOME;
  if (p.startsWith('~/')) return normalize(`${HOME}/${p.slice(2)}`);
  if (p.startsWith('/')) return normalize(p);
  return normalize(`${cwd}/${p}`);
}

export function basename(path) {
  const parts = segments(path);
  return parts.length ? parts[parts.length - 1] : '/';
}

export function dirname(path) {
  const parts = segments(path);
  parts.pop();
  return `/${parts.join('/')}`;
}

export function isValidName(name) {
  if (typeof name !== 'string') return false;
  const n = name.trim();
  return n.length > 0 && n.length <= 255 && n !== '.' && n !== '..' && !n.includes('/');
}

function uniqueName(children, name) {
  if (!Object.hasOwn(children, name)) return name;
  const dot = name.lastIndexOf('.');
  const hasExt = dot > 0;
  const base = hasExt ? name.slice(0, dot) : name;
  const ext = hasExt ? name.slice(dot) : '';
  for (let i = 2; ; i += 1) {
    const candidate = `${base} ${i}${ext}`;
    if (!Object.hasOwn(children, candidate)) return candidate;
  }
}

export function createFileSystem({ storage = defaultStorage, events = defaultEvents, key = STORAGE_KEY } = {}) {
  let root;

  function persist(change) {
    const result = storage.set(key, root);
    if (!result.ok) events.emit('fs:error', { reason: result.reason, change });
    events.emit('fs:change', change);
  }

  function load() {
    const saved = storage.get(key);
    if (saved && saved.type === 'dir' && saved.children) {
      root = saved;
      return;
    }
    root = seedTree();
    storage.set(key, root);
  }
  load();

  function lookup(path) {
    let node = root;
    for (const part of segments(path)) {
      if (node.type !== 'dir' || !Object.hasOwn(node.children, part)) return null;
      node = node.children[part];
    }
    return node;
  }

  function must(path) {
    const node = lookup(path);
    if (!node) throw new FsError('ENOENT', `no such file or directory, '${normalize(path)}'`);
    return node;
  }

  function parentOf(path) {
    const p = normalize(path);
    const parts = segments(p);
    if (parts.length === 0) throw new FsError('EPERM', "operation not permitted, '/'");
    const name = parts.pop();
    const parentPath = `/${parts.join('/')}`;
    const parent = lookup(parentPath);
    if (!parent) throw new FsError('ENOENT', `no such file or directory, '${p}'`);
    if (parent.type !== 'dir') throw new FsError('ENOTDIR', `not a directory, '${parentPath}'`);
    return { parent, name, parentPath };
  }

  function info(path, node) {
    return {
      name: basename(path),
      path,
      type: node.type,
      size: node.type === 'file' ? node.content.length : 0,
      items: node.type === 'dir' ? Object.keys(node.children).length : 0,
      modified: node.modified,
    };
  }

  function stat(path) {
    const p = normalize(path);
    return info(p, must(p));
  }

  // Folders first, then names in natural order ("file 2" before "file 10").
  function list(path = HOME) {
    const p = normalize(path);
    const node = must(p);
    if (node.type !== 'dir') throw new FsError('ENOTDIR', `not a directory, '${p}'`);
    return Object.entries(node.children)
      .map(([name, child]) => info(joinPath(p, name), child))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
      });
  }

  function exists(path) {
    return lookup(path) !== null;
  }

  function isDir(path) {
    const node = lookup(path);
    return Boolean(node && node.type === 'dir');
  }

  function read(path) {
    const p = normalize(path);
    const node = must(p);
    if (node.type !== 'file') throw new FsError('EISDIR', `illegal operation on a directory, '${p}'`);
    return node.content;
  }

  function write(path, content = '') {
    const p = normalize(path);
    const existing = lookup(p);
    if (existing && existing.type === 'dir') throw new FsError('EISDIR', `illegal operation on a directory, '${p}'`);
    const { parent, name } = parentOf(p);
    parent.children[name] = file(String(content));
    persist({ op: 'write', path: p });
    return info(p, parent.children[name]);
  }

  function mkdir(path) {
    const p = normalize(path);
    if (lookup(p)) throw new FsError('EEXIST', `file already exists, '${p}'`);
    const { parent, name } = parentOf(p);
    parent.children[name] = dir();
    persist({ op: 'mkdir', path: p });
    return p;
  }

  // Returns the new normalized path. Renaming to the same name is a no-op.
  function rename(path, newName) {
    const p = normalize(path);
    must(p);
    if (!isValidName(newName)) throw new FsError('EINVAL', `invalid name '${newName}'`);
    const { parent, name, parentPath } = parentOf(p);
    const clean = newName.trim();
    if (clean === name) return p;
    if (Object.hasOwn(parent.children, clean)) {
      throw new FsError('EEXIST', `file already exists, '${joinPath(parentPath, clean)}'`);
    }
    parent.children[clean] = parent.children[name];
    delete parent.children[name];
    const next = joinPath(parentPath, clean);
    persist({ op: 'rename', path: p, to: next });
    return next;
  }

  // Permanent delete. Used by the Trash itself and by trash() for items already in the Trash.
  function remove(path) {
    const p = normalize(path);
    if (p === '/' || p === TRASH) throw new FsError('EPERM', `operation not permitted, '${p}'`);
    must(p);
    const { parent, name } = parentOf(p);
    delete parent.children[name];
    persist({ op: 'remove', path: p });
  }

  // Moves an item into /Trash and returns its new path. Items already in the Trash are deleted for good
  // and null is returned.
  function trash(path) {
    const p = normalize(path);
    if (p === '/' || p === TRASH) throw new FsError('EPERM', `operation not permitted, '${p}'`);
    if (p.startsWith(`${TRASH}/`)) {
      remove(p);
      return null;
    }
    must(p);
    const trashNode = must(TRASH);
    const { parent, name } = parentOf(p);
    const unique = uniqueName(trashNode.children, name);
    trashNode.children[unique] = parent.children[name];
    delete parent.children[name];
    const to = joinPath(TRASH, unique);
    persist({ op: 'trash', path: p, to });
    return to;
  }

  function emptyTrash() {
    must(TRASH).children = {};
    persist({ op: 'empty-trash', path: TRASH });
  }

  function reset() {
    root = seedTree();
    persist({ op: 'reset', path: '/' });
  }

  return { stat, list, read, write, mkdir, rename, trash, remove, emptyTrash, exists, isDir, reset };
}
