# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability within SuperSync, please send an email to the maintainer. All security vulnerabilities will be promptly addressed.

Please do not report security vulnerabilities through public GitHub issues.

## Security Considerations

SuperSync uses SSH and rsync for file synchronization. Please ensure:

1. You have secure SSH access to your remote server
2. Your SSH keys are properly protected
3. The remote user has appropriate permissions
4. You're using secure and up-to-date versions of SSH and rsync

## Automatic Updates

We use Dependabot to automatically create pull requests for dependency updates. This helps ensure that the project uses the latest secure versions of its dependencies.

## Code Security

- All code changes go through CI checks
- Dependencies are regularly updated
- Code is linted and tested
- Security advisories are monitored 