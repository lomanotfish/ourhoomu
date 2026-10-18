# Repository Guidelines

## Confirm Scope Before Starting

The user has authorized project design, documentation, a progress checklist,
the specific Neon setup/deploy in SW-0015, and frontend scaffold/demo UI in
SW-0026–SW-0028. The latest confirmation authorizes the reviewed core backend
and frontend integration plan on local/dev, including its task-relevant checks.
Read docs/team/core-implementation.md for approved scope, operational values and
ownership. The cute Expo UI has no Figma dependency; SlipOK, LINE, native login,
production operations and release retain their explicit evidence/authorization
gates.
Before starting new work, the Tech Lead must ask about material ambiguities,
summarize the requirements and acceptance conditions, and wait for the user's
explicit confirmation. Engineers route questions through the Tech Lead and
work within the confirmed ticket scope. Existing confirmation applies within
that scope; a scope change requires a new confirmation.

Read `docs/team/requirements.md`, `docs/team/board.md`, and the assigned ticket
before acting. For money, chores, or retention, read `docs/project/domain.md`;
for client/server integration, read `docs/project/api-contract.md`.
`docs/project/decisions.md` distinguishes confirmed requirements from proposals.
The Tech Lead alone updates ticket status and `checklist.md` after acceptance
and integration, recording actual evidence.

The main session acts as Tech Lead and reads the installed `software-tech-lead`
skill and its `references/agent-runtime.md` before coordinating engineers through
Orca. Follow the globally configured TeamAI agent roles and the project ticket
for isolation, review, integration, cleanup, and Graft reporting. Workers ask
the Lead and never open a second coordinator.

## Project Structure & Module Organization

`ourhoomu` is a Bun workspace monorepo with Expo frontend, Workers API, shared
contracts, design documents and Neon tooling. Its project files include:

- `README.md`: the project name; expand it with setup and usage instructions as development begins.
- `LICENSE`: the Apache 2.0 license.
- `AGENTS.md`: this contributor guide.
- `ourhoomu-api/README.md`: Workers API setup, local checks and runtime scope.
- `ourhoomu-front/README.md`: Expo frontend setup, demo scope and development commands.
- `docs/`: requirements, architecture, contracts, and team tickets.
- `checklist.md`: progress maintained by the Tech Lead.

Frontend source, assets and its Bun dependencies belong in `ourhoomu-front/`.
Root `package.json` and `bun.lock` manage all workspaces and Neon tooling;
`neon.ts` configures Neon policy. `.neon`, `.env*`, `node_modules`, and
installed `.agents` skills remain local and ignored. Never print credentials.
The linked Neon branch is production: do not migrate or write product data
without the relevant confirmed ticket. Read `docs/adr/0002-neon.md`; previous
Supabase-specific instructions are superseded.

## Build, Test, and Development Commands

Run `bun install --frozen-lockfile` at the repository root with the pinned Bun
version in `.bun-version` to install all workspaces and Neon tooling. For frontend
start, typecheck and export commands, follow `ourhoomu-front/README.md` and its
package scripts. See `docs/project/neon-setup.md` for verified Neon commands.
Use these repository checks:

- `git ls-files`: inspect tracked project files.
- `git status --short`: review pending changes before committing.
- `git diff --check`: detect whitespace errors in tracked changes.

When adding the first runnable component, document its installation, development, build, and test commands in `README.md` alongside the required runtime versions.

## Coding Style & Naming Conventions

Use Markdown headings, concise paragraphs, and fenced code blocks with language labels. Use spaces rather than tabs and two spaces for nested Markdown lists. Keep filenames descriptive and preserve established names such as `README.md` and `LICENSE`.

Frontend uses TypeScript and the configuration in `ourhoomu-front/`. Apply its
existing conventions; root Neon tooling is separate.

## Testing Guidelines

Use Playwright Test for browser flows and HTTP API acceptance, as requested by
the user on 2026-10-15. Follow SW-0047 and the frontend testing README for setup
and commands. Run against dedicated local servers and record the tested SHA,
results and evidence. Label demo and synthetic identity tests explicitly;
API-backed acceptance requires real handlers and the isolated synthetic DB.
Keep focused unit and database race/authorization tests alongside Playwright.
Native Google/Apple, provider and TestFlight acceptance require their own real
environment evidence.

Frontend checks are defined by its package scripts and README. Root CI and
coverage thresholds are not established. For documentation changes, inspect Markdown rendering, verify referenced paths and commands, and run `git diff --check`.

When adding executable behavior, include relevant tests and document their framework, naming pattern, and invocation.

## Commit & Pull Request Guidelines

The repository began with `Initial commit`; there is too little history to infer a recurring commit convention. Use short, imperative subjects, such as `Add contributor guide`, and keep each commit focused.

Pull requests should describe the change and its purpose, link related issues when applicable, and list validation performed. Include screenshots for visual changes and explain any checks that could not be run.
