# Core local/dev continuation — 2026-10-16

User requested completing remaining work after reviewing the backlog. Existing approved core local/dev scope continues; live identity, SlipOK, LINE, production and release evidence/authorization gates remain.

## Verified recovery

- Integration baseline: local `3e7c598292a3479e600a2fded8bfd1868bbd74a8`.
- Root user changes preserved: AGENTS.md, docs/README.md, deleted docs/team/agent-guide.md and untracked node_modules 2/.
- SW-0059 frozen implementation `10a0fff`, report `67133ee`, awaiting independent security review.
- SW-0005 frozen HTTP implementation/report `ab90e83`; exact-byte BOM correction previously rechecked, real DB adapter acceptance pending.
- Existing historical worktrees retained; new writers use isolated `v4-*` worktrees.

## Actual dispatches

- Native security specialist `data_security_review`: SW-0064 independent frozen source review. Exclusive guarded synthetic database verification window granted; API/data implementation writers instructed not to use DB during review.
- Native database specialist `data_read_parity`: SW-0063 read projections and restricted-role tests, offline implementation until DB window granted.
- Pi backend task `ourhoomu-v4-core-api`, worktree `/Users/afe/orca/workspaces/ourhoomu/v4-core-api`: provisional merge of HTTP source and data source solely for adapter development, not accepted integration. Scoped handlers/tests only; no SQL/schema or DB calls during review.
- Pi frontend task `ourhoomu-v4-front-core`, worktree `/Users/afe/orca/workspaces/ourhoomu/v4-front-core`: existing contract/session/house API integration, explicit demo retained and native identity acceptance separate.
- Both Pi tasks validated via adapter --dry-run and launched with existing configured provider/model unchanged. Smoke returned `PI_PROVIDER_OK`; this establishes provider response only, not implementation success.

## Acceptance order

1. SW-0064 security verdict and any SW-0059 corrections.
2. SW-0005 real handler/data adapter and guarded synthetic HTTP acceptance.
3. SW-0009 session/house UI integration with browser checks; native evidence remains open.
4. SW-0063 read parity, SW-0006 bills/cash and SW-0008 chores/activity.
5. SW-0010/0011 frontend integration and integrated Playwright acceptance.
6. Provider/retention/native/release tickets remain governed by their own gates.

## Verification

- Pinned Bun `1.4.3`; isolated integration `bun install --frozen-lockfile` exited 0, 700 packages installed.
- Fresh checks and task outcomes will be recorded after completion; no feature acceptance claimed by dispatch alone.

## First verification findings

- Independent SW-0064 old-candidate review found a janitor lock-order inversion: candidate0003 pruned command replay rows before acquiring the accepted family locks. Candidate is not accepted. Database owner is correcting the unaccepted0003 only; accepted0000–0002 remain immutable.
- Repeat-run lifecycle fixture aging violated the five-minute idempotency constraint on older fixture rows. Data fix `f24cefe` was independently rerun: lifecycle4 and transactional migration2 groups passed, followed by guarded old-candidate rollback. Runtime probe and role OIDs preserved, writer schema CREATE=false; no reset or force.
- Reviewer explicitly released DB window; Lead granted next interval to database owner for corrected candidate apply/check. Backend/front writers still have no DB grant.
- Pi backend corrected caller exchange union narrowing and overloaded fixture typing in `fd099e7`; author reports API91 tests/266 assertions, strict typecheck/lint/format/Workers dry build passed. Independent acceptance remains pending.
- Credential-free fixture runtime probe initially returned health200 but failed expected envelope; backend is investigating exact-config/dedicated-port behavior rather than treating it as a DB blocker.
- Pi frontend first slice added explicit API-mode session/house shell, preserved demo mode, and passed author101 tests/621 assertions plus typecheck/format/web and iOS JS exports. Not accepted yet: independent session/cache/race review and remaining house/settings/account UI continue.
- Separate Pi domain component task `ourhoomu-v4-domain-api` owns new domain handler/tests only; no DB or existing core-file writes.

## Corrected data acceptance checkpoint

- Independent correction reportd6f7259 approves source244348c (SQL940d881e). Fresh9 commands all0: real cleanup race3 assertions; auth16, data11, schema4, session races20, lifecycle4, migration2, transaction-local ACL/unknown predecessor probe, exact candidate reapply. No active restricted transaction remains; original roles/probe and revoked writerCREATE preserved.
- Isolated integration merge (actual SHA in git history) contains corrected source; fresh forced typecheck/test/format/lint10tasks passed, no cached tasks. API67 units; frontend97 units. Native/provider gates separate.
- Lead granted exclusive synthetic DB window to Pi core HTTP acceptance task ourhoomu-v4-core-http-acceptance, no data writer DB access. Candidate already applied; no reset/new production authorization.
- Native/frontend independent recheck returned remaining original refresh/UI generation findings plus delayed server revoke local-clearing defect. Owner final-corrections task receives exact reproductions; full feature acceptance remains open.
- SW0063 schedule expiry mismatch is a material contract/domain ambiguity: current active schedule has no expiry while OpenAPI requires string. User question pending. Other reads continue; no invented expiration or silently changed contract.

## Accepted local checkpoint and open blockers

- Local fast-forwarded to3b26268 after corrected bounded data acceptance. User AGENTS/docs edits/deleted agent-guide/untracked directory remain unchanged.
- SW0059/SW0064 bounded seam done; SW0004 full product/privacy/retention and SW0005 actual HTTP acceptance remain open.
- Additional independent core review found runtime canonical account method alias mismatch (actual accounts/account vs required ownAccounts/ownAccount), HTTP double pagination at DB default20, and weakened runtime-check status equality. Return to backend owner; no handler integration acceptance yet.
- Domain review of af41e7b found encrypted destination ciphertext mapped as accountNumber, fabricated reserved/action fields, camelCase SW63 vs raw-row adapter mismatch, and PATCH schedule optional-to-full command mismatch. Domain remains unaccepted until owner corrections and actual adapter tests; synthetic tests that assert fake ciphertext are invalid evidence.
- Frontendfe1b1ed fixes native store/remote logout wiring but canonical refresh retry/UI invalidation/delayed revoke generation remain under final owner correction. Do not mark SW0009 done from demo24pass.

## Read parity and remaining focused corrections

- SW63 offline sourceb1139b9 and acceptance checkpointb904aef preserved. Actual restricted run detected activity keyset aggregation order mismatch (page query descending, json aggregation ascending); owner correcting with duplicate-page assertion. Dashboard predicate correction is covered by exact current-viewer totals. First chores test assertion needed explicit limit100 rather than default20; recorded as fixture defect, not product success.
- Core candidate cap100 still fails101-record continuation; independent actual-method offline reproduction captured. Owner now correcting cursor-before-query and continuation probe, required canonical methods and exact status codes. Core DB window revoked before tests; data owner exclusive for read parity.
- QA found frontend test deferred-promise deadlock; owner receives exact sequencing fix, source diff backed up at /tmp/ourhoomu-front-final-backup.patch. No test failure is counted as passing.
- Domain correction attempt failed file recovery and restored its own unaccepted changes to committed af41e7b; no user/root data lost, no integration. New narrow owner task commits verified projection/date/privacy fixes separately.
- Private bill decryption investigation: accepted snapshot copies ciphertext unchanged, but authorized internal function omits recipient_user_id+identifier_digest required by AES AAD. Restricted role has no direct column grant. Database owner will propose reviewed additive server-only seam, never wire exposure or mutable account fallback.

## Independent HTTP acceptance integrated

- QA actual Playwright7/7 at15d6a05 (77b7fb6+244348c), reportbdea841, redacted durable log in common git. QA listener18765/pools closed; explicit DB release.
- Isolated integration backend/contracts tree exactly matches QA tested source; frozen install and forced10offline tasks pass, no cache hits. Local fast-forwarddb2d608 accepts local HTTP milestone while originalSW0005 remains open for real native/live issuer and guarded account deletion.
- Root user dirty files remain preserved; no production/provider/publishing action.
- SW63 sourcebb1da9b addresses unconditional dashboard membership, null optional chore fields and reopened completion actor. Independent review found owner report claimed assertions not committed; owner added real assertions62bcb61 and review will rerun newest script.
- Private destinationAAD migration0004 in offline implementation only; accepted0000–3 immutable, runtime SQL apply blocked until explicit exclusive test window and independent review.
- Frontendc100906 review reproduced actual bootstrap401 deleting valid refresh; final owner task uses protected canonical client and DIRECT bootstrap tests, not manual authority priming. No frontend acceptance inferred from existing passing tests.

## Non-schedule reads integrated; frontend remains blocked

- SW63bb1da9b+62bcb61 independently rerun7groups exit0, report8f4db38; final roles/probe/grants unchanged/pools closed. Isolated mergec731b5b forced10offline tasks pass; local47e34cc accepts non-schedule milestone. Full SW63 schedule expiry still pending user decision.
- Frontend owner direct-bootstrap attempt ended BLOCKED: dirty source/test/UI preserved and backed up /tmp/ourhoomu-frontend-blocked-backup.patch; focused file6pass/3fail including timeout. An untested unconditional401guard was left in dirty source and MUST NOT integrate. QA read-only source-vs-fixture diagnosis assigned; no completion claimed.
- Domain actual typed adapter being implemented in isolated worktree against provisional SW63; own diff backed up /tmp/ourhoomu-domain-adapter-backup.patch. No dispatcher integration acceptance.
- Data owner0004 server-only frozen snapshotAAD implementation offline, no synthetic/production migration applied. Independent review and actual restricted tests pending before use.

## Continuation recovery and narrow pending gates

- Frontend4578a32 committed direct-bootstrap fixture corrections; Lead fresh focused9tests38assertions pass. Independent reviewer approves bounded session layer but current dirty UI still has stale post-await mutation callbacks and busy reset gap. Owner task ui-generation-all-mutations receives exact before-await/current-generation plan; no frontend merge until UI delta verified.
- Domain dirty adapter rewrite silently replaced required endpoints with503 and removed original handlers; architecture review rejects it. Retain backup, return original dispatch then augment narrow data seams. No domain rewrite integrated.
- AAD security reviewer recovered exact accepted old functionOID61299/hash and is executing function-only migration lifecycle/restricted tests on synthetic target with exclusive window; no production operations.
- User schedule expiresAt material question remains pending; no default decision inferred from silence. Work not dependent on it continues.

## Latest reviewed inputs

- Frontend4578 direct-bootstrap fixture tests pass; newfde5587 unified operation guard applied across mutations and busy/form invalidation, author113unit663assertions. Independent exact-delta recheck running; no native/provider acceptance.
- AADdfb7e6e actual review lifecycle apply/reapply/rollback/unknown-body/SECURITY INVOKER refusal passes, originalfunctionOID61299/ACL/owner/config and other core functions/table counts preserved. New private destination frozenAADgroup passes; owner test expectedexpired correction20ae005 advanced reviewea435c1. Review remains open until final suite/state/release.
- Legacy DB core check dashboard deepEqual is stale against acceptedSW63 expanded result; owner will narrowly update assertions preserving all financial expectedvalues, no invented passing result.
- Domain architect identified required server-owned action projections, share live reservation totals, true payment confirmation timestamps and current chore completion. Database owner implementing additive/typed parity offline; no API contract changes. Domain restore task instructed preserve draft backups then restore ONLY own original dispatch401d0ca and narrow adapters, not503rewrite.

## AAD and final UI follow-up

- IndependentAADnewpermission/frozen-snapshot8groups and schema4 pass; function-only lifecycle and privilege invariants pass. Legacy dashboard assertion correctionsd193bec/8d36fe require payercashcount0 and creator1, existing monetary expectedvalues unchanged; reviewer reruns exacttest before release. No blanket oldcorecheck pass claimed yet.
- Frontendfde5587 still rejected for selection guard comparing requestedhouse to previousactivehouse and retaining accounteditforms. Owner selection-guard-fix narrows guard to auth+requestgeneration, preserves house guard for existing mutations, resets formediting on invalidation, adds deferredselection tests. No frontend merge before exact-delta recheck.
- DBowner currently implements required existingwire action objects, authorized share reservations and current payment/chore metadata offline; no OpenAPI rewrite. Schedule mapping still pending user answer. Original domain dispatch restore instructed viaPi with backup preserved; no unreviewed503rewrite integrated.

## Local API/UI accepted and browser harness next

- Frontendaed0bd8 independentreview7379dfa passes117unit671assertions, actualselectionguards+formreset corrected. Integratedforced10tasks and freshPlaywright24demo/localworkerd pass; local4e75c44 accepts boundedclient/UI milestone. Full authenticatedbrowser/native/provider proof remains open.
- Legacycoreteste73a071 actual cleancheckout21groups exit0, report4a85573, poolsclosed. Its assertions preserve exactmoney and current-viewer cashdecision counts; sourceintegrated alongsidefrontend.
- Browserharness Pi work test-only; read-only reviewer suggested customExpoRoot entry using existing testRuntime; no productionauthbridge/publictoken. External authgeneration propagation not implied by testRuntime override.
- Dataactions/reservations offline implementation awaiting exactguardedbill_detail baseline capturedfromDB. Domain dispatch restored original401d0ca; dirtyadapter/tests remain unaccepted and failtypes/lint until narrowcheckpointownerfixes.
