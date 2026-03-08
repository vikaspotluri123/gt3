const {mock, beforeEach, afterEach} = require('node:test');
const {formatWithOptions} = require('node:util');
const assert = require('node:assert/strict');

const NOOP = () => {};
const METHODS = ['log', 'error'];

/**
 * @param {import('node:test').MockFunctionCall<unknown>} call
 */
function formatCall(call) {
	// Approximation of how the console logger does serialization
	return formatWithOptions({colors: false}, ...call.arguments).trim();
}

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
		assertConsoleLog(messages) {
			assert.deepEqual(console.log.mock.calls.map(formatCall), messages);
		},
		/**
		 * @param {string[]} messages
		 */
		assertConsoleErrors(messages) {
			assert.deepEqual(console.error.mock.calls.map(formatCall), messages);
		},

		assertNoMessages() {
			const allMessages = METHODS.flatMap((method) => console[method].mock.calls.map(formatCall));
			// Prefer deepEqual over length comparison so the errors have more context
			assert.deepEqual(allMessages, []);
		},
	};
};
