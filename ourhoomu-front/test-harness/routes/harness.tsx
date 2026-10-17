// Re-exports the actual production API-mode screen so the harness exercises
// the real component, not a copy. This route matches the /harness URL used by
// the Playwright harness document.
export { default } from '../../app/api';
