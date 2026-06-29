const { emailQueue } = require('../queues');
const { writeJobResult, insertJob, appendJobLog } = require('../db/client');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processEmail(job) {
  const { to, subject, body } = job.data;

  await insertJob(String(job.id), 'email', 'email', job.data);
  await appendJobLog(String(job.id), 'info', `Processing email job ${job.id}`, { to, subject });

  console.log(`[emailWorker] Sending email to=${to} subject="${subject}"`);

  await job.progress(25);
  await delay(200);

  await job.progress(75);
  await delay(300);

  const result = {
    delivered: true,
    to,
    subject,
    sentAt: new Date().toISOString(),
    messageId: `msg-${job.id}-${Date.now()}`,
  };

  console.log(`[emailWorker] Email delivered to=${to} messageId=${result.messageId}`);

  await job.progress(100);
  await writeJobResult(String(job.id), 'email', 'completed', result, null);
  await appendJobLog(String(job.id), 'info', `Email delivered to ${to}`, result);

  return result;
}

emailQueue.process(async (job) => {
  return processEmail(job);
});

emailQueue.on('completed', (job, result) => {
  console.log(`[emailWorker] Job ${job.id} completed`, result);
});

emailQueue.on('failed', async (job, err) => {
  console.error(`[emailWorker] Job ${job.id} failed: ${err.message}`);
  await writeJobResult(String(job.id), 'email', 'failed', null, err.message);
  await appendJobLog(String(job.id), 'error', `Job failed: ${err.message}`, { stack: err.stack });
});

emailQueue.on('stalled', (job) => {
  console.warn(`[emailWorker] Job ${job.id} stalled`);
});

async function closeEmailWorker() {
  await emailQueue.close();
  console.log('[emailWorker] Worker closed');
}

module.exports = { closeEmailWorker };
