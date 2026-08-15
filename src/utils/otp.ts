import crypto from "crypto";
import { redisClient } from "./redis";

const OTP_TTL = 5 * 60;
const OTP_PREFIX = "otp:";

export const generateOtp = (): string => {
    return crypto.randomInt(100000, 1000000).toString();
};

export const saveOtp = async (userId: string, otp: string): Promise<void> => {
    await redisClient.set(`${OTP_PREFIX}${userId}`, otp, {
        EX: OTP_TTL,
    });
};


export const verifyOtp = async (userId: string, otp: string): Promise<boolean> => {
    const key = `${OTP_PREFIX}${userId}`;
    const stored = await redisClient.get(key);

    if (!stored || stored !== otp) return false;

    await redisClient.del(key);
    return true;
};

export const deleteOtp = async (userId: string): Promise<void> => {
    await redisClient.del(`${OTP_PREFIX}${userId}`);
};