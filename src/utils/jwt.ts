import jsonwebtoken, { JwtPayload } from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET as string
const JWT_EXPIRED = process.env.JWT_EXPIRED as unknown as number
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string;
const JWT_REFRESH_EXPIRED = process.env.JWT_REFRESH_EXPIRED as unknown as number
export const createAccessToken = (payload: JwtPayload) => {
    
    return jsonwebtoken.sign(
        {...payload, jti: crypto.randomUUID() },
        JWT_SECRET, {
            expiresIn: JWT_EXPIRED 
        }
    )
}
export const createRefreshToken = (payload: JwtPayload) => {
    return jsonwebtoken.sign(
        {...payload, jti: crypto.randomUUID() },
        JWT_REFRESH_SECRET, {
            expiresIn: JWT_REFRESH_EXPIRED
        }
    )
}

export const verifyAccessToken = (token: string) => {
    try {
        return jsonwebtoken.verify(token, JWT_SECRET)
    } catch (error) {
        return false
    }
}

export const verifyRefreshToken = (token: string) => {
    try {
        return jsonwebtoken.verify(token, JWT_REFRESH_SECRET)
    } catch (error) {
        return false
    }
}

export const decodedToken = (token:string) => {
    return jsonwebtoken.decode(token)
}