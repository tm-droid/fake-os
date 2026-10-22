// Terminal command engine. Pure logic: it works on the virtual disk through a session object, with no DOM.
import { HOME, resolve } from '../kernel/fs.js';

const APP_IDS = ['files', 'notes', 'terminal', 'calculator', 'paint', 'settings'];

const REASONS = {
  ENOENT: 'no such file or directory',
  ENOTDIR: 'not a directory',
  EISDIR: 'is a directory',
  EEXIST: 'file exists',
  EPERM: 'operation not permitted',
  EINVAL: 'invalid argument',
};

const HELP = [
  'help              show this list',
  'ls [path]         list a folder',
  'pwd               print the current folder',
  'cd [path]         change folder (no path goes home)',
  'cat <file>        print a file',
  'mkdir <name...>   create folders',
  'touch <name...>   create empty files that do not exist yet',
  'rm <path...>      move items to the Trash, like the Files app',
  'echo <text...>    print text (> file overwrites, >> file appends)',
  'open <name>       open an app (files, notes, terminal, ...) or a file or folder',
  'date              print the date and time',
  'whoami            print the user name',
  'clear             clear the screen',
];

const result = (lines, error = false, clear = false) => ({ lines, error, clear });
const ok = (lines = []) => result(lines);
const fail = (message) => result([message], true);

// Splits on whitespace. Single and double quotes group words, with no escapes.
// An unquoted > or >> becomes its own token so echo can redirect.
function tokenize(line) {
  const tokens = [];
  let word = null;
  let quote = null;
  const flush = () => {
    if (word !== null) tokens.push({ text: word, op: false });
    word = null;
  };
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
      else word += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      word = word ?? '';
    } else if (/\s/.test(ch)) {
      flush();
    } else if (ch === '>') {
      flush();
      const op = line[i + 1] === '>' ? '>>' : '>';
      tokens.push({ text: op, op: true });
      i += op.length - 1;
    } else {
      word = (word ?? '') + ch;
    }
  }
  if (quote) throw new Error('fakeos: unmatched quote');
  flush();
  return tokens;
}

// File text to output lines. A trailing newline does not add an empty line.
function linesOf(text) {
  if (text === '') return [];
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

// FsError messages look like "ENOENT: no such file or directory, '/path'".
function errorLine(command, err) {
  const reason = REASONS[err.code];
  if (!reason) return `${command}: ${err.message}`;
  const match = /, '(.*)'$/.exec(err.message) ?? / '(.*)'$/.exec(err.message);
  return `${command}: ${reason}${match ? `: ${match[1]}` : ''}`;
}

// Runs fn for each argument. Every failure prints its own line and the rest still run.
function eachArg(command, args, fn) {
  if (args.length === 0) return fail(`${command}: missing operand`);
  const lines = [];
  for (const arg of args) {
    try {
      fn(arg);
    } catch (err) {
      lines.push(errorLine(command, err));
    }
  }
  return result(lines, lines.length > 0);
}

// Each handler gets (args, session, tokens). Errors thrown from the disk are turned into lines by runCommand.
const COMMANDS = {
  help: () => ok([...HELP]),

  ls(args, s) {
    const target = resolve(s.cwd, args[0]);
    const info = s.fs.stat(target);
    if (info.type === 'file') return ok([info.name]);
    const names = s.fs.list(target).map((item) => (item.type === 'dir' ? `${item.name}/` : item.name));
    return ok(names.length ? [names.join('  ')] : []);
  },

  pwd: (args, s) => ok([s.cwd]),

  cd(args, s) {
    const target = args.length ? resolve(s.cwd, args[0]) : HOME;
    if (s.fs.stat(target).type !== 'dir') return fail(`cd: not a directory: ${target}`);
    s.cwd = target;
    return ok([]);
  },

  cat(args, s) {
    if (args.length === 0) return fail('cat: missing file operand');
    let lines = [];
    for (const arg of args) lines = lines.concat(linesOf(s.fs.read(resolve(s.cwd, arg))));
    return ok(lines);
  },

  mkdir: (args, s) => eachArg('mkdir', args, (arg) => s.fs.mkdir(resolve(s.cwd, arg))),

  touch: (args, s) =>
    eachArg('touch', args, (arg) => {
      const path = resolve(s.cwd, arg);
      if (!s.fs.exists(path)) s.fs.write(path, '');
    }),

  rm: (args, s) => eachArg('rm', args, (arg) => s.fs.trash(resolve(s.cwd, arg))),

  echo(args, s, tokens) {
    const at = tokens.findIndex((t) => t.op);
    const text = (at === -1 ? tokens : tokens.slice(0, at)).map((t) => t.text).join(' ');
    if (at === -1) return ok([text]);
    const target = tokens[at + 1];
    if (!target || target.op || tokens.length > at + 2) return fail('echo: syntax error near unexpected token');
    const path = resolve(s.cwd, target.text);
    const body = `${text}\n`;
    if (tokens[at].text === '>') {
      s.fs.write(path, body);
    } else {
      const prev = s.fs.exists(path) ? s.fs.read(path) : '';
      s.fs.write(path, prev === '' || prev.endsWith('\n') ? prev + body : `${prev}\n${body}`);
    }
    return ok([]);
  },

  open(args, s) {
    if (args.length === 0) return fail('open: missing operand');
    const [name] = args;
    if (APP_IDS.includes(name)) {
      s.openApp(name);
      return ok([]);
    }
    const path = resolve(s.cwd, name);
    if (s.fs.exists(path)) {
      s.openPath(path);
      return ok([]);
    }
    return fail(`open: no such file or application: ${name}`);
  },

  date: () => ok([new Date().toString()]),
  whoami: () => ok(['guest']),
  clear: () => result([], false, true),
};

// Runs one line. Updates session.cwd when cd succeeds.
export function runCommand(line, session) {
  let tokens;
  try {
    tokens = tokenize(String(line));
  } catch (err) {
    return fail(err.message);
  }
  if (tokens.length === 0) return ok([]);
  const name = tokens[0].text;
  if (!Object.hasOwn(COMMANDS, name)) return fail(`fakeos: command not found: ${name}`);
  const rest = tokens.slice(1);
  try {
    return COMMANDS[name](rest.map((t) => t.text), session, rest);
  } catch (err) {
    return fail(errorLine(name, err));
  }
}
