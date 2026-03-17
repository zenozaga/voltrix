/**
 * Harness compartido: arranca un worker en proceso aislado,
 * espera que esté listo, hace warmup con autocannon y lo apaga limpio.
 */
import { fork, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import autocannon from 'autocannon';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ServerHandle {
  base: string;
  shutdown: () => Promise<void>;
}

export async function startServer(
  workerFile: string,
  port: number
): Promise<ServerHandle> {
  const workerPath = join(__dirname, workerFile);

  const child: ChildProcess = fork(workerPath, [], {
    env: { ...process.env, BENCH_PORT: String(port) },
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
  });

  // Esperar señal de readiness (o error)
  await new Promise<void>((resolve, reject) => {
    child.on('message', (msg: any) => {
      if (msg?.ready) resolve();
      else if (msg?.error) reject(new Error(msg.error));
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
    });
  });

  const base = `http://127.0.0.1:${port}`;

  // Warmup con autocannon — proceso aislado, evento loop separado
  await new Promise<void>((resolve) =>
    autocannon({ url: `${base}/ping`, duration: 1, connections: 10 }, () => resolve())
  );

  return {
    base,
    shutdown: () =>
      new Promise<void>((resolve) => {
        child.once('exit', () => resolve());
        child.send('shutdown');
        // Fallback: kill si no responde en 3s
        setTimeout(() => { child.kill(); resolve(); }, 3000);
      }),
  };
}
