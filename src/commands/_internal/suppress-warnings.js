// @ts-check

// Mask `glob` experimental warning
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'ExperimentalWarning' && warning.message.startsWith('glob')) {
    return;
  }

  console.log(`${warning.name}: ${warning.message}`);
});

module.exports = {};