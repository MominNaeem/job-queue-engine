const { Router } = require('express');
const { addEmailJob, addImageJob, addReportJob, emailQueue, imageQueue, reportQueue, getQueueCounts } = require('../queues');
const { startOrderWorkflow } = require('../workflows/orderWorkflow');

const router = Router();

router.get('/health', async (req, res) => {
  try {
    const counts = await getQueueCounts();
    res.json({ status: 'ok', queues: counts });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.post('/jobs/email', async (req, res) => {
  const { to, subject, body } = req.body;

  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, body' });
  }

  try {
    const job = await addEmailJob({ to, subject, body });
    res.status(202).json({ jobId: job.id, queue: 'email', status: 'queued' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/jobs/image', async (req, res) => {
  const { imageUrl, operations } = req.body;

  if (!imageUrl) {
    return res.status(400).json({ error: 'Missing required field: imageUrl' });
  }

  try {
    const job = await addImageJob({ imageUrl, operations: operations || [] });
    res.status(202).json({ jobId: job.id, queue: 'image', status: 'queued' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/jobs/report', async (req, res) => {
  const { reportType, filters } = req.body;

  if (!reportType) {
    return res.status(400).json({ error: 'Missing required field: reportType' });
  }

  try {
    const job = await addReportJob({ reportType, filters: filters || {} });
    res.status(202).json({ jobId: job.id, queue: 'report', status: 'queued' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/workflows/order', async (req, res) => {
  const { orderId, orderData } = req.body;

  if (!orderId || !orderData) {
    return res.status(400).json({ error: 'Missing required fields: orderId, orderData' });
  }

  try {
    const firstJob = await startOrderWorkflow(orderId, orderData);
    res.status(202).json({
      workflowStarted: true,
      orderId,
      firstJobId: firstJob.id,
      queue: 'report',
      status: 'queued',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/jobs/:id', async (req, res) => {
  const { id } = req.params;
  const { queue: queueName = 'email' } = req.query;

  let queue;
  if (queueName === 'email') queue = emailQueue;
  else if (queueName === 'image') queue = imageQueue;
  else if (queueName === 'report') queue = reportQueue;
  else return res.status(400).json({ error: 'Invalid queue. Use: email, image, report' });

  try {
    const job = await queue.getJob(id);

    if (!job) {
      return res.status(404).json({ error: `Job ${id} not found in ${queueName} queue` });
    }

    const state = await job.getState();
    const progress = job._progress;

    res.json({
      id: job.id,
      queue: queueName,
      state,
      progress,
      data: job.data,
      result: job.returnvalue,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      createdAt: new Date(job.timestamp).toISOString(),
      processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
      finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
