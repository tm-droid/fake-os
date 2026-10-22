import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFileSystem, HOME, TRASH } from '../js/kernel/fs.js';
import { createStorage } from '../js/kernel/storage.js';
import { createEvents } from '../js/kernel/events.js';
import { runCommand } from '../js/apps/terminal-engine.js';

function setup() {
  const fs = createFileSystem({ storage: createStorage(null), events: createEvents() });
  const opened = { apps: [], paths: [] };
  const session = {
    fs,
    cwd: HOME,
    openApp: (id) => opened.apps.push(id),
    openPath: (path) => opened.paths.push(path),
  };
  const run = (line) => runCommand(line, session);
  return { fs, session, run, opened };
}

test('ls lists folders first with a slash on folders', () => {
  const { run } = setup();
  assert.deepEqual(run('ls').lines, ['Desktop/  Documents/  Downloads/  Pictures/']);
});

test('ls prints nothing for an empty folder and the name for a file', () => {
  const { run } = setup();
  run('mkdir Empty');
  assert.deepEqual(run('ls Empty').lines, []);
  assert.deepEqual(run('ls Desktop/Welcome.txt').lines, ['Welcome.txt']);
});

test('pwd and cd move through folders', () => {
  const { run, session } = setup();
  assert.deepEqual(run('pwd').lines, [HOME]);
  assert.equal(run('cd Documents/Notes').error, false);
  assert.equal(session.cwd, `${HOME}/Documents/Notes`);
  assert.deepEqual(run('pwd').lines, [`${HOME}/Documents/Notes`]);
  run('cd ..');
  assert.equal(session.cwd, `${HOME}/Documents`);
  run('cd');
  assert.equal(session.cwd, HOME);
  run('cd ~/Documents');
  assert.equal(session.cwd, `${HOME}/Documents`);
});

test('cd reports missing folders and files without moving', () => {
  const { run, session } = setup();
  assert.deepEqual(run('cd nope'), {
    lines: [`cd: no such file or directory: ${HOME}/nope`],
    error: true,
    clear: false,
  });
  assert.equal(session.cwd, HOME);
  const notDir = run('cd Desktop/Welcome.txt');
  assert.equal(notDir.error, true);
  assert.deepEqual(notDir.lines, [`cd: not a directory: ${HOME}/Desktop/Welcome.txt`]);
  assert.equal(session.cwd, HOME);
});

test('mkdir creates folders and reports ones that exist', () => {
  const { run, fs } = setup();
  assert.equal(run('mkdir a b').error, false);
  assert.equal(fs.isDir(`${HOME}/a`), true);
  assert.equal(fs.isDir(`${HOME}/b`), true);
  const again = run('mkdir a');
  assert.equal(again.error, true);
  assert.deepEqual(again.lines, [`mkdir: file exists: ${HOME}/a`]);
});

test('touch creates missing files and leaves existing ones alone', () => {
  const { run, fs } = setup();
  fs.write(`${HOME}/keep.txt`, 'kept');
  assert.equal(run('touch keep.txt new.txt').error, false);
  assert.equal(fs.read(`${HOME}/keep.txt`), 'kept');
  assert.equal(fs.read(`${HOME}/new.txt`), '');
});

test('cat prints file lines and reports bad targets', () => {
  const { run } = setup();
  const out = run('cat Desktop/Welcome.txt');
  assert.equal(out.error, false);
  assert.equal(out.lines[0], 'Welcome to FakeOS.');
  assert.equal(run('cat nope.txt').error, true);
  assert.deepEqual(run('cat Desktop'), {
    lines: [`cat: is a directory: ${HOME}/Desktop`],
    error: true,
    clear: false,
  });
});

test('echo overwrites with > and appends with >>', () => {
  const { run, fs } = setup();
  run('echo hello world > greeting.txt');
  assert.equal(fs.read(`${HOME}/greeting.txt`), 'hello world\n');
  run('echo "second line" >> greeting.txt');
  assert.deepEqual(run('cat greeting.txt').lines, ['hello world', 'second line']);
  run('echo fresh > greeting.txt');
  assert.deepEqual(run('cat greeting.txt').lines, ['fresh']);
  run('echo tight>tight.txt');
  assert.equal(fs.read(`${HOME}/tight.txt`), 'tight\n');
});

test('echo keeps quoted words together and treats quoted > as text', () => {
  const { run, fs } = setup();
  assert.deepEqual(run("echo \"two  words\" 'x > y'").lines, ['two  words x > y']);
  assert.equal(fs.exists(`${HOME}/y`), false);
  assert.equal(run('echo "oops').error, true);
});

test('rm moves items to the Trash', () => {
  const { run, fs } = setup();
  run('touch doomed.txt');
  const out = run('rm doomed.txt');
  assert.equal(out.error, false);
  assert.equal(fs.exists(`${HOME}/doomed.txt`), false);
  assert.equal(fs.exists(`${TRASH}/doomed.txt`), true);
  assert.equal(run('rm missing.txt').error, true);
});

test('unknown commands print command not found', () => {
  const { run } = setup();
  assert.deepEqual(run('frobnicate now'), {
    lines: ['fakeos: command not found: frobnicate'],
    error: true,
    clear: false,
  });
});

test('open launches known apps and existing paths, and rejects unknown names', () => {
  const { run, opened } = setup();
  const bad = run('open nope');
  assert.equal(bad.error, true);
  assert.equal(opened.apps.length, 0);
  assert.equal(run('open notes').error, false);
  assert.deepEqual(opened.apps, ['notes']);
  assert.equal(run('open ~/Documents').error, false);
  assert.deepEqual(opened.paths, [`${HOME}/Documents`]);
});

test('clear, whoami and help', () => {
  const { run } = setup();
  assert.deepEqual(run('clear'), { lines: [], error: false, clear: true });
  assert.deepEqual(run('whoami').lines, ['guest']);
  assert.ok(run('help').lines.some((line) => line.startsWith('rm') && line.includes('Trash')));
});
