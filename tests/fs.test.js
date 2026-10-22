import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFileSystem, normalize, resolve, HOME, TRASH } from '../js/kernel/fs.js';
import { createStorage } from '../js/kernel/storage.js';
import { createEvents } from '../js/kernel/events.js';

function makeFs(storage = createStorage(null)) {
  const events = createEvents();
  const changes = [];
  events.on('fs:change', (change) => changes.push(change));
  const fs = createFileSystem({ storage, events });
  return { fs, storage, events, changes };
}

test('seeds the home folders and a welcome file on the desktop', () => {
  const { fs } = makeFs();
  assert.deepEqual(
    fs.list(HOME).map((item) => item.name),
    ['Desktop', 'Documents', 'Downloads', 'Pictures'],
  );
  assert.match(fs.read(`${HOME}/Desktop/Welcome.txt`), /^Welcome to FakeOS\./);
});

test('list puts folders first and sorts names naturally', () => {
  const { fs } = makeFs();
  fs.write(`${HOME}/Desktop/file 10.txt`, '');
  fs.write(`${HOME}/Desktop/file 2.txt`, '');
  fs.mkdir(`${HOME}/Desktop/zeta`);
  assert.deepEqual(
    fs.list(`${HOME}/Desktop`).map((item) => item.name),
    ['zeta', 'file 2.txt', 'file 10.txt', 'Welcome.txt'],
  );
});

test('path helpers normalize and resolve input', () => {
  assert.equal(normalize('//a/./b/'), '/a/b');
  assert.equal(resolve('/Users/guest', '~'), HOME);
  assert.equal(resolve('/Users/guest', '~/Desktop'), `${HOME}/Desktop`);
  assert.equal(resolve(`${HOME}/Desktop`, '../Documents'), `${HOME}/Documents`);
  assert.equal(resolve(HOME, '/Trash/'), '/Trash');
  assert.equal(resolve('/', '..'), '/');
});

test('write overwrites files and reports missing paths and wrong types', () => {
  const { fs } = makeFs();
  fs.write(`${HOME}/a.txt`, 'hi');
  fs.write(`${HOME}/a.txt`, 'bye');
  assert.equal(fs.read(`${HOME}/a.txt`), 'bye');
  assert.throws(() => fs.read(`${HOME}/missing.txt`), { code: 'ENOENT' });
  assert.throws(() => fs.read(HOME), { code: 'EISDIR' });
  assert.throws(() => fs.write(`${HOME}/nope/x.txt`, ''), { code: 'ENOENT' });
  assert.throws(() => fs.mkdir(`${HOME}/Desktop`), { code: 'EEXIST' });
});

test('rename keeps the content, refuses collisions and bad names', () => {
  const { fs } = makeFs();
  const next = fs.rename(`${HOME}/Desktop/Welcome.txt`, 'Hello.txt');
  assert.equal(next, `${HOME}/Desktop/Hello.txt`);
  assert.equal(fs.exists(`${HOME}/Desktop/Welcome.txt`), false);
  assert.match(fs.read(next), /^Welcome to FakeOS\./);
  fs.write(`${HOME}/Desktop/Other.txt`, '');
  assert.throws(() => fs.rename(next, 'Other.txt'), { code: 'EEXIST' });
  assert.throws(() => fs.rename(next, 'a/b'), { code: 'EINVAL' });
  assert.equal(fs.rename(next, 'Hello.txt'), next);
});

test('trash moves items into /Trash with unique names and deletes items already there', () => {
  const { fs } = makeFs();
  fs.write(`${HOME}/Desktop/a.txt`, '1');
  assert.equal(fs.trash(`${HOME}/Desktop/a.txt`), `${TRASH}/a.txt`);
  fs.write(`${HOME}/Documents/a.txt`, '2');
  const second = fs.trash(`${HOME}/Documents/a.txt`);
  assert.equal(second, `${TRASH}/a 2.txt`);
  assert.equal(fs.read(second), '2');
  assert.equal(fs.trash(second), null);
  assert.equal(fs.exists(second), false);
  assert.throws(() => fs.trash(TRASH), { code: 'EPERM' });
  assert.throws(() => fs.remove('/'), { code: 'EPERM' });
});

test('emptyTrash clears the Trash folder', () => {
  const { fs } = makeFs();
  fs.write(`${HOME}/Desktop/x.txt`, '');
  fs.trash(`${HOME}/Desktop/x.txt`);
  fs.emptyTrash();
  assert.deepEqual(fs.list(TRASH), []);
});

test('every mutation emits fs:change with its operation', () => {
  const { fs, changes } = makeFs();
  fs.mkdir(`${HOME}/Pictures/new`);
  fs.write(`${HOME}/Pictures/new/p.txt`, 'x');
  assert.deepEqual(
    changes.map((change) => change.op),
    ['mkdir', 'write'],
  );
});

test('state survives a new instance on the same storage', () => {
  const storage = createStorage(null);
  const { fs } = makeFs(storage);
  fs.write(`${HOME}/Documents/Notes/Saved.txt`, 'kept');
  const reopened = createFileSystem({ storage, events: createEvents() });
  assert.equal(reopened.read(`${HOME}/Documents/Notes/Saved.txt`), 'kept');
});

test('reset restores the seed tree', () => {
  const { fs } = makeFs();
  fs.write(`${HOME}/Desktop/junk.txt`, '');
  fs.reset();
  assert.equal(fs.exists(`${HOME}/Desktop/junk.txt`), false);
  assert.equal(fs.exists(`${HOME}/Desktop/Welcome.txt`), true);
});

test('a failed save reports fs:error and keeps the change in memory', () => {
  const storage = { get: () => null, set: () => ({ ok: false, reason: 'quota' }), remove() {} };
  const events = createEvents();
  const errors = [];
  events.on('fs:error', (detail) => errors.push(detail.reason));
  const fs = createFileSystem({ storage, events });
  fs.write(`${HOME}/Desktop/big.txt`, 'x'.repeat(10));
  assert.deepEqual(errors, ['quota']);
  assert.equal(fs.read(`${HOME}/Desktop/big.txt`).length, 10);
});
