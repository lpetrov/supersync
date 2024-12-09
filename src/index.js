#!/usr/bin/env node

const chokidar = require('chokidar');
const { argv } = require('./lib/config');
const { log, logImportant } = require('./lib/logger');
const { executeHook } = require('./lib/hooks');
const { getIgnorePatterns } = require('./lib/ignore');
const { SyncQueue, initialSync } = require('./lib/sync');

let syncQueue;

function syncFile(filepath, eventType) {
  return syncQueue.add(filepath, eventType).catch(error => {
    // Error already logged in queue processing
  });
}

async function main() {
  logImportant('Starting remotesync, initializing...');
  log(`Target: ${argv.target}`);
  log(`Port: ${argv.port}`);
  log(`Max parallel transfers: ${argv.maxParallel}`);
  log(`Remote deletion: ${argv.deleteRemote ? 'enabled' : 'disabled'}`);
  
  const ignorePatterns = await getIgnorePatterns();
  if (argv.verbose) {
    log('Using ignore patterns:');
    ignorePatterns.forEach(pattern => log(`  - ${pattern}`));
  }

  // Initialize sync queue with ignore patterns
  syncQueue = new SyncQueue(argv.maxParallel, ignorePatterns);

  await initialSync(ignorePatterns);
  
  logImportant('Starting file watcher...');

  const watcher = chokidar.watch('.', {
    ignored: ignorePatterns,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100
    }
  });

  watcher
    .on('add', filepath => {
      log(`File ${filepath} has been added`);
      syncFile(filepath, 'Add');
    })
    .on('change', filepath => {
      log(`File ${filepath} has been changed`);
      syncFile(filepath, 'Change');
    })
    .on('unlink', filepath => {
      log(`File ${filepath} has been removed`);
      syncFile(filepath, 'Delete');
    })
    .on('error', error => {
      console.error(`Watcher error: ${error}`);
    });
}

// Handle process termination
process.on('SIGINT', async () => {
  logImportant('\nStopping remotesync...');
  await executeHook('beforeExit');
  process.exit(0);
});

// Start the application
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 