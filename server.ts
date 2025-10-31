import { createServer, Server } from 'http';
import { IncomingMessage, ServerResponse } from 'http';
import next from 'next';
import { parse } from 'url';
import { initializeKafka } from './src/lib/kafka';
import { startKafkaConsumer } from './src/lib/kafka-consumer';

const dev = process.env.NODE_ENV !== 'production';
const hostname: string = 'localhost';
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

  // Initialize Kafka
  try {
    await initializeKafka();
    await startKafkaConsumer();
    console.log('Kafka initialized successfully');
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
