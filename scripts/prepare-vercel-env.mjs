import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const arquivo = '.env.vercel';
try {
  await writeFile(arquivo, [
    '# Arquivo privado. Complete a conexão Atlas e o SMTP antes de importar na Vercel.',
    'NODE_ENV=production',
    'FRONTEND_URL=https://clube-planner.vercel.app',
    'MONGODB_URI=',
    `JWT_ACCESS_SECRET=${randomBytes(64).toString('hex')}`,
    `EMAIL_CODE_SECRET=${randomBytes(32).toString('hex')}`,
    `CRON_SECRET=${randomBytes(32).toString('hex')}`,
    'JWT_ACCESS_EXPIRES_IN=15m',
    'REFRESH_TOKEN_EXPIRES_DAYS=7',
    'SMTP_HOST=',
    'SMTP_PORT=',
    'SMTP_USER=',
    'SMTP_PASS=',
    'CHECKOUT_TEST_MODE=',
    '',
  ].join('\n'), { mode: 0o600, flag: 'wx' });
  console.log(`Arquivo privado criado: ${arquivo}. Complete o Atlas e o SMTP; não compartilhe seu conteúdo.`);
} catch (error) {
  console.error(error.code === 'EEXIST' ? `${arquivo} já existe e foi preservado.` : 'Não foi possível criar o arquivo privado.');
  process.exitCode = 1;
}
