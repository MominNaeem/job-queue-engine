require('dotenv').config();
const Bull = require('bull');

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: false,
  removeOnFail: false,
};

const redisConfig = {
  redis: process.env.REDIS_URL || 'redis://localhost:6379',
};

const emailQueue = new Bull('email', redisConfig);
const imageQueue = new Bull('image', redisConfig);
const reportQueue = new Bull('report', redisConfig);

emailQueue.settings = { defaultJobOptions };
imageQueue.settings = { defaultJobOptions };
reportQueue.settings = { defaultJobOptions };

async function addEmailJob(data, opts = {}) {
  return emailQueue.add(data, { ...defaultJobOptions, ...opts });
}

async function addImageJob(data, opts = {}) {
  return imageQueue.add(data, { ...defaultJobOptions, ...opts });
}

async function addReportJob(data, opts = {}) {
  return reportQueue.add(data, { ...defaultJobOptions, ...opts });
}

async function getQueueCounts() {
  const [email, image, report] = await Promise.all([
    emailQueue.getJobCounts(),
    imageQueue.getJobCounts(),
    reportQueue.getJobCounts(),
  ]);
  return { email, image, report };
}

module.exports = {
  emailQueue,
  imageQueue,
  reportQueue,
  addEmailJob,
  addImageJob,
  addReportJob,
  getQueueCounts,
  defaultJobOptions,
};
