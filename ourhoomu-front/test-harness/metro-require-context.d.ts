// Test-only ambient typing for Metro's `require.context`, used exclusively by
// `test-harness/entry.tsx` to register the harness route tree. Neither
// bun-types nor @types/node declare this bundler extension, so the production
// `tsc --noEmit` gate failed on the harness entry. This adds the missing
// member to the ambient `NodeJS.Require` interface; it changes no runtime
// behavior and no production source.
//
// The return type mirrors expo-router's own `RequireContext` interface
// (node_modules/expo-router/build/types.d.ts), which is what `<ExpoRoot
// context={...} />` expects.
declare global {
  namespace NodeJS {
    interface Require {
      context(
        directory: string,
        useSubdirectories?: boolean,
        extensions?: RegExp,
        mode?: 'sync' | 'eager' | 'lazy' | 'weak',
      ): import('expo-router/build/types').RequireContext;
    }
  }
}

export {};
