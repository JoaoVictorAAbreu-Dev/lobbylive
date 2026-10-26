import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
const template = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
try {
  await writeFile(new URL('../.env', import.meta.url), template.replace(/^JWT_SECRET=$/m, `JWT_SECRET=${randomBytes(48).toString('base64url')}`), { flag: 'wx', mode: 0o600 });
  console.log('.env criado com segredo local. O valor não é exibido nem versionado.');
} catch (error) {
  if (error.code === 'EEXIST') console.log('.env já existe; preservado.');
  else throw error;
}
