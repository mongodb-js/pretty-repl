const { stdio } = require('stdio-mock');
const { PassThrough } = require('stream');
const assert = require('assert');

const repl = require('..');
const memoizeStringTransformerMethod = require('../lib/memoize-string-transformer');

it('does not apply colors when not TTY', (done) => {
  process.stdout.isTTY = undefined;
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
      assert.equal(out, 'test-prompt > const foo = 12\n', 'output is not colored');
      done();
    }
  });
  prettyRepl._writeToOutput('test-prompt > const foo = 12\n');
});

it('applies colors when necessary', (done) => {
  process.stdout.isTTY = true;
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
      assert.equal(out, 'test-prompt > <color>const</color> foo = 12\n', 'output is colored');
      done();
    }
  });
  prettyRepl._writeToOutput('test-prompt > const foo = 12\n');
});

it('does not apply colors when not necessary', (done) => {
  process.stdout.isTTY = true;
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
      assert.equal(out, 'test-prompt > let foo = 12\n', 'output is not colored');
      done();
    }
  });
  prettyRepl._writeToOutput('test-prompt > let foo = 12\n');
});

it('picks colors independently of stdio', (done) => {
  process.stdout.isTTY = undefined;
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
      // eslint-disable-next-line no-control-regex
      assert.match(out, /(\x1b\[.*m)+let(\x1b\[.*m)+ foo = (\x1b\[.*m)+12(\x1b\[.*m)+/, 'output is colored');
      done();
    }
  });
  prettyRepl._writeToOutput('test-prompt > let foo = 12\n');
});

it('memoizeStringTransformerMethod', () => {
  let i = 0;
  const cachedFn = memoizeStringTransformerMethod(3, (str) => {
    // Intentionally use something that depends on external state to test
    // the caching functionality.
    return `${i++}: ${str}`;
  });
  assert.equal(cachedFn('foo'), '0: foo');
  assert.equal(cachedFn('foo'), '0: foo');
  assert.equal(cachedFn('bar'), '1: bar');
  assert.equal(cachedFn('baz'), '2: baz');
  assert.equal(cachedFn('qux'), '3: qux');
  assert.equal(cachedFn('foo'), '4: foo');
});

it('stripCompleteJSStructures', () => {
  const { stdin } = stdio();
  const output = new PassThrough();
  output.isTTY = true;
  output.getColorDepth = () => 8;
  const prettyRepl = repl.start({
    input: stdin,
    output: output
  });
  assert.equal(prettyRepl._stripCompleteJSStructures('{a: (x) => x.y = 1}'), '');
  assert.equal(prettyRepl._stripCompleteJSStructures('{x} `${unfinished'), ' `${unfinished');
  assert.equal(prettyRepl._stripCompleteJSStructures('{(x}'), '{(x}');
  assert.equal(prettyRepl._stripCompleteJSStructures(String.raw `"abc\"def"`), '');
  assert.equal(prettyRepl._stripCompleteJSStructures(String.raw `"abc\\"def"`), 'def"');
  assert.equal(prettyRepl._stripCompleteJSStructures(String.raw `"a\\\\bc\\"def"`), 'def"');
  assert.equal(prettyRepl._stripCompleteJSStructures('(function {}'), '(function ');
  assert.equal(prettyRepl._stripCompleteJSStructures('(function() {'), '(function() {');
  assert.equal(prettyRepl._stripCompleteJSStructures('(function() => {'), '(function() => {');
  assert.equal(prettyRepl._stripCompleteJSStructures('(function() => {}'), '(function => ');
  assert.equal(prettyRepl._stripCompleteJSStructures('a.b([{x:{y: {z:[0, 10]}}}, {p:"$x"},{q'), 'a.b([, ,{q');
});

it('findMatchingBracket', () => {
  const { stdin } = stdio();
  const output = new PassThrough();
  output.isTTY = true;
  output.getColorDepth = () => 8;
  const prettyRepl = repl.start({
    input: stdin,
    output: output
  });
  assert.equal(prettyRepl._findMatchingBracket('abc { def }', 4), 10);
  assert.equal(prettyRepl._findMatchingBracket('abc { def }', 10), 4);
  assert.equal(prettyRepl._findMatchingBracket('abc {( def }', 4), 11);
  assert.equal(prettyRepl._findMatchingBracket('abc {( def }', 5), -1);
  assert.equal(prettyRepl._findMatchingBracket('abc {( def }', 0), -1);
  assert.equal(prettyRepl._findMatchingBracket('abc {( def }', 11), 4);
  assert.equal(prettyRepl._findMatchingBracket('"(")', 0), 2);
  assert.equal(prettyRepl._findMatchingBracket('"(")', 1), -1);
  assert.equal(prettyRepl._findMatchingBracket('`${foo}`', 1), 6);
  assert.equal(prettyRepl._findMatchingBracket('(`${")"}`', 0), -1);
});

it('full pass-through test', (done) => {
  process.stdout.isTTY = undefined;
  const input = new PassThrough();
  const output = new PassThrough();
  output.isTTY = true;
  output.getColorDepth = () => 8;
  repl.start({
    prompt: 'test-prompt > ',
    input: input,
    output: output,
    terminal: true
  });
  let out = '';
  output.setEncoding('utf8').on('data', data => {
    out += data;
    if (out.endsWith('\n') && !out.startsWith('<done>')) {
      assert.equal(out, '\x1b[1G\x1b[0Jtest-prompt > \x1b[15Gle\b\b\x1b[36mlet\x1b[39m foo = \x1b[33m1\x1b[39m\x1b[33m2\x1b[39m\r\n');
      out = '<done>';
      done();
    }
  });
  input.write('let foo = 12\n');
});
