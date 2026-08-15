import nodemailer from "nodemailer"
import SMTPTransport from "nodemailer/lib/smtp-transport";
import ejs from "ejs"

let transporterInstance: nodemailer.Transporter<SMTPTransport.SentMessageInfo, SMTPTransport.Options> | null = null;

export const mailTransporter= () => {
    if (!transporterInstance) {
        transporterInstance = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: +process.env.SMTP_PORT!,
            secure: +process.env.SMTP_PORT! === 465,
            auth: {
                user: process.env.SMTP_USERNAME,
                pass: process.env.SMTP_PASSWORD,
            },
        });
    }
    return transporterInstance
}

export const sendMail = async(to: string, subject: string, message: string) => {
    try {
        const transporter = mailTransporter()
        const info = await transporter.sendMail({
            from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM}>`,
            to,
            subject,
            html: message,
        });
        return info
    } catch (err) {
        console.error("Error while sending mail:", err);
        return null
    }
}

export const sendMailTemplate = async(to: string, subject: string, template: string, data: Record<string, unknown>) => {
    const path = `${process.cwd()}/src/mailTemplates/${template}.ejs`
    const appBaseUrl = (process.env.FRONTEND ?? "http://localhost:3000").replace(/\/$/, "")
    const html = await ejs.renderFile(path, {
        appBaseUrl,
        logoUrl: `${appBaseUrl}/gsi-logo.svg`,
        ...data,
    })
    return sendMail(to, subject, html)
}
