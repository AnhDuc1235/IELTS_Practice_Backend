export interface productQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  sort?: string;
  minPrice?: number | null;
  maxPrice?: number | null;
  price?: string
}