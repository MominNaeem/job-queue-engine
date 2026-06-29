const { reportQueue, emailQueue, defaultJobOptions } = require('../queues');
const { appendJobLog } = require('../db/client');

async function startOrderWorkflow(orderId, orderData) {
  console.log(`[orderWorkflow] Starting workflow for orderId=${orderId}`);

  const validateJob = await reportQueue.add(
    {
      reportType: 'validateOrder',
      filters: { orderId },
      workflowStep: 'validate',
      orderId,
      orderData,
    },
    { ...defaultJobOptions, jobId: `workflow-validate-${orderId}` }
  );

  console.log(`[orderWorkflow] Enqueued validateOrder job id=${validateJob.id}`);

  validateJob.finished().then(async (validateResult) => {
    console.log(`[orderWorkflow] validateOrder complete for orderId=${orderId}, enqueuing processPayment`);

    const paymentJob = await reportQueue.add(
      {
        reportType: 'processPayment',
        filters: { orderId, amount: orderData.amount },
        workflowStep: 'payment',
        orderId,
        orderData,
        validateResult,
      },
      { ...defaultJobOptions, jobId: `workflow-payment-${orderId}` }
    );

    console.log(`[orderWorkflow] Enqueued processPayment job id=${paymentJob.id}`);
    await appendJobLog(String(validateJob.id), 'info', `Chained to processPayment job ${paymentJob.id}`, { orderId });

    paymentJob.finished().then(async (paymentResult) => {
      console.log(`[orderWorkflow] processPayment complete for orderId=${orderId}, enqueuing sendConfirmation`);

      const confirmationJob = await emailQueue.add(
        {
          to: orderData.customerEmail || 'customer@example.com',
          subject: `Order Confirmation #${orderId}`,
          body: `Your order ${orderId} has been confirmed and payment processed. Amount: ${orderData.amount}`,
          workflowStep: 'confirmation',
          orderId,
          paymentResult,
        },
        { ...defaultJobOptions, jobId: `workflow-confirmation-${orderId}` }
      );

      console.log(`[orderWorkflow] Enqueued sendConfirmation job id=${confirmationJob.id}`);
      await appendJobLog(String(paymentJob.id), 'info', `Chained to sendConfirmation job ${confirmationJob.id}`, { orderId });

      confirmationJob.finished().then(() => {
        console.log(`[orderWorkflow] Workflow complete for orderId=${orderId}`);
      }).catch((err) => {
        console.error(`[orderWorkflow] sendConfirmation failed for orderId=${orderId}: ${err.message}`);
      });
    }).catch((err) => {
      console.error(`[orderWorkflow] processPayment failed for orderId=${orderId}: ${err.message}`);
    });
  }).catch((err) => {
    console.error(`[orderWorkflow] validateOrder failed for orderId=${orderId}: ${err.message}`);
  });

  return validateJob;
}

module.exports = { startOrderWorkflow };
