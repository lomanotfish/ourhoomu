# Shared contracts

`@ourhoomu/contracts` exports **types only**, directly from `src/dto.ts`.
Both apps depend on `workspace:*`; their original `src/http/dto.ts` and
`src/api/dto.ts` paths remain compatibility re-exports. There is no runtime
validator, database model, provider SDK or emitted JavaScript in this package.

The authoritative shared API schema remains at
[`docs/project/openapi.yaml`](../../docs/project/openapi.yaml), frozen version
`0.3.2-core-proposal`. It stays at its existing documented path to preserve
contract references. `openapi-typescript` 7.13.0 and Prettier 3.9.10 generate
one DTO file here. From the repository root:

```sh
bun run generate:contracts  # intentionally rewrites the generated DTO
bun run check:contracts    # generates in memory and compares; does not write
bun run typecheck
```

Turbo's contracts build is the reproducibility check, with no emitted output.
The schema is an explicit input to that task. App checks and exports depend on
this task, propagating changes in shared source/schema through their hashes.

Keep Drizzle/SQL schemas and server validation in `ourhoomu-api`; do not export
them to Expo. Add approved wire schemas to the authoritative OpenAPI contract,
then regenerate. Do not hand-edit the generated DTO. TypeScript types do not
perform runtime validation.

No `packages/utils` was added: the present money/demo/date helpers have only a
frontend consumer. When a function actually has two app consumers, create a
private `@ourhoomu/utils` package with explicit source exports and its own unit
tests/typecheck, add `workspace:*` dependencies to both consumers, and keep it
free of Node/Workers/native-specific imports and server secrets. Do not move
business behavior just to populate the shared directory.
