# Sounddesk Overview

Public read-only portfolio overview for Sounddesk Enterprise.

This repository intentionally contains **only** the static overview application and sanitized, non-sensitive portfolio data.

It must never contain passwords, recovery information, OAuth/API tokens, session credentials, private repository state, unpublished sensitive assets, account-security controls, publishing controls, payment controls, payout controls, or subscription controls.

The application is observation-only. All decisions and consequential actions remain in the private Sounddesk Master Chat / private Enterprise Agent repository.

## Security model

The public snapshot is validated by an explicit allowlist before every build. The source tree is also checked to prevent forms, action buttons, browser credential storage, cookies, or authorization headers from being introduced accidentally.

If a field is not required for the public overview, it stays out.


## Live site

GitHub Pages deployment is enabled and publishes the validated build at:

https://sounddesk-art.github.io/Sounddesk-overview/

The site is intentionally public but discouraged from search-engine indexing. It is not an access-controlled private application.
