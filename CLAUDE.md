# busybar

## README stays in sync with src/

Every app directory under `src/` (anything with an `index.ts` entrypoint you
run directly) must have a corresponding section in `README.md` — what it
does and how to run it. Adding a new app and skipping the README update is
incomplete work, not a follow-up. Shared code (`src/lib/`) isn't an app and
doesn't need its own section, but should be mentioned briefly if its role
isn't obvious from the apps that use it.

## Secrets

Never commit secrets — API tokens, Wi-Fi passwords, device credentials, `.env`
files, or anything else that grants access to a BUSY Bar or a BUSY account.
This repo is public. Keep secrets in an untracked `.env` (already gitignored)
or the shell environment, never hardcoded in source.
