'use strict';
const repl = require('repl');
const highlight = require('./highlight');
const memoizeStringTransformerMethod = require('./memoize-string-transformer');
const ansiRegex = require('ansi-regex');
const stripAnsi = require('strip-ansi');

// Regex that matches all occurrences of ANSI escape sequences in a string.
const ansiRegexMatchAll = ansiRegex();
// Regex that matches ANSI escape sequences only at the beginning of a string.
const ansiRegexMatchBeginningOnly = new RegExp(`^(${ansiRegexMatchAll.source})`);

// Compute the length of the longest common prefix of 'before' and 'after',
// taking ANSI escape sequences into account. For example:
// 'abcd', 'abab' -> 2
// 'ab\x1b[3m', 'ab\x1b[5m' -> 2 (not 4)
function computeCommonPrefixLength(before, after) {
  let i = 0;
  while (i < Math.min(before.length, after.length) &&
         before[i] === after[i]) {
    const match = before.substr(i).match(ansiRegexMatchBeginningOnly);
    if (match && match.index === 0) {
      if (after.indexOf(match[0], i) === i) {
        // A matching ANSI escape sequence in both strings, add the length of it
        i += match[0].length;
      } else {
        // Non-matching ANSI escape sequence, treat as entirely different from here
        break;
      }
    } else {
      i++;
    }
  }
  return i;
}

// Count the number of Unicode codepoints in a string, i.e. [...str].length
// without the intermediate Array instance.
function characterCount(str) {
  let i, c;
  for (i = 0, c = 0; i < str.length; i++) {
    if (str.charCodeAt(i) >= 0xD800 && str.charCodeAt(i) < 0xDC00) {
      continue;
    }
    c++;
  }
  return c;
}

class PrettyREPLServer extends repl.REPLServer {
  constructor (options = {}) {
    super(options);
    options.output = options.output || process.stdout;
    this.colorize = (options && options.colorize) || highlight(options.output);
    this.lineBeforeInsert = undefined;

    // For some reason, tests fail if we don't initialize line to be the empty string.
    // Specifically, `REPLServer.Interface.getCursorPos()` finds itself in a state where `line`
    // is undefined.
    this.line = '';
    this.__prettyModuleLoaded = __filename;
  }

  _writeToOutput (stringToWrite) {
    // Skip false-y values, and if we print only whitespace or have not yet
    // been fully initialized, just write to output directly.
    if (!stringToWrite) return;
    if (stringToWrite.match(/^\s+$/) || !this.colorize) {
      this.output.write(stringToWrite);
      return;
    }

    // In this case, the method is being called from _insertString, which appends
    // a string to the end of the current line.
    if (this.lineBeforeInsert !== undefined && this.lineBeforeInsert + stringToWrite === this.line) {
      this._writeAppendedString(stringToWrite);
    } else if (stringToWrite.startsWith(this._prompt)) {
      this._writeFullLine(stringToWrite);
    } else {
      // In other situations, we don't know what to do and just do whatever
      // the Node.js REPL implementation itself does.
      super._writeToOutput(stringToWrite);
    }
  }

  _writeAppendedString(stringToWrite) {
    // First, we simplify whatever existing line structure is present in a
    // way that preserves highlighting of any subsequent part of the code.
    // The goal here is to reduce the amount of code that needs to be highlighted,
    // because this typically runs once for each character that is entered.
    const simplified = this._stripCompleteJSStructures(this.lineBeforeInsert);

    // Colorize the 'before' state.
    const before = this._doColorize(simplified);
    // Colorize the 'after' state, using the same simplification (this works because
    // `lineBeforeInsert + stringToWrite === line` implies that
    // `simplified       + stringToWrite` is a valid simplification of `line`,
    // and the former is a precondition for this method to be called).
    const after = this._doColorize(simplified + stringToWrite);

    // Find the first character or escape sequence that differs in `before` and `after`.
    const commonPrefixLength = computeCommonPrefixLength(before, after);

    // Gather all escape sequences that occur in the *common* part of the string.
    // Applying them all one after another puts the terminal into the state of the
    // highlighting at the divergence point.
    // (This makes the assumption that those escape sequences only affect formatting,
    // not e.g. cursor position, which seem like a reasonable assumption to make
    // for the output from a syntax highlighter).
    let ansiStatements = (before.slice(0, commonPrefixLength).match(ansiRegexMatchAll) || []);

    // Filter out any foreground color settings before the last reset (\x1b[39m).
    // This helps reduce the amount of useless clutter we write a bit, and in
    // particular helps the mongosh test suite not ReDOS itself when verifying
    // output coloring.
    const lastForegroundColorReset = ansiStatements.lastIndexOf('\x1b[39m');
    if (lastForegroundColorReset !== -1) {
      ansiStatements = ansiStatements.filter((sequence, index) => {
        // Keep escape sequences that come after the last full reset or modify
        // something other than the foreground color.
        return index > lastForegroundColorReset || !sequence.match(/^\x1b\[3\d.*m$/);
      });
    }

    // In order to get from `before` to `after`, we have to reduce the `before` state
    // back to the common prefix of the two. Do that by counting all the
    // non-escape-sequence characters in what comes after the common prefix
    // in `before`.
    const backtrackLength = characterCount(stripAnsi(before.slice(commonPrefixLength)));

    // Put it all together: Backtrack from `before` to the common prefix, apply
    // all the escape sequences that were present before, and then apply the
    // new output from `after`.
    this.output.write('\b'.repeat(backtrackLength) + ansiStatements.join('') + after.slice(commonPrefixLength));
  }

  _writeFullLine(stringToWrite) {
    // If the output starts with the prompt (which is when this method is called),
    // it's reasonable to assume that we're printing a full line (which happens
    // relatively frequently with the Node.js REPL).
    // In those cases, we split the string into prompt and non-prompt parts,
    // and colorize the full non-prompt part.
    stringToWrite = stringToWrite.substring(this._prompt.length);
    this.output.write(this._prompt + this._doColorize(stringToWrite));
  }

  _insertString (c) {
    this.lineBeforeInsert = this.line;
    try {
      return super._insertString (c);
    } finally {
      this.lineBeforeInsert = undefined;
    }
  }

  _doColorize = memoizeStringTransformerMethod(100, function(str) {
    return this.colorize(str);
  });

  _stripCompleteJSStructures(str) {
    // Remove substructures of the JS input string `str` in order to simplify it,
    // by repeatedly removing matching pairs of quotes and parentheses/brackets.
    let before;
    do {
      before = str;
      str = this._stripCompleteJSStructuresStep(before);
    } while (before !== str);
    return str;
  }

  _stripCompleteJSStructuresStep = memoizeStringTransformerMethod(10000, function(str) {
    // This regular expression matches:
    // - matching pairs of (), without any of ()[]{}`'" in between
    // - matching pairs of [], without any of ()[]{}`'" in between
    // - matching pairs of {}, without any of ()[]{}`'" in between
    // - matching pairs of '', with only non-'\, \\, and \' preceded by an even number of \ in between
    // - matching pairs of "", with only non-"\, \\, and \" preceded by an even number of \ in between
    // - matching pairs of ``, with only non-`{}\, \\ and \` preceded by an even number of \ in between
    const re = /\([^\(\)\[\]\{\}`'"]*\)|\[[^\(\)\[\]\{\}`'"]*\]|\{[^\(\)\[\]\{\}`'"]*\}|'([^'\\]|(?<=[^\\](\\\\)*)\\'|\\\\)*'|"([^"\\]|(?<=[^\\](\\\\)*)\\"|\\\\)*"|`([^\{\}`\\]|(?<=[^\\](\\\\)*)\\`|\\\\)*`/g;
    // Match the regexp against the input. If there are no matches, we can just return.
    const matches = [...str.matchAll(re)];
    if (matches.length === 0) {
      return str;
    }
    // Remove all but the last, non-nested pair of (), because () can affect
    // whether the previous word is seen as a keyword.
    // E.g.: When input is `function() {`, do not replace the ().
    //       When input is `{ foo(); }`, do replace the `()`, then afterwards the `{ ... }`.
    let startsReplaceIndex = matches.length - 1;
    const lastMatch = matches[matches.length - 1];
    if (lastMatch[0].startsWith('(') && !str.substr(lastMatch.index + lastMatch[0].length).match(/[\)\]\}`'"]/)) {
      startsReplaceIndex--;
    }
    for (let i = startsReplaceIndex; i >= 0; i--) {
      // Replace str1<match>str2 with str1str2. Go backwards so that the match
      // indices into the string remain valid.
      str = str.substr(0, matches[i].index) + str.substr(matches[i].index + matches[i][0].length);
    }
    return str;
  });
}

module.exports = {
  REPLServer: PrettyREPLServer,
  start: options => {
    return new PrettyREPLServer(options);
  }
};
