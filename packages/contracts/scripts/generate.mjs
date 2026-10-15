import { readFile, writeFile } from 'node:fs/promises';
import openapiTS, { astToString, COMMENT_HEADER } from 'openapi-typescript';
import { format } from 'prettier';

const source = new URL('../../../docs/project/openapi.yaml', import.meta.url);
const target = new URL('../src/dto.ts', import.meta.url);
const options = JSON.parse(await readFile(new URL('../.prettierrc.json', import.meta.url), 'utf8'));
const generated = await format(COMMENT_HEADER + astToString(await openapiTS(source)), {
  ...options,
  parser: 'typescript',
});
if (process.argv.includes('--check')) {
  if ((await readFile(target, 'utf8')) !== generated) {
    throw new Error(
      'Generated contracts differ from the frozen OpenAPI source; run bun run generate:contracts',
    );
  }
  console.log('Generated contracts match docs/project/openapi.yaml');
} else {
  await writeFile(target, generated);
}
