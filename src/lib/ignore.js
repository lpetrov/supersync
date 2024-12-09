const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { config, argv, DEFAULT_IGNORES } = require('./config');
const { log } = require('./logger');

const readFilePromise = promisify(fs.readFile);

// Convert gitignore pattern to chokidar pattern
function convertGitignorePattern(pattern) {
  // Remove leading and trailing whitespace
  pattern = pattern.trim();
  
  // Skip empty lines and comments
  if (!pattern || pattern.startsWith('#')) {
    return null;
  }

  // Handle negation (not supported in our case, but we'll handle the pattern)
  const isNegation = pattern.startsWith('!');
  if (isNegation) {
    pattern = pattern.slice(1);
  }

  // Handle patterns that start with slash
  if (pattern.startsWith('/')) {
    pattern = pattern.slice(1);
  }

  // Handle directory-only pattern
  if (pattern.endsWith('/')) {
    pattern = `${pattern.slice(0, -1)}/**`;
    return pattern;
  }

  // If pattern doesn't start with slash or wildcard and isn't a negation pattern
  if (!isNegation && !pattern.startsWith('*') && !pattern.startsWith('/')) {
    pattern = `**/${pattern}`;
  }

  return pattern;
}

// Read .gitignore file and parse its patterns
async function readGitignore() {
  try {
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    const content = await readFilePromise(gitignorePath, 'utf8');
    
    return content
      .split('\n')
      .map(convertGitignorePattern)
      .filter(Boolean); // Remove null/undefined patterns

  } catch (error) {
    if (error.code === 'ENOENT') {
      log('.gitignore file not found, skipping');
      return [];
    }
    throw error;
  }
}

// Convert patterns to chokidar-compatible format
function normalizePatterns(patterns) {
  return patterns.map(pattern => {
    // If pattern is already a regex, return as is
    if (pattern instanceof RegExp) {
      return pattern;
    }

    // Convert string patterns
    if (typeof pattern === 'string') {
      // Handle patterns that should match from the root
      if (pattern.startsWith('/')) {
        return pattern.slice(1);
      }
      // Handle patterns that should match anywhere
      if (!pattern.startsWith('**/') && !pattern.startsWith('/')) {
        return `**/${pattern}`;
      }
    }

    return pattern;
  });
}

// Initialize ignore patterns
async function getIgnorePatterns() {
  let patterns = [];

  // Start with default patterns
  if (!config.ignore || !Array.isArray(config.ignore) || config.ignore.length === 0) {
    patterns = [...DEFAULT_IGNORES];
    log('No ignore patterns found in config, using defaults');
  } else {
    patterns = [...config.ignore];
  }

  // Add .gitignore patterns if enabled
  if (argv.useGitignore) {
    const gitignorePatterns = await readGitignore();
    if (gitignorePatterns.length > 0) {
      log(`Adding ${gitignorePatterns.length} patterns from .gitignore`);
      if (argv.verbose) {
        gitignorePatterns.forEach(pattern => log(`  - ${pattern}`));
      }
      patterns.push(...gitignorePatterns);
    }
  }

  // Normalize all patterns
  const normalizedPatterns = normalizePatterns(patterns);
  
  // Add common IDE and system files if not already included
  const additionalPatterns = [
    '**/.idea/**',
    '**/.vscode/**',
    '**/node_modules/**',
    '**/.DS_Store',
    '**/Thumbs.db'
  ];

  // Add additional patterns only if they're not already included
  additionalPatterns.forEach(pattern => {
    if (!normalizedPatterns.includes(pattern)) {
      normalizedPatterns.push(pattern);
    }
  });

  return normalizedPatterns;
}

module.exports = {
  getIgnorePatterns,
  convertGitignorePattern // Exported for testing
}; 