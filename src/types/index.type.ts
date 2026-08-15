declare module "express" {
  export interface Request {
    user?: {
      id: string;
      email: string;
      name: string;
      avatar: string | null;
      phone: string | null;
      address: string | null;
      city: string | null;
      district: string | null;
      ward: string | null;
      createdAt: Date;
      updatedAt: Date;
    };

    tokenJti?: string;
    tokenExp?: number;
  }
}