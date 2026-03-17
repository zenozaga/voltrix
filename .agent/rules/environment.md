---
trigger: always_on
---

## Shell
- Windows: never use `&&` to chain commands — run separately or use `;`
- WSL: `wsl bash -lc "COMMAND"` to execute Linux commands
- Always use Unix paths (`/`) in bash commands, even on Windows

## uWebSockets.js
- Never wrap `end(payload)` inside `cork()` — uWS v20.60 adds `Content-Length` twice (duplicate header bug)
- Write status/headers directly, then call `end(payload)` outside cork
- `req.body()` exists — `req.text()` does NOT

## Imports
- Build output is `.js`, not `.mjs` — import as `dist/index.js`
- Package symlinks may not resolve `.mjs` — use direct relative path when in doubt

## Benchmarks
- Workers use `child_process.fork()` with IPC — wait for `{ ready: true }` before benchmarking
- Never call `autocannon.track()` with `silent: true` — it prints tables regardless
- Table cell width must be wide enough for `"88.2k req/s  p99=1.0ms"` (use `colW >= 22`)
