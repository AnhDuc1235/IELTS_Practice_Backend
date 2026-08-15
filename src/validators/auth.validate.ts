import z from "zod";
import { userService } from "../services/user.service";

export const registerSchema = z.object({
  name: z.string().min(1, "name cannot be empty"),
  email: z
    .string()
    .min(1, "Email cannot be empty")
    .pipe(z.email("Email not in correct form"))
    .refine(
      async (email: string) => {
        const existingEmail = await userService.existingEmail(email);
        return !existingEmail;
      },
      {
        message: "Email has already existed",
      },
    ),
  password: z.string().min(6, "password must be more than 6 digits"),
});

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email không được để trống")
    .pipe(z.email("Email không đúng định dạng")),

  password: z.string().min(6, "Mật khẩu phải từ 6 ký tự"),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "refresh token are empty")
})