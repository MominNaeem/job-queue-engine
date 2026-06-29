const { imageQueue } = require('../queues');
const { writeJobResult, insertJob, appendJobLog } = require('../db/client');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processImage(job) {
  const { imageUrl, operations = [] } = job.data;

  await insertJob(String(job.id), 'image', 'image', job.data);
  await appendJobLog(String(job.id), 'info', `Processing image job ${job.id}`, { imageUrl, operations });

  console.log(`[imageWorker] Processing image url=${imageUrl} operations=${JSON.stringify(operations)}`);

  await job.progress(10);

  const totalOps = operations.length || 1;
  const stepSize = Math.floor(80 / totalOps);

  for (let i = 0; i < totalOps; i++) {
    const op = operations[i] || 'default';
    await delay(1000 / totalOps);
    await job.progress(10 + stepSize * (i + 1));
    console.log(`[imageWorker] Applied operation: ${op}`);
  }

  await delay(200);

  const result = {
    processed: true,
    imageUrl,
    operations,
    outputUrl: `${imageUrl}?processed=true&ops=${operations.join(',')}`,
    processedAt: new Date().toISOString(),
    durationMs: 1000,
  };

  console.log(`[imageWorker] Image processed outputUrl=${result.outputUrl}`);

  await job.progress(100);
  await writeJobResult(String(job.id), 'image', 'completed', result, null);
  await appendJobLog(String(job.id), 'info', `Image processed successfully`, result);

  return result;
}

imageQueue.process(async (job) => {
  return processImage(job);
});

imageQueue.on('completed', (job, result) => {
  console.log(`[imageWorker] Job ${job.id} completed`, result);
});

imageQueue.on('failed', async (job, err) => {
  console.error(`[imageWorker] Job ${job.id} failed: ${err.message}`);
  await writeJobResult(String(job.id), 'image', 'failed', null, err.message);
  await appendJobLog(String(job.id), 'error', `Job failed: ${err.message}`, { stack: err.stack });
});

imageQueue.on('stalled', (job) => {
  console.warn(`[imageWorker] Job ${job.id} stalled`);
});

async function closeImageWorker() {
  await imageQueue.close();
  console.log('[imageWorker] Worker closed');
}

module.exports = { closeImageWorker };
