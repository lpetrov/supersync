const { convertGitignorePattern, getIgnorePatterns } = require('../../src/lib/ignore');
const fs = require('fs');
const { config, argv } = require('../../src/lib/config');

// Mock dependencies
jest.mock('fs');
jest.mock('../../src/lib/config', () => ({
  config: {},
  argv: {},
  DEFAULT_IGNORES: ['**/node_modules/**', '**/.git/**', '**/dist/**']
}));
jest.mock('../../src/lib/logger', () => ({
  log: jest.fn()
}));

describe('Ignore System', () => {
  describe('convertGitignorePattern', () => {
    test('handles empty lines and comments', () => {
      expect(convertGitignorePattern('')).toBeNull();
      expect(convertGitignorePattern('  ')).toBeNull();
      expect(convertGitignorePattern('# comment')).toBeNull();
    });

    test('handles negation patterns', () => {
      expect(convertGitignorePattern('!important.log')).toBe('important.log');
    });

    test('handles patterns with leading slash', () => {
      expect(convertGitignorePattern('/node_modules')).toBe('**/node_modules');
      expect(convertGitignorePattern('/dist/')).toBe('**/dist/**');
    });

    test('handles relative paths', () => {
      expect(convertGitignorePattern('src/temp/')).toBe('**/src/temp/**');
      expect(convertGitignorePattern('docs/api/')).toBe('**/docs/api/**');
    });
  });

  describe('getIgnorePatterns', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      config.ignore = undefined;
      argv.useGitignore = false;
    });

    test('returns default patterns when no config provided', async () => {
      const patterns = await getIgnorePatterns();
      expect(patterns).toContain('**/node_modules/**');
      expect(patterns).toContain('**/.git/**');
      expect(patterns).toContain('**/dist/**');
    });

    test('uses patterns from config when available', async () => {
      config.ignore = ['custom/**', '*.temp'];
      const patterns = await getIgnorePatterns();
      expect(patterns).toContain('**/custom/**');
      expect(patterns).toContain('**/*.temp');
    });

    test('includes common IDE and system files', async () => {
      const patterns = await getIgnorePatterns();
      expect(patterns).toContain('**/.idea/**');
      expect(patterns).toContain('**/.vscode/**');
      expect(patterns).toContain('**/.DS_Store');
      expect(patterns).toContain('**/Thumbs.db');
    });

    test('normalizes patterns correctly', async () => {
      config.ignore = ['/root-only', 'anywhere.txt', '**/glob-pattern'];
      const patterns = await getIgnorePatterns();
      expect(patterns).toContain('root-only');
      expect(patterns).toContain('**/anywhere.txt');
      expect(patterns).toContain('**/glob-pattern');
    });

    test('handles regex patterns', async () => {
      config.ignore = [/\.test\.js$/, /\.spec\.js$/];
      const patterns = await getIgnorePatterns();
      expect(patterns).toContainEqual(/\.test\.js$/);
      expect(patterns).toContainEqual(/\.spec\.js$/);
    });
  });
}); 