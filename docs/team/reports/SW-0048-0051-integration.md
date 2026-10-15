# Lead integration — issuer and typed house components

Accepted source17281b7/recheck0c98141 for issuer; source26c009d/reviewa37d64c
for house repository/pagination. Merged sequentially in Lead checkout: issuer
6923260, frontend6f1fd20, original issuer review history4591629 (no file change).
Root local fast-forward92392be to4591629; user guide and untracked root bun.lock
preserved. The last history merge changes no tested files.

Fresh frozen installs in both packages passed. Integrated API typecheck/lint/
format and63tests90assertions passed; frontend both typechecks/format and
53tests383assertions passed. Integrated actual Playwright24/24 passed in23.9s,
zero skip/unexpected/flaky; managed servers18047/48/49 stopped. Machine results
retained in root ignored core-implementation/components-48-51. Independent reviewer
additionally passed18negative frontend probes and50signed Bun/workerd issuer cases.

Source/reviewer workers settled and released/captured before ack. Reports tracked
and review artifacts retained in /Users/afe/orca/artifacts/ourhoomu/SW-0053-review.
A negative-probes.local.ts copy points to persistent root instead of removed
review checkout; original script/report remains unchanged. Cleanup requires merged
ancestry, no writers/processes, clean source and generated-only ignored files.

These components do not implement house/auth handlers or native Google/Apple
login. API/session/house/bill/chores integration, provider/retention/native/release
gates remain open. Data correctiond01aba2 still awaits independent SW-0052;
separate timezone parity correctionSW-0054 remains before house API acceptance.
Graft ACTIVE in exact Lead/issuer/house/data checkouts; Lead observed retrieval
estimates156775 across six reported savings lines this continuation, not billing.
