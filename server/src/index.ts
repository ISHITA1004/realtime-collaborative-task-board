import http from 'http';
import { createApp } from './app';
import { connectDB } from './config/db';
import { env } from './config/env';
import { initSockets } from './sockets';

async function main() {
  await connectDB();

  const app = createApp();
  const server = http.createServer(app);
  initSockets(server);

  server.listen(env.port, () => {
    console.log(`server listening on port ${env.port}`);
  });
}

main().catch((err) => {
  console.error('failed to start server', err);
  process.exit(1);
});
