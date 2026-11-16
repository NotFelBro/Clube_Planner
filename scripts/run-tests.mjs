import 'dotenv/config';
import { spawn } from 'node:child_process';
import setup from '../tests/setupUserIndexes.mjs';

try {
  if (!process.env.MONGODB_TEST_URI) throw new Error('Banco de testes não configurado.');
  // Executado fora do Vite para evitar que um erro de conexão seja mascarado
  // pelo processamento de source maps na inicialização do Vitest.
  await setup();
  const child = spawn(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...process.argv.slice(2)], {
    stdio: 'inherit', env: { ...process.env, NODE_ENV: 'test' },
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
  process.exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => resolve(code ?? 1));
  });
} catch (error) {
  console.error('Não foi possível iniciar os testes:', error.name);
  console.error('Verifique MONGODB_TEST_URI e o MongoDB local de testes (réplica rs0, porta 27017, banco clube_planner_test).');
  process.exitCode = 1;
}
