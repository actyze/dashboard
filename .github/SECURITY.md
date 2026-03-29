# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| < Latest | :x:               |

Only the latest release receives security updates. We recommend always running the most recent version.

## Reporting a Vulnerability

**Please do NOT open public GitHub issues for security vulnerabilities.**

Instead, report vulnerabilities by emailing **security@actyze.ai** with the following details:

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Any suggested fixes (optional)

## Response Timeline

| Action | Timeframe |
| ------ | --------- |
| Acknowledgment of report | **48 hours** |
| Initial assessment | **5 business days** |
| Fix for critical vulnerabilities | **7 days** |
| Fix for non-critical vulnerabilities | **30 days** |

## Disclosure Policy

- We follow coordinated disclosure. We ask that you give us reasonable time to address the issue before any public disclosure.
- We will credit reporters in the release notes unless anonymity is requested.
- Critical vulnerabilities will result in an expedited patch release.

## Scope

The following are in scope for security reports:

- The Actyze Dashboard application (frontend and backend)
- The Nexus API server
- The Schema Service
- Docker configurations and deployment scripts
- Authentication and authorization mechanisms

## Out of Scope

- Third-party services and dependencies (report these to the respective maintainers)
- Social engineering attacks
- Denial-of-service attacks without a demonstrated vulnerability
