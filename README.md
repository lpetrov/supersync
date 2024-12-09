# SuperSync

[![CI](https://github.com/lpetrov/supersync/workflows/CI/badge.svg)](https://github.com/lpetrov/supersync/actions)
[![npm version](https://badge.fury.io/js/supersync.svg)](https://www.npmjs.com/package/supersync)
[![codecov](https://codecov.io/gh/lpetrov/supersync/branch/main/graph/badge.svg)](https://codecov.io/gh/lpetrov/supersync)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/node/v/supersync)](https://nodejs.org)
[![Downloads](https://img.shields.io/npm/dm/supersync.svg)](https://www.npmjs.com/package/supersync)

A Node.js tool that watches a local directory and automatically syncs changes to a remote SSH destination using rsync.

## Features

- Real-time file watching and syncing
- Efficient rsync-based file transfer
- Support for SSH/rsync remote destinations
- Configurable SSH port
- Configuration file support with named targets
- Customizable ignore patterns with .gitignore support
- Parallel transfer control
- Verbose logging mode
- Ignores common unnecessary files (dot files, node_modules, logs)
- Customizable hooks for file events and sync operations

## Installation

```bash
npm install -g supersync
```

Or install locally in your project:

```bash
npm install supersync
```

## Usage

Basic usage:

```bash
supersync --target user@host:/path/to/remote/dir
```

With custom SSH port:

```bash
supersync --target user@host:/path/to/remote/dir --port 2222
```

With verbose logging:

```bash
supersync --target user@host:/path/to/remote/dir --verbose
```

Limit parallel transfers:

```bash
supersync --target user@host:/path/to/remote/dir --max-parallel 5
```

Delete extraneous files on remote during initial sync:

```bash
supersync --target user@host:/path/to/remote/dir --delete
```

Include .gitignore patterns:

```bash
supersync --target user@host:/path/to/remote/dir --use-gitignore
```

### Configuration

You can create a `.supersyncrc` file in your project root or home directory to configure named targets, ignore patterns, and other settings:

```json
{
  "targets": {
    "prod": "user@production:/var/www/app",
    "staging": "user@staging:/var/www/app"
  },
  "ignore": [
    "/(^|[\/\\])\../",
    "/node_modules/",
    "**/*.log",
    "dist/*",
    "*.tmp"
  ],
  "maxParallel": 10,
  "useGitignore": true,
  "muteSyncs": false,
  "hooks": {
    "beforeSync": "echo 'Starting sync'",
    "afterSync": {
      "local": "echo 'Local sync complete'",
      "remote": "echo 'Remote sync complete'"
    }
  }
}
```

Then use named targets:

```bash
supersync --target prod
```

### Hooks

The tool supports hooks that are executed at specific points during the synchronization process. Hooks can be used to run commands both locally and on the remote server.

#### Available Hooks

- `beforeSync`: Executed before the initial sync starts
- `afterSync`: Executed after the initial sync completes
- `beforeFileAdd`: Executed before a new file is synced
- `afterFileAdd`: Executed after a new file is synced
- `beforeFileChange`: Executed before a modified file is synced
- `afterFileChange`: Executed after a modified file is synced
- `beforeFileDelete`: Executed before a file is deleted (if implemented)
- `afterFileDelete`: Executed after a file is deleted (if implemented)
- `beforeExit`: Executed before the program exits

#### Hook Configuration

Hooks can be defined in three ways:

1. Simple string command (runs locally):
```json
{
  "hooks": {
    "beforeSync": "echo 'Starting sync'"
  }
}
```

2. Object with local/remote commands:
```json
{
  "hooks": {
    "afterSync": {
      "local": "echo 'Local sync complete'",
      "remote": "pm2 restart app"
    }
  }
}
```

3. Array of commands (executed in sequence):
```json
{
  "hooks": {
    "beforeFileAdd": [
      "echo 'Adding file'",
      { "local": "npm run lint ${filepath}" },
      { "remote": "mkdir -p $(dirname ${filepath})" }
    ]
  }
}
```

#### Available Variables

Hooks can use variables that are replaced with actual values:

- `${filepath}`: Path of the file being processed (relative to workspace)
- `${hookName}`: Name of the current hook (e.g., "beforeSync")
- `${hookType}`: Type of the hook without before/after prefix (e.g., "sync", "fileAdd")
- `${timestamp}`: Current timestamp in ISO format

Variables can be used with both `${variable}` and `$variable` syntax.

#### Example Use Cases

1. Build before sync:
```json
{
  "hooks": {
    "beforeSync": "npm run build"
  }
}
```

2. Restart application after sync:
```json
{
  "hooks": {
    "afterSync": {
      "remote": "pm2 restart app"
    }
  }
}
```

3. Validate files before adding:
```json
{
  "hooks": {
    "beforeFileAdd": [
      { "local": "eslint ${filepath}" },
      { "local": "prettier --check ${filepath}" }
    ]
  }
}
```

4. Create directories and set permissions:
```json
{
  "hooks": {
    "beforeFileAdd": {
      "remote": [
        "mkdir -p $(dirname ${filepath})",
        "chmod 755 $(dirname ${filepath})"
      ]
    }
  }
}
```

5. Notify on changes:
```json
{
  "hooks": {
    "afterFileChange": {
      "local": "notify-send 'File ${filepath} updated'",
      "remote": "echo '${timestamp}: ${filepath} updated' >> /var/log/sync.log"
    }
  }
}
```

### Options

- `--target`, `-t`: Target name from config or SSH URI (required)
- `--port`, `-p`: SSH port number (default: 22)
- `--max-parallel`, `-m`: Maximum number of parallel sync commands (default: 10)
- `--delete`, `-d`: Delete extraneous files from destination during initial sync (default: false)
- `--use-gitignore`, `-g`: Include .gitignore patterns in the ignore list (default: true)
- `--verbose`, `-v`: Enable verbose logging (default: false)
- `--mute-syncs`: Mute file sync notifications (default: false)
- `--help`: Show help

## Requirements

- Node.js 12.0 or higher
- SSH access to the remote destination
- Rsync installed on both local and remote machines

## Development

To develop and test the package locally:

1. Clone the repository:
```bash
git clone <repository-url>
cd supersync
```

2. Install dependencies:
```bash
npm install
```

3. Link the package globally:
```bash
npm link
```

This creates a symbolic link from the global `node_modules` to your local development directory.

4. Now you can run the command from anywhere:
```bash
supersync --target your-target
```

To unlink when done:
```bash
npm unlink -g supersync
```

Alternatively, use the dev script:
```bash
npm run dev -- --target your-target
```

## How it Works

SuperSync uses Chokidar to watch for file system changes in the current directory and its subdirectories. When a file is added or modified, it automatically syncs the changes to the specified remote destination using rsync.

### File Synchronization

The tool uses rsync for all file transfer operations:

1. Initial Sync:
   - Performs a full directory sync when starting
   - Uses rsync's efficient delta-transfer algorithm
   - Only transfers new or modified files
   - Preserves file attributes (permissions, timestamps, etc.)
   - Optionally removes extraneous files (with --delete flag)

2. Individual File Changes:
   - Uses rsync for syncing individual file changes
   - Automatically creates necessary directories
   - Preserves file attributes
   - Compresses data during transfer
   - Shows progress in verbose mode

### Parallel Transfers

The tool implements a queue system to control the number of parallel rsync transfers, preventing system overload when many files change simultaneously. By default, it allows up to 10 parallel transfers, but this can be configured through the command line or configuration file.

### Ignored Files

The tool uses a comprehensive ignore system combining:
- Built-in default ignores
- Configuration-based ignores from `.supersyncrc`
- Optional .gitignore patterns (when --use-gitignore is enabled)

This ensures that unnecessary files are not synced while providing flexibility to customize ignore patterns for your specific needs.

### JavaScript Hooks

In addition to configuration-based hooks, you can create a `supersync.hooks.js` file in your project root to define hooks using JavaScript functions. This provides more flexibility and control over the hook behavior.

#### Hook Function Interface

Each hook function receives two parameters:
1. `context` - Object containing information about the current operation
2. `utils` - Utility object for executing commands and accessing configuration

```javascript
module.exports = {
  async beforeSync(context, utils) {
    // Hook implementation
  }
};
```

#### Available Utilities

The `utils` object provides the following methods:

- `utils.local(command)` - Execute a local command
- `utils.remote(command)` - Execute a remote command via SSH
- `utils.getContext()` - Get the current hook context
- `utils.getConfig()` - Get the current configuration
- `utils.getArgs()` - Get command line arguments

#### Hook Context

The context object contains:

- `filepath` - Path of the file being processed (for file operations)
- `hookName` - Name of the current hook (e.g., "beforeSync")
- `hookType` - Type of the hook without before/after prefix
- `timestamp` - Current timestamp in ISO format

#### Example JavaScript Hooks

Create a `supersync.hooks.js` file:

```javascript
module.exports = {
  // Build and prepare before sync
  async beforeSync(context, utils) {
    await utils.local('npm run build');
    await utils.remote('pm2 stop app');
  },

  // Restart application after sync
  async afterSync(context, utils) {
    await utils.remote('npm install --production');
    await utils.remote('pm2 restart app');
  },

  // Validate files before adding
  async beforeFileAdd(context, utils) {
    const { filepath } = context;
    if (filepath.endsWith('.js')) {
      await utils.local(`eslint ${filepath}`);
    }
  },

  // Update permissions after adding
  async afterFileAdd(context, utils) {
    const { filepath } = context;
    await utils.remote(`chmod 644 ${filepath}`);
  }
};
```

#### Hook Precedence

1. JavaScript hooks in `supersync.hooks.js` are checked first
2. If no JavaScript hook is found, falls back to configuration hooks
3. If neither exists, the hook is skipped

#### Example Use Cases

1. Complex Build Process:
```javascript
async beforeSync(context, utils) {
  // Run tests
  await utils.local('npm test');
  
  // Build for production
  await utils.local('npm run build');
  
  // Clean remote dist
  await utils.remote('rm -rf dist/*');
}
```

2. Dynamic Cache Management:
```javascript
async afterFileChange(context, utils) {
  const { filepath } = context;
  
  // Clear specific cache based on file type
  if (filepath.endsWith('.css')) {
    await utils.remote('rm -rf /tmp/css-cache');
  } else if (filepath.endsWith('.js')) {
    await utils.remote('rm -rf /tmp/js-cache');
  }
}
```

3. File Validation:
```javascript
async beforeFileAdd(context, utils) {
  const { filepath } = context;
  
  // Run different validations based on file type
  if (filepath.endsWith('.js')) {
    await utils.local(`eslint ${filepath}`);
  } else if (filepath.endsWith('.css')) {
    await utils.local(`stylelint ${filepath}`);
  }
}
```

4. Application Management:
```javascript
async afterSync(context, utils) {
  // Get current configuration
  const config = utils.getConfig();
  const env = config.environment || 'production';
  
  // Restart application with specific environment
  await utils.remote(`NODE_ENV=${env} pm2 restart app`);
}
```

## License

MIT
