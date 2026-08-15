export type UserData = {
  id: string;
  name: string;
  email: string;
  password: string;
};

export interface userQuery {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
}