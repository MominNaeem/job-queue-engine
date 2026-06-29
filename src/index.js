require('dotenv').config();
const express = require('express');
const { setupBullBoard } = require('./api/bullboard');
const routes = require('./api/routes');

require('./workers/emailWorker');
require('./workers/imageWorker');
require('./workers/reportWorker');

const { closeEmailWorker } = require('./workers/emailWorker');
const { closeImageWorker } = require('./workers/imageWorker');
const { closeReportWorker } = require('./workers/reportWorker');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

setupBullBoard(app);
app.use('/', routes);

const server = app.listen(PORT, () => {
  console.log(`[server] Job Queue Engine running on port ${PORT}`);
  console.log(`[server] Bull Board UI: http://localhost:${PORT}/admin/queues`);
  console.log(`[server] Health check: http://localhost:${PORT}/health`);
});

async function gracefulShutdown(signal) {
  console.log(`[server] Received ${signal}, shutting down gracefully...`);

  server.close(async () => {
    console.log('[server] HTTP server closed');
    try {
      await Promise.all([
        closeEmailWorker(),
        closeImageWorker(),
        closeReportWorker(),
      ]);
      console.log('[server] All workers closed');
      process.exit(0);
    } catch (err) {
      console.error('[server] Error during shutdown:', err.message);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error('[server] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('[server] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught Exception:', err.message);
  process.exit(1);
});
