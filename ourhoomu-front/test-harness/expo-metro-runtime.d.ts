// @expo/metro-runtime ships no type declarations; the harness entry imports it
// for its web Fast Refresh side effects only, mirroring the production
// entry-classic bootstrap.
declare module '@expo/metro-runtime';
