const assert = require('assert');
const { WINDOWS_SET_CLIPBOARD_COMMAND } = require('./clipboard-bridge');

assert(
  WINDOWS_SET_CLIPBOARD_COMMAND.includes('[Console]::InputEncoding = [System.Text.Encoding]::UTF8'),
  'Windows clipboard bridge must read stdin as UTF-8 to preserve Chinese text'
);
assert(
  WINDOWS_SET_CLIPBOARD_COMMAND.includes('[Console]::In.ReadToEnd()'),
  'Windows clipboard bridge should read clipboard text from stdin'
);

console.log('clipboard bridge tests passed');
