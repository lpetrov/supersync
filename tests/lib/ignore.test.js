const { convertGitignorePattern } = require('../../src/lib/ignore');

describe('ignore module', () => {
  describe('convertGitignorePattern', () => {
    test('should handle basic patterns', () => {
      expect(convertGitignorePattern('file.txt')).toBe('**/file.txt');
      expect(convertGitignorePattern('*.js')).toBe('**/*.js');
    });

    test('should handle directory patterns', () => {
      expect(convertGitignorePattern('dir/')).toBe('dir/**');
      expect(convertGitignorePattern('/dir/')).toBe('dir/**');
    });

    test('should handle patterns with leading slash', () => {
      expect(convertGitignorePattern('/file.txt')).toBe('file.txt');
      expect(convertGitignorePattern('/dir/file.txt')).toBe('dir/file.txt');
    });

    test('should handle glob patterns', () => {
      expect(convertGitignorePattern('**/*.js')).toBe('**/*.js');
      expect(convertGitignorePattern('dir/**/*.js')).toBe('dir/**/*.js');
    });

    test('should handle comments and empty lines', () => {
      expect(convertGitignorePattern('# comment')).toBeNull();
      expect(convertGitignorePattern('')).toBeNull();
      expect(convertGitignorePattern('  ')).toBeNull();
    });

    test('should handle negation patterns', () => {
      expect(convertGitignorePattern('!file.txt')).toBe('**/file.txt');
      expect(convertGitignorePattern('!/dir/file.txt')).toBe('dir/file.txt');
    });

    test('should handle special characters', () => {
      expect(convertGitignorePattern('file[abc].txt')).toBe('**/file[abc].txt');
      expect(convertGitignorePattern('file{1,2}.txt')).toBe('**/file{1,2}.txt');
    });
  });
}); 