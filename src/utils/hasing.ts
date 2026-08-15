import bcrypt from "bcrypt"
const SALT_ROUND = 10
export const hashPassword = (passsword: string) => {
    return bcrypt.hashSync(passsword, SALT_ROUND)
}
export const verifyPassword = (plainPassword: string, hashPassword: string) => {
    return bcrypt.compareSync(plainPassword, hashPassword)
}