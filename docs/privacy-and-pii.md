# Privacy and PII handling

The app is primarily a read-only financial analytics surface over public SEC 13F-derived data.
User/session data is limited to authentication/session identifiers and operational telemetry.

## Data handling rules

- Do not log JWTs, cookies, API keys, host credentials, or raw request headers.
- Treat CIKs and public company identifiers as public market data, not private user data.
- Treat user IDs, cookies, IPs, and free-form search terms as potentially sensitive operational
  data.
- Keep production secrets in GitHub environment secrets or runtime environment variables only.

## Retention and deletion

- Browser cache data is local IndexedDB cache and can be invalidated by data-version changes.
- Server logs should retain only sanitized operational fields needed for incident response.
- If user-identifying data is introduced, add export/deletion endpoints before launch.

## Agent expectations

Agents must use sanitized logs and avoid copying tokens, cookies, full headers, or private
environment values into issues, PRs, docs, or chat.
