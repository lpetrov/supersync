const { argv } = require('./config');
const chalk = require('chalk');

// Store active sync operations
const activeSyncs = new Map();

function log(message) {
  if (argv.verbose) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }
}

function logImportant(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function getSpinner() {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const spinnerState = activeSyncs.get('spinner') || { frame: 0 };
  spinnerState.frame = (spinnerState.frame + 1) % frames.length;
  activeSyncs.set('spinner', spinnerState);
  return frames[spinnerState.frame];
}

function clearLine() {
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
}

function startSync(filepath, eventType) {
  if (argv.muteSyncs) return;

  const action = eventType === 'Add' ? 'adding' : 
                eventType === 'Change' ? 'updating' : 
                eventType === 'Delete' ? 'deleting' : 
                'syncing';

  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] ${chalk.yellow(getSpinner())} ${filepath} ${action}...`;
  
  activeSyncs.set(filepath, {
    interval: setInterval(() => {
      clearLine();
      process.stdout.write(
        `[${timestamp}] ${chalk.yellow(getSpinner())} ${filepath} ${action}...`
      );
    }, 80)
  });

  clearLine();
  process.stdout.write(message);
}

function endSync(filepath, eventType, success = true) {
  if (argv.muteSyncs) return;

  const syncState = activeSyncs.get(filepath);
  if (syncState) {
    clearInterval(syncState.interval);
    activeSyncs.delete(filepath);
  }

  const action = eventType === 'Add' ? 'added' : 
                eventType === 'Change' ? 'updated' : 
                eventType === 'Delete' ? 'deleted' : 
                'synced';

  const icon = success ? '✓' : '✗';
  const color = success ? chalk.green : chalk.red;
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] ${color(icon)} ${filepath} ${action}`;

  clearLine();
  console.log(message);
}

function logSync(filepath, eventType, success = true) {
  if (!argv.muteSyncs) {
    endSync(filepath, eventType, success);
  }
}

module.exports = {
  log,
  logImportant,
  logSync,
  startSync
}; 