const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const micromatch = require('micromatch');
const { config, argv } = require('./config');
const { log, logImportant, logSync, startSync } = require('./logger');
const { executeHook } = require('./hooks');

const execPromise = promisify(exec);
const existsPromise = promisify(fs.exists);

// Check if a file should be ignored based on patterns
function shouldIgnore(filepath, ignorePatterns) {
  const normalizedPath = filepath.replace(/\\/g, '/');
  return micromatch.isMatch(normalizedPath, ignorePatterns, {
    dot: true,
    matchBase: true
  });
}

// Build exclude patterns for rsync
function buildExcludePatterns(patterns) {
  return patterns.map(pattern => {
    return pattern
      .replace(/\*\*/g, '*')
      .replace(/^\//, '')
      .replace(/\/$/, '');
  });
}

// Build rsync command with common options
function buildRsyncCommand(source, target, options = {}) {
  const portFlag = argv.port !== 22 ? `-e "ssh -p ${argv.port}"` : '';
  const verboseFlag = argv.verbose ? '-v' : '';
  const deleteFlag = options.delete ? '--delete' : '';
  const excludeArgs = options.excludePatterns ? 
    options.excludePatterns.map(pattern => `--exclude='${pattern}'`).join(' ') : '';
  const progressFlag = options.showProgress ? '--progress' : '';

  return `rsync -az ${verboseFlag} ${progressFlag} ${portFlag} ${deleteFlag} ${excludeArgs} ${source} ${target}`;
}

// Delete a file on the remote server
async function deleteRemoteFile(filepath) {
  const target = config.targets[argv.target] || argv.target;
  const [user, hostPath] = target.split(':');
  const portFlag = argv.port !== 22 ? `-p ${argv.port}` : '';
  const remotePath = path.join(hostPath, filepath);
  
  const command = `ssh ${portFlag} ${user} "rm -f '${remotePath}'"`;
  log(`Executing: ${command}`);
  
  try {
    const { stdout, stderr } = await execPromise(command);
    if (stdout && argv.verbose) console.log(stdout);
    if (stderr) console.error(stderr);
    return true;
  } catch (error) {
    console.error(`Error deleting remote file: ${error}`);
    return false;
  }
}

// Queue system for managing parallel rsync commands
class SyncQueue {
  constructor(maxParallel, ignorePatterns) {
    this.maxParallel = maxParallel;
    this.ignorePatterns = ignorePatterns;
    this.running = 0;
    this.queue = new Map(); // Map of filepath -> array of operations
    this.inProgress = new Set(); // Set of files currently being processed
  }

  add(filepath, eventType) {
    return new Promise((resolve, reject) => {
      if (shouldIgnore(filepath, this.ignorePatterns)) {
        log(`Skipping ignored file: ${filepath}`);
        resolve();
        return;
      }

      // Create queue for this file if it doesn't exist
      if (!this.queue.has(filepath)) {
        this.queue.set(filepath, []);
      }

      // Add operation to file's queue
      this.queue.get(filepath).push({
        eventType,
        resolve,
        reject
      });

      this.processQueue();
    });
  }

  async processQueue() {
    // Process each file's queue
    for (const [filepath, operations] of this.queue.entries()) {
      // Skip if file is already being processed
      if (this.inProgress.has(filepath)) {
        continue;
      }

      // Skip if we've reached max parallel operations
      if (this.running >= this.maxParallel) {
        break;
      }

      // Skip if no operations for this file
      if (operations.length === 0) {
        this.queue.delete(filepath);
        continue;
      }

      // Process next operation for this file
      const operation = operations.shift();
      this.running++;
      this.inProgress.add(filepath);

      try {
        await this.processOperation(filepath, operation);
      } finally {
        this.running--;
        this.inProgress.delete(filepath);

        // If more operations for this file, process them later
        if (operations.length === 0) {
          this.queue.delete(filepath);
        }

        // Continue processing queue
        setImmediate(() => this.processQueue());
      }
    }
  }

  async processOperation(filepath, operation) {
    const { eventType, resolve, reject } = operation;

    try {
      const hookName = `beforeFile${eventType}`;
      await executeHook(hookName, { filepath });

      // Handle file deletion
      if (eventType === 'Delete') {
        if (argv.deleteRemote) {
          startSync(filepath, eventType);
          const success = await deleteRemoteFile(filepath);
          logSync(filepath, eventType, success);
        } else {
          log(`Skipping remote deletion of ${filepath} (deleteRemote is disabled)`);
        }
        resolve();
        return;
      }

      // For Add/Change operations, check if file still exists
      const localPath = path.resolve(filepath);
      const fileExists = await existsPromise(localPath);
      
      if (!fileExists) {
        if (eventType === 'Add') {
          // For Add operations, if file doesn't exist, it was probably deleted right after creation
          log(`Warning: File ${filepath} was created but no longer exists, skipping sync`);
          logSync(filepath, 'Skip', true);
          resolve();
          return;
        } else {
          // For other operations, treat as an error
          throw new Error(`File ${filepath} does not exist`);
        }
      }

      const target = config.targets[argv.target] || argv.target;
      
      const command = buildRsyncCommand(
        `"${localPath}"`,
        `"${target}/${path.dirname(filepath)}/"`,
        { 
          showProgress: true,
          excludePatterns: buildExcludePatterns(this.ignorePatterns)
        }
      );
      
      log(`Syncing file: ${filepath}`);
      log(`Executing: ${command} (${this.running}/${this.maxParallel} active)`);

      startSync(filepath, eventType);

      const { stdout, stderr } = await execPromise(command);
      
      if (stdout && argv.verbose) {
        console.log(stdout);
      }
      
      if (stderr) {
        // Check if the error is due to missing file
        if (stderr.includes('No such file or directory') && eventType === 'Add') {
          log(`Warning: File ${filepath} was created but no longer exists, skipping sync`);
          logSync(filepath, 'Skip', true);
          resolve();
          return;
        }
        console.error(`Warning while syncing ${filepath}:`, stderr);
        logSync(filepath, eventType, false);
      } else {
        log(`Successfully synced ${filepath}`);
        logSync(filepath, eventType, true);
      }
      
      const afterHookName = `afterFile${eventType}`;
      await executeHook(afterHookName, { filepath });
      
      resolve();
    } catch (error) {
      // Handle missing file errors gracefully for Add operations
      if (eventType === 'Add' && 
          (error.code === 'ENOENT' || error.message.includes('No such file'))) {
        log(`Warning: File ${filepath} was created but no longer exists, skipping sync`);
        logSync(filepath, 'Skip', true);
        resolve();
        return;
      }

      console.error(`Error syncing ${filepath}:`, error);
      logSync(filepath, eventType, false);
      reject(error);
    }
  }
}

// Perform initial sync using rsync
async function initialSync(ignorePatterns) {
  logImportant('Starting initial file synchronization...');
  
  try {
    await executeHook('beforeSync');
    
    const target = config.targets[argv.target] || argv.target;
    const excludePatterns = buildExcludePatterns(ignorePatterns);
    
    const command = buildRsyncCommand(
      './',
      `${target}/`,
      {
        delete: argv.delete,
        excludePatterns,
        showProgress: true
      }
    );
    
    log(`Executing rsync command: ${command}`);
    startSync('.', 'Sync');
    
    const { stdout, stderr } = await execPromise(command);
    
    if (stdout) {
      const lines = stdout.split('\n');
      if (!argv.verbose && lines.length > 0) {
        const lastLine = lines[lines.length - 1];
        if (lastLine.trim()) {
          logImportant(lastLine);
        }
      } else if (argv.verbose) {
        console.log(stdout);
      }
    }
    
    if (stderr) {
      console.error('Rsync warnings:', stderr);
      logSync('.', 'Sync', false);
    } else {
      logSync('.', 'Sync', true);
    }
    
    logImportant('Initial synchronization completed successfully');
    await executeHook('afterSync');
  } catch (error) {
    console.error('Error during initial sync:', error);
    logSync('.', 'Sync', false);
    throw error;
  }
}

module.exports = {
  SyncQueue,
  initialSync,
  shouldIgnore
}; 