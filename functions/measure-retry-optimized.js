const brevo = require('./brevo-client');

const admin = {
  firestore: () => {
    const docs = Array.from({ length: 50 }).map((_, i) => ({
      data: () => ({
        retries: 0,
        context: { customerName: 'Test', subject: 'Test', html: '<p>Test</p>' },
        recipient: `test${i}@example.com`
      }),
      ref: {
        update: async () => {
          return new Promise((resolve) => setTimeout(resolve, 20)); // simulated DB latency
        }
      }
    }));

    return {
      collection: () => ({
        where: () => ({
          where: () => ({
            limit: () => ({
              get: async () => ({
                empty: false,
                docs
              })
            })
          })
        })
      }),
    };
  }
};
admin.firestore.FieldValue = { serverTimestamp: () => 'timestamp' };

// We load the module inside a proxy/override environment
const proxyquire = require('proxyquire');
const { retryFailedNotifications } = proxyquire('./notification-service', {
  'firebase-admin': admin,
  './brevo-client': {
    sendBrevoEmail: async () => {
      return new Promise((resolve) => setTimeout(() => resolve({ success: true, response: { id: 1 } }), 50));
    }
  }
});

// override logic for optimized version inside measure-retry-optimized.js itself to see
async function retryFailedNotificationsOptimized() {
  const db = admin.firestore();
  const snap = await db.collection("notificationLogs")
    .where("status", "==", "failed")
    .where("channel", "==", "email")
    .limit(50)
    .get();

  if (snap.empty) return { retried: 0 };

  let retried = 0;
  const MAX_RETRIES = 3;
  const promises = [];

  for (const doc of snap.docs) {
    const log = doc.data();
    const retries = log.retries || 0;
    if (retries >= MAX_RETRIES) continue;

    // We don't have the original template/data stored, so retries
    // only apply to admin emails and generic re-sends where the
    // full context was preserved in the log's "context" field.
    if (!log.context) continue;

    const promise = (async () => {
      const result = await brevo.sendBrevoEmail({
        toEmail: log.recipient,
        toName: log.context.customerName || "",
        subject: log.context.subject,
        htmlContent: log.context.html
      });

      await doc.ref.update({
        status: result.success ? "sent" : "failed",
        retries: retries + 1,
        response: result.response ? JSON.stringify(result.response).slice(0, 1000) : null,
        error: result.error || null,
        lastAttempt: admin.firestore.FieldValue.serverTimestamp()
      });
    })();
    promises.push(promise);
    retried++;
  }

  await Promise.all(promises);
  return { retried };
}

async function measure() {
  // Let's use our local mock for brevo.sendBrevoEmail instead of actual API
  brevo.sendBrevoEmail = async () => {
    return new Promise((resolve) => setTimeout(() => resolve({ success: true, response: { id: 1 } }), 50));
  };

  const start = Date.now();
  const { retried } = await retryFailedNotificationsOptimized();
  const end = Date.now();
  console.log(`Retried ${retried} notifications in ${end - start}ms`);
}

measure();
