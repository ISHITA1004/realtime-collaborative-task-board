import http from 'http';
import { createApp } from './app';
import { connectDB } from './config/db';
import { env } from './config/env';

async function main() {
  await connectDB();

  const app = createApp();
  const server = http.createServer(app);

  server.listen(env.port, () => {
    console.log(`server listening on port ${env.port}`);
  });
}

main().catch((err) => {
  console.error('failed to start server', err);
  process.exit(1);
});
