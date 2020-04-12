# Pretty REPL

![Node.js CI](https://github.com/mmarcon/pretty-repl/workflows/Node.js%20CI/badge.svg)

An extension of the Node REPL (`repl.REPLServer`) that applies syntax highlighting as the user types.

![Pretty REPL Screenshot](./images/screenshot.png)

## How to use it

Install the package:

```bash
$ npm install --save pretty-repl
```

Use the package:

```javascript
const repl = require('pretty-repl');

const options = {
    prompt: '→ '
};

repl.start(options);
```

`options` is an an object with the [same options](https://nodejs.org/api/repl.html#repl_repl_start_options) as `repl.REPLServer`.

Additionally, it's possible to pass an additional `colorize` property to the options object:

```javascript
{
    colorize: function (str) {
        // str is the the string in input.
        // the function should return the string that has been colorized to output in the REPL.
    }
}
```

## Known issues

* The implementation in Node.js versions 11 and 12, this module works by monkey-patching the Interface prototype (`readline` module).
If you use `readline` (or a module that depends on it) somewhere else, you may want to test everything thoroughly. In theory, there should be no side effects.
* For Node.js versions older than 11, this module does nothing.

## Credits

Pretty repl is inspired and includes code fragments from:
* https://github.com/nodejs/repl
* https://github.com/aantthony/node-color-readline
