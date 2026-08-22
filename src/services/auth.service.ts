import { JwtPayload } from "jsonwebtoken";
import { UserData } from "../types/user.type";
import { hashPassword, verifyPassword } from "../utils/hasing";
import { createAccessToken, createRefreshToken, decodedToken, verifyAccessToken, verifyRefreshToken } from "../utils/jwt";
import { userService } from "./user.service";
import { redisClient } from "../utils/redis";
import { prisma } from "../utils/prisma";
import { URLSearchParams } from "node:url";


export const authService = {
    async register(userData: UserData) {
        const existingUsser = await userService.existingEmail(userData.email)

        if (existingUsser) {
            throw new Error("Email has been registered")
        }
        const user = await userService.create(userData)

        if (!user) {
            throw new Error("Cannot register")
        }
        return user
    },
    async login(email: string, password: string) {
        const user = await userService.findByEmail(email)
        if (!user) {
            throw new Error("Not Found User")
        }
        if (user.deletedAt !== null || !user.isActive) {
            throw new Error("Account has been inactive or disabled")
        }

        if (!verifyPassword(password, user.password!)) {
            throw new Error("Password Wrong")
        }

        const token = await authService.createAuthToken(user.id)

        return {
            accessToken: token.accessToken,
            refreshToken: token.refreshToken
        };

    },
    async createAuthToken(userId: string) {
        const accessToken = createAccessToken({
            id: userId
        })
        const refreshToken = createRefreshToken({
            id: userId
        })

        const decoded = verifyAccessToken(accessToken) as JwtPayload & { id: string }
        if (!decoded) {
            throw new Error("Token invalid")
        }

        const checkBlacklist = await this.verifyBlacklist(decoded.jti!)
        if (checkBlacklist) {
            throw new Error("Token Blacklisted")
        }


        const payloadRefresh = decodedToken(refreshToken)

        const jtiRefreshToken = (payloadRefresh as JwtPayload & { jti: string }).jti

        const expRefreshToken = (payloadRefresh as JwtPayload).exp

        const seconds = Math.floor(expRefreshToken! - Date.now() / 1000)

        await redisClient.setEx(
            `refreshToken:${jtiRefreshToken}`,  //jti là để biết refresh token nào đang được sử dụng, tránh việc refresh token bị lạm dụng
            seconds,
            userId.toString() //lưu userId để biết refresh token này thuộc về user nào
        )
        return { accessToken, refreshToken }
    },
    async logout(jti: string, exp: number) {
        const seconds = Math.floor(exp - Date.now() / 1000)
        await redisClient.setEx(`blacklist:${jti}`, seconds, jti)
        return true
    },
    async verifyBlacklist(jti: string) {
        const blacklist = await redisClient.get(`blacklist:${jti}`);
        return blacklist;
    },
    async refreshToken(token: string) {
        const decoded = verifyRefreshToken(token)
        if (!decoded) {
            throw new Error("Refresh Token not valid")
        }

        const { id, jti } = decoded as JwtPayload & { id: string, jti: string }
        const isBlacklisted = await redisClient.get(`blacklist:${jti}`)
        if (isBlacklisted) throw new Error("Token revoked")

        const refreshTokenExisting = await redisClient.exists(
            `refreshToken:${jti}`
        )

        if (!refreshTokenExisting) {
            throw new Error("Refresh Token not valid")
        }
        try {
            await userService.find(id)
        } catch (error) {
            await redisClient.del(`refreshToken:${jti}`)
            throw new Error("Account not found or deleted")
        }

        const accessToken = createAccessToken({
            id,
        })

        const refreshToken = createRefreshToken({
            id,
        })
        const payloadRefresh = decodedToken(refreshToken)
        const jtiRefreshToken = (payloadRefresh as JwtPayload & { jti: string }).jti
        const expRefreshToken = (payloadRefresh as JwtPayload & { exp: string }).exp
        const seconds = Math.floor(expRefreshToken - Date.now() / 1000)
        await redisClient.setEx(`refreshToken:${jtiRefreshToken}`, seconds, id.toString())

        await redisClient.del(`refreshToken:${jti}`)

        return { accessToken, refreshToken }
    },
    async profile(token: string) {
        const decoded = verifyAccessToken(token) as JwtPayload & { id: string }
        if (!decoded) {
            throw new Error("Token invalid")
        }

        const checkBacklist = await this.verifyBlacklist(decoded.jti!)
        if (checkBacklist) {
            throw new Error("Token Blacklisted")
        }

        const user = await userService.find(decoded.id)
        return { user, decoded }
    },
    async changePassword(userId: string, password: string) {
        const changePass = await prisma.user.update({
            where: {
                id: userId,
                isActive: true
            },
            data: {
                password: hashPassword(password)
            }
        })

        if (!changePass) {
            throw new Error("Change password failed")
        }

        return changePass
    },
    async forgotPassword(userId: string, password: string) {
        const changePass = await prisma.user.update({
            where: {
                id: userId,
                isActive: true
            },
            data: {
                password: hashPassword(password)
            }
        })

        if (!changePass) {
            throw new Error("Change password failed")
        }

        return changePass
    },
    async googleRedirect(redirectTo: string) {
        console.log("redirectTo:", JSON.stringify(redirectTo))
        console.log("FRONTEND:", JSON.stringify(process.env.FRONTEND))
        console.log("DASHBOARD:", JSON.stringify(process.env.DASHBOARD))
        const allowed = [process.env.FRONTEND, process.env.DASHBOARD]
        if (!allowed.includes(redirectTo)) {
            throw new Error("Invalid redirect origin")
        }
        const url = process.env.OAUTH_URL as string
        const query = {
            client_id: process.env.CLIENT_ID as string,
            redirect_uri: process.env.CALLBACK_URI as string,
            response_type: "code",
            scope: "email profile",
            access_type: "offline",
            state: redirectTo,
        }

        const linkRedirect = `${url}?${new URLSearchParams(query)}`

        return linkRedirect
    },
    async googleCallback(code: string, state: string) {
        const allowed = [process.env.FRONTEND, process.env.DASHBOARD]
        const target = allowed.includes(state) ? state : process.env.FRONTEND
        const callback = `${target}?code=${code}`

        return callback
    },
    async googleLogin(code: string) {
        const responseToken = await fetch(`https://oauth2.googleapis.com/token`, {
            method: "POST",
            headers: {
                "Content-type": "application/json"
            },
            body: JSON.stringify({
                code: code,
                client_id: process.env.CLIENT_ID as string,
                client_secret: process.env.CLIENT_SECRET as string,
                redirect_uri: process.env.CALLBACK_URI,
                grant_type: "authorization_code"
            })
        })
        const { access_token: accessToken } = await responseToken.json()
        if (!accessToken) {
            throw new Error("Google login failed: No access token");
        }
        const response = await fetch(
            `https://www.googleapis.com/oauth2/v1/userinfo`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }
        )
        const data = await response.json()
        if (!data.email) {
            throw new Error("Google data invalid")
        }

        let user = await prisma.user.findFirst({
            where: {
                email: data.email
            }
        });
        if (!user) {
            user = await prisma.user.create({
                data: {
                    email: data.email,
                    name: data.name,
                    isActive: true
                }
            })
        }
        else {
            if (user.deletedAt !== null || !user.isActive) {
                throw new Error("Account has been inactive or disabled")
            }

            user = await prisma.user.update({
                where: {
                    id: user.id
                },
                data: {
                    name: data.name,
                }
            });
        }

        const token = await authService.createAuthToken(user.id)

        return {
            accessToken: token.accessToken,
            refreshToken: token.refreshToken
        };
    }
}