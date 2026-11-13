import { createServer } from 'node:net';
export async function assertPortsFree(ports) {
  for (const port of ports) {
    await new Promise((resolve, reject) => {
      const server = createServer();
      server.once('error', () => reject(new Error(`Port ${port} is already in use. Stop the existing app before starting another stack.`)));
      server.listen(port, '127.0.0.1', () => server.close(resolve));
    });
  }
}
