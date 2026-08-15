export interface orderQuery {
  page?: number;
  limit?: number;
  sort?: string;
}

export interface CreateOrderInput {
  receiverName: string;
  phone: string;
  shippingAddress: string;
  paymentMethod: string;
}