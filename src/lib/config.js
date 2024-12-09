const rc = require('rc');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Default configuration with standard ignore patterns
const DEFAULT_IGNORES = [
  // eslint-disable-next-line no-useless-escape
  '/(^|[\/\\])\../', // Ignore dot files
  '/node_modules/',   // Ignore node_modules
  '**/*.log',        // Ignore log files
  '**/dist/',        // Ignore dist directories
  '**/build/',       // Ignore build directories
  '**/coverage/',    // Ignore test coverage
  '**/tmp/',         // Ignore tmp directories
  '**/.git/',        // Ignore git directory
  '**/.svn/',        // Ignore svn directory
  '**/.DS_Store'     // Ignore macOS files
];

const DEFAULT_HOOKS = {
  beforeSync: null,
  afterSync: null,
  beforeFileAdd: null,
  afterFileAdd: null,
  beforeFileChange: null,
  afterFileChange: null,
  beforeFileDelete: null,
  afterFileDelete: null,
  beforeExit: null
};

const defaults = {
  targets: {},
  ignore: DEFAULT_IGNORES,
  maxParallel: 10,
  hooks: DEFAULT_HOOKS,
  muteSyncs: false,
  useGitignore: true,
  deleteRemote: true // Default to true for remote file deletion
};

// Load configuration from .remotesyncrc file
const config = rc('remotesync', defaults);

const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 --target <name-or-uri> [options]')
  .option('target', {
    alias: 't',
    type: 'string',
    description: 'Target name from config or SSH URI (e.g., user@host:/path/to/remote/dir)',
    demandOption: true
  })
  .option('port', {
    alias: 'p',
    type: 'number',
    description: 'SSH port number',
    default: 22
  })
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Run with verbose logging',
    default: false
  })
  .option('max-parallel', {
    alias: 'm',
    type: 'number',
    description: 'Maximum number of parallel sync commands',
    default: config.maxParallel
  })
  .option('delete', {
    alias: 'd',
    type: 'boolean',
    description: 'Delete extraneous files from destination during initial sync',
    default: false
  })
  .option('use-gitignore', {
    alias: 'g',
    type: 'boolean',
    description: 'Include .gitignore patterns in the ignore list',
    default: config.useGitignore
  })
  .option('delete-remote', {
    type: 'boolean',
    description: 'Delete remote files when local files are deleted',
    default: config.deleteRemote
  })
  .option('mute-syncs', {
    type: 'boolean',
    description: 'Mute file sync notifications',
    default: config.muteSyncs
  })
  .help()
  .argv;

module.exports = {
  config,
  argv,
  DEFAULT_IGNORES,
  DEFAULT_HOOKS
}; 