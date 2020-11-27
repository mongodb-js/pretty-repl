const test = require('tape');
const { stdio } = require('stdio-mock');
const decache = require('decache');
const { PassThrough } = require('stream');

const nodeMajorVersion = () => {
  const versionMatcher = process.version.match(/^v(\d{1,2})\.\d{1,2}\.\d{1,2}$/);
  return parseInt(versionMatcher && versionMatcher[1], 10);
};

test('loads the right module for the version of node', t => {
  t.plan(1);
  process.stdout.isTTY = true;
  const repl = require('..');
  const major = nodeMajorVersion();
  const { stdin, stdout } = stdio();
  const prettyRepl = repl.start({ input: stdin, output: stdout, terminal: true });
  if (major >= 13) {
    t.ok(prettyRepl.__prettyModuleLoaded.endsWith('pretty-repl.js'), 'pretty-repl loaded');
  } else if (major < 13 && major >= 11) {
    t.ok(prettyRepl.__prettyModuleLoaded.endsWith('pretty-repl-compat.js'), 'pretty-repl-compat (compatibility mode for old node versions) loaded');
  } else {
    t.notOk(prettyRepl.__prettyModuleLoaded, 'pretty-repl not loaded (old version of node)');
  }
  decache('..');
});

test('does not apply colors when not TTY', t => {
  t.plan(1);
  process.stdout.isTTY = undefined;
  const repl = require('..');
  const { stdin, stdout } = stdio();
  const prettyRepl = repl.start({
    prompt: 'test-prompt > ',
    input: stdin,
    output: stdout,
    colorize: str => str.replace(/const/, '<color>const</color>')
  });
  let out = '';
  stdout.on('data', data => {
    out += data;
    if (out.endsWith('\n')) {
      t.equal(out, 'test-prompt > const foo = 12\n', 'output is not colored');
    }
  });
  prettyRepl._writeToOutput('test-prompt > const foo = 12\n');
  decache('..');
});

test('applies colors when necesssary', t => {
  t.plan(1);
  process.stdout.isTTY = true;
  const repl = require('..');
  const { stdin, stdout } = stdio();
  const prettyRepl = repl.start({
    prompt: 'test-prompt > ',
    input: stdin,
    output: stdout,
    colorize: str => str.replace(/const/, '<color>const</color>'),
    terminal: true
  });
  let out = '';
  stdout.on('data', data => {
    out += data;
    if (out.endsWith('\n')) {
      if (nodeMajorVersion() >= 11) {
        return t.equal(out, 'test-prompt > <color>const</color> foo = 12\n', 'output is colored');
      }
      t.equal(out, 'test-prompt > const foo = 12\n', 'output is not colored (node version is too old)');
    }
  });
  prettyRepl._writeToOutput('test-prompt > const foo = 12\n');
  decache('..');
});

test('does not apply colors when not necesssary', t => {
  t.plan(1);
  process.stdout.isTTY = true;
  const repl = require('..');
  const { stdin, stdout } = stdio();
  const prettyRepl = repl.start({
    prompt: 'test-prompt > ',
    input: stdin,
    output: stdout,
    colorize: str => str.replace(/const/, '<color>const</color>')
  });
  let out = '';
  stdout.on('data', data => {
    out += data;
    if (out.endsWith('\n')) {
      t.equal(out, 'test-prompt > let foo = 12\n', 'output is not colored');
    }
  });
  prettyRepl._writeToOutput('test-prompt > let foo = 12\n');
  decache('..');
});

test('picks colors independently of stdio', {
  skip: nodeMajorVersion() < 12
}, t => {
  t.plan(1);
  process.stdout.isTTY = undefined;
  const repl = require('..');
  const { stdin } = stdio();
  const output = new PassThrough();
  output.isTTY = true;
  output.getColorDepth = () => 8;
  const prettyRepl = repl.start({
    prompt: 'test-prompt > ',
    input: stdin,
    output: output
  });
  let out = '';
  output.setEncoding('utf8').on('data', data => {
    out += data;
    if (out.endsWith('\n')) {
      t.match(out, /(\x1b\[.*m)+let(\x1b\[.*m)+ foo = (\x1b\[.*m)+12(\x1b\[.*m)+/, 'output is colored');
    }
  });
  prettyRepl._writeToOutput('test-prompt > let foo = 12\n');
  decache('..');
});
