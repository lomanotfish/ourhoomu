# Repository Guidelines

## Confirm Scope Before Starting

The current user-authorized scope is project design, documentation, and a
progress checklist. Application implementation has not been authorized yet.
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
Orca. Read `docs/team/agent-guide.md` for isolation, review, integration, cleanup,
and Graft reporting. Workers ask the Lead and never open a second coordinator.

## Project Structure & Module Organization

`ourhoomu` is currently a documentation-stage monorepo. Its project files include:

- `README.md`: the project name; expand it with setup and usage instructions as development begins.
- `LICENSE`: the Apache 2.0 license.
- `AGENTS.md`: this contributor guide.
- `ourhoomu-api/README.md`: backend scope; application code is not scaffolded.
- `ourhoomu-front/README.md`: iOS frontend scope; application code is not scaffolded.
- `docs/`: requirements, architecture, contracts, and team tickets.
- `checklist.md`: progress maintained by the Tech Lead.

No application source, tests, or assets are present yet. When introducing them, choose clear locations such as `src/`, `tests/`, and `assets/`, and document the actual layout in `README.md`.

## Build, Test, and Development Commands

There is no package manifest, build system, dependency installation step, or local application command yet. Use these repository checks:

- `git ls-files`: inspect tracked project files.
- `git status --short`: review pending changes before committing.
- `git diff --check`: detect whitespace errors in tracked changes.

When adding the first runnable component, document its installation, development, build, and test commands in `README.md` alongside the required runtime versions.

## Coding Style & Naming Conventions

Use Markdown headings, concise paragraphs, and fenced code blocks with language labels. Use spaces rather than tabs and two spaces for nested Markdown lists. Keep filenames descriptive and preserve established names such as `README.md` and `LICENSE`.

No language-specific style, formatter, or linter is configured. Introduce appropriate configuration with the first source files and apply it consistently.

## Testing Guidelines

No test framework, test naming convention, CI workflow, or coverage threshold is established. For documentation changes, inspect Markdown rendering, verify referenced paths and commands, and run `git diff --check`.

When adding executable behavior, include relevant tests and document their framework, naming pattern, and invocation.

## Commit & Pull Request Guidelines

The repository began with `Initial commit`; there is too little history to infer a recurring commit convention. Use short, imperative subjects, such as `Add contributor guide`, and keep each commit focused.

Pull requests should describe the change and its purpose, link related issues when applicable, and list validation performed. Include screenshots for visual changes and explain any checks that could not be run.
