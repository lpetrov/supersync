const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const { config, argv } = require('./config');
const { log } = require('./logger');
const HookUtils = require('./hookUtils');

const execPromise = promisify(exec);

// Replace variables in command string with actual values
function replaceVariables(command, context = {}) {
  return command.replace(/\$\{([^}]+)\}/g, (match, variable) => {
    return context[variable] || match;
  }).replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, variable) => {
    return context[variable] || match;
  });
}

// Execute a local command
async function executeLocalCommand(command, context = {}) {
  if (!command) return;
  
  const processedCommand = replaceVariables(command, context);
  log(`Executing local command: ${processedCommand}`);
  
  try {
    const { stdout, stderr } = await execPromise(processedCommand);
    if (stdout) log(stdout);
    if (stderr) console.error(stderr);
  } catch (error) {
    console.error(`Error executing local command: ${error.message}`);
    throw error;
  }
}

// Execute a remote command via SSH
async function executeRemoteCommand(command, context = {}) {
  if (!command) return;
  
  const processedCommand = replaceVariables(command, context);
  const target = config.targets[argv.target] || argv.target;
  const [user, hostPath] = target.split(':');
  const portFlag = argv.port !== 22 ? `-p ${argv.port}` : '';
  
  const sshCommand = `ssh ${portFlag} ${user} "cd ${hostPath} && ${processedCommand}"`;
  log(`Executing remote command: ${sshCommand}`);
  
  try {
    const { stdout, stderr } = await execPromise(sshCommand);
    if (stdout) log(stdout);
    if (stderr) console.error(stderr);
  } catch (error) {
    console.error(`Error executing remote command: ${error.message}`);
    throw error;
  }
}

// Load JavaScript hooks file if it exists
function loadJsHooks() {
  const hooksPath = path.join(process.cwd(), 'remoteSync.hooks.js');
  try {
    if (fs.existsSync(hooksPath)) {
      log('Loading JavaScript hooks from remoteSync.hooks.js');
      return require(hooksPath);
    }
  } catch (error) {
    console.error('Error loading JavaScript hooks:', error);
  }
  return null;
}

// Execute a hook if it exists
async function executeHook(hookName, context = {}) {
  // Add hook type to context
  const hookContext = {
    ...context,
    hookName,
    hookType: hookName.replace(/^(before|after)/, '').toLowerCase(),
    timestamp: new Date().toISOString()
  };

  // Try JavaScript hooks first
  const jsHooks = loadJsHooks();
  if (jsHooks && typeof jsHooks[hookName] === 'function') {
    log(`Executing JavaScript ${hookName} hook`);
    try {
      const utils = new HookUtils(hookContext);
      await jsHooks[hookName](hookContext, utils);
      return;
    } catch (error) {
      console.error(`Error in JavaScript hook ${hookName}:`, error);
      throw error;
    }
  }

  // Fall back to configuration hooks
  const hook = config.hooks?.[hookName];
  if (!hook) return;

  log(`Executing ${hookName} hook`);
  
  if (typeof hook === 'string') {
    // Single command
    await executeLocalCommand(hook, hookContext);
  } else if (Array.isArray(hook)) {
    // Array of commands
    for (const cmd of hook) {
      if (typeof cmd === 'string') {
        await executeLocalCommand(cmd, hookContext);
      } else if (cmd.local) {
        await executeLocalCommand(cmd.local, hookContext);
      } else if (cmd.remote) {
        await executeRemoteCommand(cmd.remote, hookContext);
      }
    }
  } else if (typeof hook === 'object') {
    // Object with local/remote commands
    if (hook.local) await executeLocalCommand(hook.local, hookContext);
    if (hook.remote) await executeRemoteCommand(hook.remote, hookContext);
  }
}

module.exports = {
  executeHook
}; 