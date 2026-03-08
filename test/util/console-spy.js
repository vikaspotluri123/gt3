const {mock, beforeEach, afterEach} = require('node:test');
const {formatWithOptions} = require('node:util');
const assert = require('node:assert/strict');

const NOOP = () => {};
const METHODS = [
  'log',
  'error',
];

/**
 * @param {import('node:test').TestContext}
 */
module.exports.useConsoleSpy = () => {
  beforeEach(() => {
    for (const method of METHODS) {
      const current = console[method];
      if (current.mock) {
        throw new Error('useConsoleSpy called multiple times');
      }

      mock.method(console, method, NOOP);
    }
  });

  afterEach(() => {
    for (const method of METHODS) {
      console[method].mock.restore();
    }
  });

  return {
    /**
     * @param {string[]} messages
     */
    assertConsoleErrors(messages) {
      assert.deepEqual(
        // Approximation of how console.error does serialization
        console.error.mock.calls.map(call => formatWithOptions({colors: false}, ...call.arguments).trim()),
        messages
      );
    }
  };
};