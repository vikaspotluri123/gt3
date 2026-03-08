const assert = require('node:assert/strict');
const {describe, it} = require('node:test');

const {checkInitialization} = require('../../../../src/commands/_internal/check-initialization.js');
const {useConsoleSpy} = require('../../../util/console-spy.js');

describe('Unit > Commands > Internal > Check Initialization', () => {
	const consoleSpy = useConsoleSpy();

	describe('init', () => {
		const COMMAND = 'init';

		it('Proceeds when the theme does not support translations', () => {
			const canContinue = checkInitialization({locales: {}}, COMMAND);

			assert.equal(canContinue, true);
			consoleSpy.assertNoMessages();
		});
	});

	describe('non-init', () => {
		const COMMAND = 'find';

		it('Proceeds when the theme does supports translations', () => {
			const canContinue = checkInitialization({locales: {es: {}}}, COMMAND);

			assert.equal(canContinue, true);
			consoleSpy.assertNoMessages();
		});

		it('Fails when the theme does not support translations', () => {
			const canContinue = checkInitialization({locales: {}}, COMMAND);

			assert.equal(canContinue, false);
			consoleSpy.assertConsoleErrors([
				'Error: this theme does not support translations. Run `gt3 --init` to get started!',
			]);
		});
	});
});
