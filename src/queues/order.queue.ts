import { bullMq } from "../utils/bullmq";
//tạo ra 1 queue mới
export const orderQueue = bullMq.createQueue("ORDER_QUEUE")