const { reportQueue } = require('../queues');
const { writeJobResult, insertJob, appendJobLog } = require('../db/client');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processReport(job) {
  const { reportType, filters = {}, workflowStep } = job.data;

  await insertJob(String(job.id), 'report', reportType || 'report', job.data);
  await appendJobLog(String(job.id), 'info', `Processing report job ${job.id}`, { reportType, filters });

  console.log(`[reportWorker] Generating report type=${reportType} filters=${JSON.stringify(filters)}`);

  await job.progress(10);
  await delay(500);
  await job.progress(40);
  await delay(800);
  await job.progress(80);
  await delay(700);

  const result = {
    generated: true,
    reportType,
    filters,
    rowCount: Math.floor(Math.random() * 10000) + 1,
    reportUrl: `/reports/${reportType}-${job.id}.pdf`,
    generatedAt: new Date().toISOString(),
    durationMs: 2000,
    workflowStep: workflowStep || null,
  };

  console.log(`[reportWorker] Report generated reportUrl=${result.reportUrl} rows=${result.rowCount}`);

  await job.progress(100);
  await writeJobResult(String(job.id), 'report', 'completed', result, null);
  await appendJobLog(String(job.id), 'info', `Report generated successfully`, result);

  return result;
}

reportQueue.process(async (job) => {
  return processReport(job);
});

reportQueue.on('completed', (job, result) => {
  console.log(`[reportWorker] Job ${job.id} completed`, result);
});

reportQueue.on('failed', async (job, err) => {
  console.error(`[reportWorker] Job ${job.id} failed: ${err.message}`);
  await writeJobResult(String(job.id), 'report', 'failed', null, err.message);
  await appendJobLog(String(job.id), 'error', `Job failed: ${err.message}`, { stack: err.stack });
});

reportQueue.on('stalled', (job) => {
  console.warn(`[reportWorker] Job ${job.id} stalled`);
});

async function closeReportWorker() {
  await reportQueue.close();
  console.log('[reportWorker] Worker closed');
}

module.exports = { closeReportWorker };
