import { bullMq } from "../utils/bullmq";
//tạo ra 1 queue mới
export const emailQueue = bullMq.createQueue("EMAIL_QUEUE")

