# Next.js package consumer fixture

`pnpm verify:next` copies this app into a temporary directory, installs the packed Qraft archive,
checks development reads and writes, builds it, and proves production endpoints return 404.
It does not link repository source or write a developer's checklist.

The route requires the Node runtime. The React entry is a client boundary. Qraft is mounted only
in development; the route independently refuses all non-development requests. The explicit file
option permits creating QA.md after choosing it; omit the option to discover existing Markdown files.
