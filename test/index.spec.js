const test = require('tape');
const { stdio } = require('stdio-mock');
const repl = require('..');

const nodeMajorVersion = () => {
  const versionMatcher = process.version.match(/^v(\d{1,2})\.\d{1,2}\.\d{1,2}$/);
  return parseInt(versionMatcher && versionMatcher[1], 10);
};

test('loads the right module for the version of node', t => {
  t.plan(1);
  const major = nodeMajorVersion();
  if (major >= 13) {
    t.ok(repl._moduleLoaded.endsWith('pretty-repl.js'), 'pretty-repl loaded');
  } else if (major < 13 && major >= 11) {
    t.ok(repl._moduleLoaded.endsWith('pretty-repl-compat.js'), 'pretty-repl-compat (compatibility mode for old node versions) loaded');
  } else {
    t.notOk(repl._moduleLoaded, 'pretty-repl not loaded (old version of node)');
  }
});

test('applies colors when necesssary', t => {
  t.plan(1);
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
      if (nodeMajorVersion() >= 11) {
        return t.equal(out, 'test-prompt > <color>const</color> foo = 12\n', 'output is colored');
      }
      t.equal(out, 'test-prompt > const foo = 12\n', 'output is not colored (node version is too old)');
    }
  });
  prettyRepl._writeToOutput('test-prompt > const foo = 12\n');
});

test('does not apply colors when not necesssary', t => {
  t.plan(1);
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
});
