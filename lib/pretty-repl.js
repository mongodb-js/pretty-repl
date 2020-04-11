const repl = require('repl');
const highlight = require('./highlight');
const ansi = require('ansi');

class PrettyREPLServer extends repl.REPLServer {
  constructor (options = {}) {
    super(options);
    this.colorize = (options && options.colorize) || function (str) {
      return highlight(str);
    };
    options.output = options.output || process.stdout;
    this.ansiCursor = ansi(options.output);
  }

  _writeToOutput (stringToWrite) {
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
      super._writeToOutput(stringToWrite);
    }
  }

  _insertString (c) {
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
  }

  renderCurrentLine (stringToWrite) {
    if (!this.ansiCursor) {
      return;
    }
    const promptLength = this._prompt.length;
    const cursorPos = this._getCursorPos();
    const nX = cursorPos.cols;
    this.ansiCursor.horizontalAbsolute(promptLength + 1).eraseLine().write(this.colorize(stringToWrite));
    this.ansiCursor.horizontalAbsolute(nX);
  }
}

module.exports = {
  PrettyREPLServer,
  start: options => {
    return new PrettyREPLServer(options);
  }
};
