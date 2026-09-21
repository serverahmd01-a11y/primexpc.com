export type Product = {
  _id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  subCategory?: string;
  condition?: 'new' | 'refurbished';
  video?: string;
  images: string[];
  averageRating: number;
  totalReviews: number;
  featured?: boolean;
  salePrice?: number;
  dealEndsAt?: string;
  gstRate?: number;
  specifications?: { name: string; value: string }[];
  createdAt?: string;
};

export type CartItem = {
  slug: string;
  name: string;
  brand: string;
  price: number;
  priceLabel: string;
  qty: number;
  productId?: string;
  gstRate?: number;
  image?: string;
};

export type User = {
  _id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  imageUrl?: string;
};

export type Category =
  | 'Processor' | 'CPU Cooler' | 'Motherboard' | 'RAM' | 'GPU'
  | 'Storage' | 'PSU' | 'Case' | 'Monitor' | 'Peripherals' | 'Accessories' | 'Laptop';
