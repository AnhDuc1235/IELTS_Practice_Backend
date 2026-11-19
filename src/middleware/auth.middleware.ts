import { NextFunction, Request, Response } from "express";
import { authService } from "../services/auth.service";

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.get("authorization")?.split(" ")[1];
  try {
    const { user, decoded } = await authService.profile(token!);
    if (user) {
      req.user = user;
    }

    if (decoded) {
      req.tokenJti = decoded.jti as string;
      req.tokenExp = decoded.exp as number;
    }

    next();
  } catch {
    return res.status(401).json({
      message: "Unauthorize",
    });
  }
};

// Same as authMiddleware, but requests without a token continue as guests (req.user stays undefined).
// A token that is sent but invalid is still rejected with 401.
export const optionalAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.get("authorization")) {
    return next();
  }
  return authMiddleware(req, res, next);
};
