# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability, do not open a public issue.

Instead, email security details to the repo maintainers.

## Known Limitations

This is a Proof of Concept. Known security considerations:

### Authentication & Authorization
- Basic API key auth for PoC
- No full JWT yet
- Fix for production: Implement JWT + signed messages

### Token Management
- Access tokens in memory
- No refresh
- Fix: Backend proxy, secure storage

### Network Security
- WS not WSS
- Fix: HTTPS/WSS in prod

### Data Validation
- Basic validation
- Rate limiting added
- Fix: More validation in prod

## Current Status

Version 0.2.0 is a PoC - NOT for production without review.
