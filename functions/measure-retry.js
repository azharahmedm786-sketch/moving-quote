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

async function measure() {
  const start = Date.now();
  const { retried } = await retryFailedNotifications();
  const end = Date.now();
  console.log(`Retried ${retried} notifications in ${end - start}ms`);
}

measure();
