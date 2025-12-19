import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import next from 'next';
import { parse } from 'url';
import { initializeKafka } from './src/lib/kafka';
import { connectRedis } from './src/lib/redis';

const dev = process.env.NODE_ENV !== 'production';
const hostname: string = process.env.HOSTNAME || 'localhost';
const port: number = parseInt(process.env.PORT || '3000', 10);

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async (): Promise<void> => {
  // Create HTTP server
  const server: Server = createServer(async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      const parsedUrl = parse(req.url || '', true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Initialize Redis
  try {
    await connectRedis();
    console.log('Redis connected successfully');
  } catch (error) {
    console.error('Redis connection failed:', error);
    // Continue without Redis for development
  }

  // Initialize Kafka (producer only - consumer runs in websocket server)
  try {
    await initializeKafka();
    console.log('Kafka producer initialized successfully');
  } catch (error) {
    console.error('Kafka initialization failed:', error);
    // Continue without Kafka for development
  }

  // Start server
  server.listen(port, (err?: Error): void => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
  });
}).catch((err: Error): void => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
