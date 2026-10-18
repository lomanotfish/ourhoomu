# SW-0002 independent builder/design review

- Reviewed artifact: `6aeb4228dc9655cf27127cdc557025fbc62b2b85`.
- Baseline: `6312fa6e02dc65969874d29b1474ecf4bdd9e0b8` (also the observed merge-base).
- Workspace: `/Users/afe/orca/workspaces/ourhoomu/sw-0002-project-design`.
- Branch: `witchagorn/sw-0002-project-design`; integration target supplied by Lead: `main`.
- Run: `run_7a5023711f3d`; Task: `task_5e634b90baf7`; Dispatch: `ctx_78ed611a3ddc`.
- Reviewer terminal: `term_e3ba008b-0d8b-4f51-954f-9e1faf225f69`.
- Review date: 2026-10-12 Asia/Bangkok (2026-10-11 UTC).
- **Verdict: changes_requested.** Three material P2 design/handoff findings below; no application implementation or new user requirement questions are needed to resolve them.
- Dispatch outcome: succeeded means the independent review was completed, not that SW-0002 is accepted.

## Findings, ranked by consequence

### F1 — [P2] Signed slip downloads do not deliver the promised immediate membership revocation

**Location:** `docs/project/api-contract.md:49`; related `docs/project/domain.md:11`, `docs/project/domain.md:66`, `docs/project/architecture.md:30`.

The API returns a direct private signed read URL valid for up to 60 seconds, while the domain says leaving/removal immediately revokes slip access and restricts readers to uploader/recipient who are still members. A permitted uploader can obtain a URL for a settled bill, leave the house, and still request the file with that URL before its expiry. Checking live membership before issuing a URL does not check it again on the subsequent Storage request.

This is a design contradiction, not an observed application exploit. Supabase documents that signed URLs remain valid until expiry and are independent of Auth signing-key revocation; see [Serving assets from Storage](https://supabase.com/docs/guides/storage/serving/downloads). The resulting post-removal read window is an inference from those documented semantics and the proposed API.

**Concrete correction:** For the currently stated immediate-revocation rule, specify an authenticated API download/stream that checks fresh membership and uploader/recipient authorization for every new file request, without returning a reusable Storage bearer URL. Update the API/architecture/privacy acceptance together and test a new download after membership removal. If the Lead instead chooses a bounded 60-second revocation window, state that limitation consistently and surface it in the already planned full-design review; do not describe short URL lifetime as immediate revocation. Already downloaded user-held copies are outside this finding.

**Owner / material builder question:** Lead: which download authorization contract is authoritative? This changes the file-serving path and its security acceptance. No separate user question is necessary to preserve the stricter stated rule.

### F2 — [P2] QA and TestFlight have a circular acceptance dependency

**Location:** `docs/team/tickets/SW-0012.md:25`; related `docs/team/requirements.md:36`, `docs/team/tickets/SW-0014.md:6`, `docs/team/tickets/SW-0014.md:28`.

SW-0012 requires evidence for all of AC1–AC7, but AC1 includes installation on an iPhone through TestFlight. That installation is SW-0014-AC4, and SW-0014 depends on acceptance of SW-0012. Following both tickets literally prevents QA from passing before release can start. The frontmatter dependency graph is syntactically acyclic; the cycle is in the acceptance evidence. SW-0012's instruction not to claim TestFlight without a receipt does not remove its all-AC1 requirement.

**Concrete correction:** Split AC1's evidence into native Google/Apple-through-API proof on the development build before release and TestFlight distribution/install proof after upload. Make SW-0012 explicitly a pre-release go/no-go with the distribution subcriterion pending, then close that subcriterion with SW-0014's actual receipt and smoke evidence. Update the requirement mapping/board/checklist as needed without dropping the final TestFlight requirement.

**Owner / material builder question:** Lead: which acceptance evidence is required before release, and which is recorded after release? This changes ticket readiness and completion order, not the user's requested behavior.

### F3 — [P2] Selecting a different bill recipient lacks an authorized account-selection contract

**Location:** `docs/project/api-contract.md:36`; related `docs/project/api-contract.md:71`, `docs/project/ux.md:35`, `docs/project/domain.md:70`.

The confirmed flow allows creator A to choose recipient B. UX then asks A to select an account set up by its owner, and the publish example supplies `recipientAccountId`. The only proposed account lookup is `/me/recipient-accounts`, explicitly owner-only; neither a bill draft/preview response nor another route defines how A obtains an eligible ID for B. The domain permits account information for authorized bill use, but does not specify that pre-publication selection path. An independent frontend/backend builder must invent a new access contract or leave the non-default-recipient flow incomplete.

**Concrete correction:** Define a bill/draft-scoped read-only account selector/preview for the selected active recipient, including its caller permissions, eligible account IDs, minimal masked metadata, and the case where B has no eligible account. Validate ownership of the chosen account against `recipientMembershipId` atomically at publish. Alternatively, explicitly specify server selection of B's configured default and remove the client account-selection requirement for this case. Keep account management owner-only and full account disclosure limited to the bill participants who need it. Add creator != recipient acceptance to SW-0005/SW-0006/SW-0010.

**Owner / material builder question:** Lead: what authorized API response supplies B's selectable account, or is selection server-side? This changes API shape, privacy projection, and the create-bill flow; it is not merely component styling or a library choice.

## Requirement coverage and scope

| Area | Independent assessment of the pinned design |
|---|---|
| Partial payments / R8 | `domain.md:34`, `domain.md:42`, `domain.md:46` and API payment routes define multiple attempts, reservations, pending separate from paid, atomic/idempotent finalization and 40 + 60 against 100. Covered as design; no runtime proof exists. |
| Recipient self-covered / R5–R7 | `domain.md:15`–`domain.md:36` distinguishes creator and recipient, handles the recipient's own share without a payment, requires 10000 bps, and gives the confirmed 200-baht example. Covered; F3 affects selecting another recipient's account. |
| External verification / R8 | `domain.md:49`–`domain.md:56` and `api-contract.md:82`–`api-contract.md:90` require automatic server/provider checks, matching amount/recipient/time/reference, no manual transfer approval, and reconcile unknown outcomes. Covered; provider selection/credentials/retention evidence remain gated. |
| Cash creator confirmation / R8 | `domain.md:60`, API confirm/reject routes and `ux.md:48` consistently give confirmation to creator, including when creator != recipient. Creator-as-payer is already explicitly pending in decisions; not a newly discovered question. |
| Slip visibility / R9 | `domain.md:66`–`domain.md:70`, `ux.md:44`, API and tickets restrict image/private provider details to uploader/recipient and exclude owner/creator privilege escalation. F1 identifies the separate membership-revocation inconsistency. |
| Three chore modes / R10 | `domain.md:74`–`domain.md:86`, UX and SW-0008/SW-0011 cover manual, repeat, ordered rotation, date/timezone/revision rules, assignee completion and idempotent occurrences. Covered as design. |
| App-open feed / R11 | `domain.md:90`, UX and SW-0008/SW-0011 specify opening/foreground/refresh, in-app badges/feed and no APNs, Expo push, local notifications or notification permission. Covered. Operational maintenance/monitoring is distinguished from member notifications. |
| Creation-based retention / R12 | `domain.md:96`–`domain.md:109` defines a 365-day creation-based hard cap, earlier access/purge start, child caps and no lifetime extension. Operations/SW-0013 cover files, retries, logs, queues, cache, provider copies, backups and purge before restore. Physical deletion under free-host pause and external copies are honestly unproven release blockers. |
| Native Google/Apple through API / R3 | `architecture.md:39`–`architecture.md:46`, API auth routes and SW-0005/SW-0009 require native consent, server exchange/refresh/logout, challenge/token verification and real iPhone proof. Covered as proposed design; linking/version/provider details have explicit later gates. |
| TestFlight / R1 | Architecture, operations and SW-0014 require actual distribution/install, beta review and build expiry planning. Covered, subject to the sequencing correction in F2. |
| Docs-only / R2, R13–R14 | AGENTS/README/board/agent guide/decision log retain explicit user confirmation before implementation. Both project subfolders contain only README files. Three slip providers, primary-source links, proposed recommendation and unproven/provider limitations are present. |
| Truthful checklist | Every implementation checkbox is unchecked. SW-0002 checked items describe produced requirements/design/docs/backlog, while independent review, integration/cleanup, full user design approval and provider choice remain unchecked. No unfinished app feature is claimed done. |

## Questions requiring user versus Lead

- **New user questions:** none from this review. The material unresolved handoff questions are F1–F3 and can be resolved by the Lead within the documentation scope while preserving confirmed behavior.
- **Already recorded user/provider/release decisions:** full design approval, provider/budget selection, creator-as-payer cash confirmation, credentials and provider/backup/hosting retention proof remain pending in the existing decision log. Their existence does not block delivery of an honest docs-only proposal and they are not repeated as new review findings.
- Ordinary implementation discretion and later version/schema/error-code finalization are excluded from the finding list.

## Verification commands and observed results

All project content was read with `git show 6aeb4228dc9655cf27127cdc557025fbc62b2b85:<path>`, including AGENTS, requirements, SW-0002, docs index, all referenced design documents, board/guide, ADR, root/subproject READMEs, checklist and every implementation ticket. Numbered excerpts used `nl -ba` on that immutable content.

1. `pwd`, `git branch --show-current`, `git rev-parse HEAD`, `git status --short`: assigned workspace/branch, artifact HEAD, initially clean.
2. `git diff --stat <base> <artifact>` / `git diff --name-status <base> <artifact>`: 30 changed files, 1512 insertions, 2 deletions; all changed files Markdown. `git ls-tree -r --name-only <artifact>`: 31 tracked files, 30 Markdown plus LICENSE; no source/package/assets introduced.
3. `git log --oneline <base>..<artifact>`: `542292a Document OurHoomu requirements and architecture`, then `6aeb422 Track the project ticket board`.
4. `git merge-base <base> <artifact>`: exactly `6312fa6e02dc65969874d29b1474ecf4bdd9e0b8`.
5. `git diff --check <base> <artifact>`: exit 0, no whitespace errors; repeated at final verification.
6. Inline Python validator using `git ls-tree`, `git show`, Markdown-link extraction and normalized relative paths: **30 Markdown files, 121 local links checked, 0 missing tracked targets; 22 external link instances excluded from this local-target check**. All 13 ticket frontmatter IDs/dependencies resolve with no declared DAG cycle; implementation tickets have 0 checked acceptance boxes.
7. Inline Python fenced-block check on pinned Markdown: **5 fenced blocks, 0 unclosed or unlabelled opening fences**. Headings, tables, JSON/text/shell fences and two Mermaid diagrams were manually inspected as source; no renderer was installed/run.
8. `git status --short` at final verification: only `docs/team/board.md` and `docs/team/tickets/SW-0002.md` modified. Their diff contains Lead-owned live review tracking records. These changes were preserved and excluded from artifact review. A combined working-tree cleanliness probe exited 1 because of those tracking edits; this is not a whitespace failure or a claim of a clean final worktree.
9. `orca orchestration check --terminal term_e3ba008b-0d8b-4f51-954f-9e1faf225f69 --json`: mailbox checked at checkpoints; no follow-ups in results seen before writing this report. Lifecycle/status messages use the supplied Task/Dispatch, not invented IDs.
10. Primary-source browser read: Supabase Storage serving/downloads, createSignedUrl reference and access-control docs. Only the signed-URL lifetime/revocation semantics inform F1; no provider or cloud API calls with credentials were made.

## Observed runtime and Graft evidence

**Runtime:** Read `/Users/afe/.codex/agents/code-reviewer.toml` and `/Users/afe/.codex/skills/software-tech-lead/references/agent-runtime.md`. The role profile configures `approval_policy = "never"` and `sandbox_mode = "danger-full-access"`; configured values alone were not treated as proof of launch.

An ancestor-process inspection using Python `os.getpid()` and `ps -o pid=,ppid=,command= -p <pid>` observed the executing Codex parent, PID 95023, as:

```text
codex --no-daemon --dangerously-bypass-approvals-and-sandbox
```

This actual launch flag supplies the required never-approval/full-access equivalent. `CODEX_HOME` was unset in the observed process environment. `orca orchestration worker-show --dispatch ctx_78ed611a3ddc --json` additionally identified the exact worker as live, the above Run/Task/Dispatch/workspace, and inherited provider model `gpt-6.1-sol`; requested/effective model and effort overrides were null. No model/config changes were made.

**Graft:** Read `/Users/afe/.agents/skills/graft/SKILL.md`; `graft --version` returned **0.21.1**. Own `graft map` preflight and final checkpoint in the exact assigned worktree returned:

```text
repo map — 0 files · 0 symbols · 0 edges ·
hotspots:
```

**🌱 Graft: NO_INDEXED_FILES.** Raw immutable Markdown/config reads were used because the repository has no indexed source. Three map calls were made; no token-savings line was emitted, so no savings are claimed. No independent build/cache configuration change was made because this reviewer may write only its external report; the Lead's earlier zero-file build is not presented as the reviewer's own execution.

The version-matched worker obligations were read from the selected executable with `orca skills get orchestration`. No native subagents, nested coordinator, repository edits, commits, dependencies, real slip data, cloud resources, vendor contact, merge, worktree deletion or worker release were performed by this reviewer.

## Limits and next action

This is a documentation/design review of the pinned artifact, not runtime acceptance, a hosted security assessment or a provider benchmark. Provider prices/quotas were not independently revalidated in this review; public comparison links and honest limitations were inspected. Actual provider matching/deletion, managed backups, scheduled purge under host outages, native credentials/session behavior and TestFlight remain unproven and gated. Source-level Markdown inspection is not rendered UI/diagram proof. Main integration and user-checkout fast-forward were not performed or verified by this worker.

The Lead should preserve this report outside the disposable worktree, settle/release this worker under the Orca guide, correct F1–F3 in documentation, run focused consistency/links/whitespace checks on the corrected artifact, and complete the authorized local integration/cleanup before marking SW-0002 done. Keep implementation and external release gates closed until their existing user/provider decisions are satisfied.
