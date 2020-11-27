const { Interface } = require('readline');
const repl = require('repl');
const ansi = require('ansi');
const highlight = require('./highlight');

const originalWriteToOutput = Interface.prototype._writeToOutput;
const originalInsertString = Interface.prototype._insertString;

Interface.prototype._writeToOutput = function (stringToWrite) {
  // If this particular instance does not have the `__pretty` flag
  // just call the original implementation of `_writeToOutput`.
  if (!this.__pretty) {
    return originalWriteToOutput.call(this, stringToWrite);
  }
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
    originalWriteToOutput.call(this, stringToWrite);
  }
};

Interface.prototype.renderCurrentLine = function (stringToWrite) {
  if (!this.ansiCursor) {
    return;
  }
  const promptLength = this._prompt.length;
  const cursorPos = this._getCursorPos();
  const nX = cursorPos.cols;
  this.ansiCursor.horizontalAbsolute(promptLength + 1).eraseLine().write(this.colorize(stringToWrite));
  this.ansiCursor.horizontalAbsolute(nX);
};

Interface.prototype._insertString = function (c) {
  // If this particular instance does not have the `__pretty` flag
  // just call the original implementation of `_insertString`.
  if (!this.__pretty) {
    return originalInsertString.call(this, c);
  }
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

module.exports = {
  REPLServer: repl.REPLServer,
  start: (prompt, source, eval_, useGlobal, ignoreUndefined, replMode) => {
    const replInstance = repl.start(prompt, source, eval_, useGlobal, ignoreUndefined, replMode);
    replInstance.colorize = (prompt && prompt.colorize) || highlight(prompt.output || process.stdout);
    replInstance.ansiCursor = ansi(prompt.output || process.stdout);
    replInstance.__pretty = true;
    // For some reason, tests fail if we don't initialize line to be the empty string.
    // Specifically, `REPLServer.Interface.getCursorPos()` finds itself in a state where `line`
    // is undefined.
    replInstance.line = '';
    replInstance.__prettyModuleLoaded = __filename;
    return replInstance;
  }
};
