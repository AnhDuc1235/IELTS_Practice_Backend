import { orderQueue } from "../queues/order.queue";


orderQueue.upsertJobScheduler('order', {
    pattern: "0 */5 * * * *"
}, {
    name: 'order-expired',
    data: { },
    opts: {
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
      attempts: 5,
      removeOnFail: 1000,
    },
  },)