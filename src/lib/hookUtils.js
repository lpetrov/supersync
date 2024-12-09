const { exec } = require('child_process');
const { promisify } = require('util');
const { config, argv } = require('./config');
const { log } = require('./logger');

const execPromise = promisify(exec);

class HookUtils {
  constructor(context = {}) {
    this.context = context;
  }

  /**
   * Execute a local command
   * @param {string} command Command to execute
   * @returns {Promise<{stdout: string, stderr: string}>}
   */
  async local(command) {
    log(`Executing local command: ${command}`);
    try {
      const { stdout, stderr } = await execPromise(command);
      if (stdout) log(stdout);
      if (stderr) console.error(stderr);
      return { stdout, stderr };
    } catch (error) {
      console.error(`Error executing local command: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute a remote command via SSH
   * @param {string} command Command to execute
   * @returns {Promise<{stdout: string, stderr: string}>}
   */
  async remote(command) {
    const target = config.targets[argv.target] || argv.target;
    const [user, hostPath] = target.split(':');
    const portFlag = argv.port !== 22 ? `-p ${argv.port}` : '';
    
    const sshCommand = `ssh ${portFlag} ${user} "cd ${hostPath} && ${command}"`;
    log(`Executing remote command: ${sshCommand}`);
    
    try {
      const { stdout, stderr } = await execPromise(sshCommand);
      if (stdout) log(stdout);
      if (stderr) console.error(stderr);
      return { stdout, stderr };
    } catch (error) {
      console.error(`Error executing remote command: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get the current context
   * @returns {Object} The current hook context
   */
  getContext() {
    return this.context;
  }

  /**
   * Get configuration
   * @returns {Object} The current configuration
   */
  getConfig() {
    return config;
  }

  /**
   * Get command line arguments
   * @returns {Object} The command line arguments
   */
  getArgs() {
    return argv;
  }
}

module.exports = HookUtils; 