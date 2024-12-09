/**
 * Example JavaScript hooks for SuperSync
 * This file demonstrates various hook implementations using JavaScript functions
 */

module.exports = {
  // Before initial sync starts
  async beforeSync(context, utils) {
    // Build project before sync
    await utils.local('npm run build');
    
    // Stop remote application
    await utils.remote('pm2 stop app');
    
    console.log('Prepared for sync:', utils.getContext());
  },

  // After initial sync completes
  async afterSync(context, utils) {
    // Install dependencies and restart app
    await utils.remote('npm install --production');
    await utils.remote('pm2 restart app');
    
    // Send notification
    await utils.local('notify-send "Sync completed"');
  },

  // Before adding a new file
  async beforeFileAdd(context, utils) {
    const { filepath } = context;
    
    // Run linting before adding file
    if (filepath.endsWith('.js')) {
      await utils.local(`eslint ${filepath}`);
    }
    
    // Ensure remote directory exists
    const dirpath = require('path').dirname(filepath);
    await utils.remote(`mkdir -p ${dirpath}`);
  },

  // After adding a new file
  async afterFileAdd(context, utils) {
    const { filepath } = context;
    console.log(`Added file: ${filepath}`);
    
    // Update remote file permissions
    await utils.remote(`chmod 644 ${filepath}`);
  },

  // Before changing a file
  async beforeFileChange(context, utils) {
    const { filepath } = context;
    
    // Backup the remote file before changing
    await utils.remote(`cp ${filepath} ${filepath}.bak`);
  },

  // After changing a file
  async afterFileChange(context, utils) {
    const { filepath } = context;
    
    // Clear cache if config changed
    if (filepath.includes('config')) {
      await utils.remote('rm -rf /tmp/cache/*');
      await utils.remote('pm2 reload app');
    }
  },

  // Before deleting a file
  async beforeFileDelete(context, utils) {
    const { filepath } = context;
    
    // Backup file before deletion
    await utils.remote(`cp ${filepath} /backup/${filepath}`);
  },

  // After deleting a file
  async afterFileDelete(context, utils) {
    const { filepath } = context;
    console.log(`Deleted file: ${filepath}`);
  },

  // Before exiting the program
  async beforeExit(context, utils) {
    // Cleanup and final checks
    await utils.remote('npm run cleanup');
    await utils.local('echo "Sync completed at $(date)" >> sync.log');
  }
}; 