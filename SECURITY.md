# Security policy

Qraft is development-only tooling for a trusted local machine. Its local endpoints intentionally
have no authentication. Do not expose a Qraft-enabled server to an untrusted network. Use the
documented development guards and review the [local safeguards](docs/dev-server-protocol.md).

## Report a vulnerability privately

Use GitHub's [private vulnerability report](https://github.com/CasperKristiansson/Qraft/security/advisories/new)
when available. While this repository is private, collaborators can contact the maintainer through
their existing private project channel. If private reporting is unavailable, request a private
contact channel through the [maintainer's profile](https://github.com/CasperKristiansson) before
sharing sensitive details. Do not put exploit details, credentials, private review files or customer
data in a public issue.

Include the Qraft version, framework, Node version, environment, impact and minimal reproduction.
Redact secrets and unrelated project information. A small local reproduction is sufficient.

## Supported fixes

Security fixes target the latest Qraft version. There is no long-term maintenance branch or promised
response SLA. Compatibility ranges are listed in [installation](docs/getting-started.md); those
ranges do not promise support for vulnerable dependency versions outside the stated minimums.

Qraft's notes can contain visible app text and source locations. Review their contents before
sharing. Qraft does not upload them; a coding agent that reads them follows that agent's own data
handling. See [capture limits](docs/troubleshooting.md#element-or-source-context-is-incomplete).
