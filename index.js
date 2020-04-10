const semver = require('semver');

// Functions that return the right implementation
// depending on the node version.
// They are functions rather than variables because we
// only want to execute the require if that's the right version to load.
// This way, we don't monkey-patch the Interface prototype of the readline
// module for nothing.
const prettyReplUnsupported = () => require('repl');
const prettyReplNode12 = () => require('./lib/pretty-repl-compat');
const prettyRepl = () => require('./lib/pretty-repl');

module.exports = semver.lt(process.version, '11.0.0') ? prettyReplUnsupported()
  : semver.lt(process.version, '13.0.0') ? prettyReplNode12() : prettyRepl();
