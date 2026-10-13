import { defineConfig } from 'drizzle-kit';

// Generation is offline. Applying SQL is only possible through scripts/db/migrate.ts's target guard.
export default defineConfig({ dialect: 'postgresql', schema: './src/db/schema.ts', out: './drizzle', strict: true, verbose: true });
