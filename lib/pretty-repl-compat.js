const { Interface } = require('readline');
const repl = require('repl');
const ansi = require('ansi');
const highlight = require('./highlight');

const originalStart = repl.start;
let ansiCursor;
let colorize = str => highlight(str);

Interface.prototype._writeToOutput = function (stringToWrite) {
  if (stringToWrite === '\r\n' || stringToWrite === ' ') {
    this.output.write(stringToWrite);
    return;
  }
  if (!stringToWrite) return;

  const startsWithPrompt = stringToWrite.indexOf(this._prompt) === 0;
  if (startsWithPrompt) {
    this.output.write(this._prompt);
    stringToWrite = stringToWrite.substring(this._prompt.length);
    this.renderCurrentLine(stringToWrite);
  } else {
    this._writeToOutput(stringToWrite);
  }
};

Interface.prototype.renderCurrentLine = function (stringToWrite) {
  if (!ansiCursor) {
    return;
  }
  const promptLength = this._prompt.length;
  const cursorPos = this._getCursorPos();
  const nX = cursorPos.cols;
  ansiCursor.horizontalAbsolute(promptLength + 1).eraseLine().write(colorize(stringToWrite));
  ansiCursor.horizontalAbsolute(nX);
};

Interface.prototype._insertString = function (c) {
  if (this.cursor < this.line.length) {
    const beg = this.line.slice(0, this.cursor);
    const end = this.line.slice(this.cursor, this.line.length);
    this.line = beg + c + end;
    this.cursor += c.length;
    this._refreshLine();
  } else {
    this.line += c;
    this.cursor += c.length;
    this._refreshLine();
    this._moveCursor(0);
  }
};

repl.start = function (prompt, source, eval_, useGlobal, ignoreUndefined, replMode) {
  if (prompt && prompt.colorize) {
    colorize = prompt.colorize;
  }
  ansiCursor = ansi(prompt.output || process.stdout);
  originalStart(prompt, source, eval_, useGlobal, ignoreUndefined, replMode);
};

module.exports = repl;
