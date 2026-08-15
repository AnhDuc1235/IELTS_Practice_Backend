import { Job } from "bullmq";
import { sendMailTemplate } from "../utils/mail";


export const email = {
    emailRegister: async (job: Job) => {
        if (job.name === "send-email-register") {
            const data = job.data
            const result = await sendMailTemplate(data.to, data.subject, data.template, data.options)
            if (!result) {
                throw new Error("Failed to send email")
            }
        }
    },
    orderEmail: async (job: Job) => {
        if (job.name === "send-email-order") {
            const data = job.data
            const result = await sendMailTemplate(data.to, data.subject, data.template, data.options)
            if (!result) {
                throw new Error("Failed to send order email")
            }
        }
    },
    otpEmail: async (job: Job) => {
        if (job.name === "send-email-otp") {
            const data = job.data
            const result = await sendMailTemplate(data.to, data.subject, data.template, data.options)
            if (!result) {
                throw new Error("Failed to send otp")
            }
        }
    }
}
