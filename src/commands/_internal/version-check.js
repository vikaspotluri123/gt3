// @ts-check

const {version, exit} = require('node:process');

// Version check - require at least 22 LTS for glob support
if (Number(version.split('.')[0].slice(1)) < 22) {
	console.error(`gt3 requires at least Node.js 22 LTS.\nYou are running ${version}`);
	exit(1);
}
