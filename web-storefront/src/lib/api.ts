import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('primex_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const guestId = localStorage.getItem('primex_guest_id');
  if (guestId && !token) {
    config.headers['x-guest-id'] = guestId;
  }
  return config;
});

let refreshPromise: Promise<{ token: string; user: unknown }> | null = null;

async function doRefresh(): Promise<{ token: string; user: unknown }> {
  const token = localStorage.getItem('primex_token');
  if (!token) throw new Error('no token');
  const res = await fetch(`${API_URL}/auth/refresh`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('refresh failed');
  return res.json();
}

function clearAuth() {
  localStorage.removeItem('primex_token');
  localStorage.removeItem('primex_user');
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;
    const url = originalRequest?.url || '';
    const isAuthEndpoint = /\/auth\/(login|register|refresh|forgot-password|reset-password)/.test(url);

    if (
      err.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retried &&
      !isAuthEndpoint
    ) {
      if (!refreshPromise) {
        refreshPromise = doRefresh();
      }
      try {
        const data = await refreshPromise;
        refreshPromise = null;
        localStorage.setItem('primex_token', data.token);
        if (data.user) localStorage.setItem('primex_user', JSON.stringify(data.user));
        originalRequest.headers.Authorization = `Bearer ${data.token}`;
        originalRequest._retried = true;
        return api(originalRequest);
      } catch {
        refreshPromise = null;
        clearAuth();
        window.dispatchEvent(new Event('primex-auth-expired'));
        return Promise.reject(err);
      }
    }
    return Promise.reject(err);
  }
);

export default api;

export const productApi = {
  getAll: () => api.get('/products').then((r) => r.data),
  getById: (id: string) => api.get(`/products/${id}`).then((r) => r.data),
};

export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post('/auth/register', data).then((r) => r.data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  refresh: () => api.get('/auth/refresh').then((r) => r.data),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }).then((r) => r.data),
  resetPassword: (token: string, email: string, password: string) =>
    api.post('/auth/reset-password', { token, email, password }).then((r) => r.data),
};

export const adminApi = {
  getProducts: () => api.get('/admin/products').then((r) => r.data),
  createProduct: (formData: FormData) =>
    api.post('/admin/products', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  updateProduct: (id: string, formData: FormData) =>
    api.put(`/admin/products/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  updateProductStock: (id: string, stock: number) =>
    api.patch(`/admin/products/${id}/stock`, { stock }).then((r) => r.data),
  deleteProduct: (id: string) => api.delete(`/admin/products/${id}`).then((r) => r.data),
  getOrders: () => api.get('/admin/orders').then((r) => r.data),
  updateOrderStatus: (orderId: string, status: string) =>
    api.patch(`/admin/orders/${orderId}/status`, { status }).then((r) => r.data),
  markBalancePaid: (orderId: string) =>
    api.patch(`/admin/orders/${orderId}/balance`).then((r) => r.data),
  toggleAdvancePaid: (orderId: string) =>
    api.patch(`/admin/orders/${orderId}/advance`).then((r) => r.data),
  settleOrder: (orderId: string) =>
    api.patch(`/admin/orders/${orderId}/settle`).then((r) => r.data),
  updateOrderTracking: (orderId: string, trackingUrl: string) =>
    api.patch(`/admin/orders/${orderId}/tracking`, { trackingUrl }).then((r) => r.data),
  getCustomers: () => api.get('/admin/customers').then((r) => r.data),
  getCustomerDetail: (id: string) => api.get(`/admin/customers/${id}`).then((r) => r.data),
  getStats: () => api.get('/admin/stats').then((r) => r.data),
  getMissedOrders: () => api.get('/admin/missed-orders').then((r) => r.data),
  createMissedOrder: (data: unknown) =>
    api.post('/admin/missed-orders', data).then((r) => r.data),
  getLogFiles: () => api.get('/admin/logs/files').then((r) => r.data),
  getLogs: (type: string, date?: string) =>
    api.get('/admin/logs', { params: { type, date } }).then((r) => r.data),
  updateUserRole: (userId: string, role: string) =>
    api.patch(`/admin/users/${userId}/role`, { role }).then((r) => r.data),
  updateCustomer: (customerId: string, data: Record<string, unknown>) =>
    api.patch(`/admin/customers/${customerId}`, data).then((r) => r.data),
  createCustomer: (data: Record<string, unknown>) =>
    api.post('/admin/customers', data).then((r) => r.data),
  getOrderStats: () => api.get('/admin/order-stats').then((r) => r.data),
};

export const categoryApi = {
  getAll: (condition?: string) => api.get('/categories', condition ? { params: { condition } } : undefined).then((r) => r.data),
  create: (name: string) => api.post('/admin/categories', { name }).then((r) => r.data),
  update: (id: string, name: string) => api.put(`/admin/categories/${id}`, { name }).then((r) => r.data),
  delete: (id: string) => api.delete(`/admin/categories/${id}`).then((r) => r.data),
  seed: () => api.post('/admin/categories/seed').then((r) => r.data),
};

export const cartApi = {
  get: () => api.get('/cart').then((r) => r.data),
  add: (productId: string, quantity = 1) => api.post('/cart', { productId, quantity }).then((r) => r.data),
  update: (productId: string, quantity: number) => api.put(`/cart/${productId}`, { quantity }).then((r) => r.data),
  remove: (productId: string) => api.delete(`/cart/${productId}`).then((r) => r.data),
  clear: () => api.delete('/cart').then((r) => r.data),
  merge: (guestId: string) => api.post('/cart/merge', { guestId }).then((r) => r.data),
};

export const orderApi = {
  create: (data: unknown) => api.post('/orders', data).then((r) => r.data),
  getAll: () => api.get('/orders').then((r) => r.data),
};

export const paymentApi = {
  createOrder: (data: { amount: number; receipt: string }) =>
    api.post('/payment/create-order', data).then((r) => r.data),
  verify: (data: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
    api.post('/payment/verify', data).then((r) => r.data),
  placeOrder: (data: unknown) => api.post('/payment/place-order', data).then((r) => r.data),
};

export const userApi = {
  getAddresses: () => api.get('/users/addresses').then((r) => r.data),
  addAddress: (data: unknown) => api.post('/users/addresses', data).then((r) => r.data),
  updateAddress: (id: string, data: unknown) => api.put(`/users/addresses/${id}`, data).then((r) => r.data),
  deleteAddress: (id: string) => api.delete(`/users/addresses/${id}`).then((r) => r.data),
  getWishlist: () => api.get('/users/wishlist').then((r) => r.data),
  addToWishlist: (productId: string) => api.post('/users/wishlist', { productId }).then((r) => r.data),
  removeFromWishlist: (productId: string) => api.delete(`/users/wishlist/${productId}`).then((r) => r.data),
};

export const sellApi = {
  sendOTP: (mobile: string) => api.post('/sell/send-otp', { mobile }).then((r) => r.data),
  verifyOTP: (mobile: string, otp: string) => api.post('/sell/verify-otp', { mobile, otp }).then((r) => r.data),
  uploadFiles: (formData: FormData) => api.post('/sell/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  submitLead: (data: unknown) => api.post('/sell/submit', data).then((r) => r.data),
  getMyLeads: (mobile?: string) => api.get('/sell/leads', mobile ? { params: { mobile } } : undefined).then((r) => r.data),
  getLeadById: (id: string) => api.get(`/sell/leads/${id}`).then((r) => r.data),
  respondOffer: (id: string, action: string, mobile: string) => api.post(`/sell/leads/${id}/respond`, { action, mobile }).then((r) => r.data),

  adminGetLeads: (status?: string) => api.get('/admin/sell/leads', status && status !== 'all' ? { params: { status } } : undefined).then((r) => r.data),
  adminGetLeadById: (id: string) => api.get(`/admin/sell/leads/${id}`).then((r) => r.data),
  adminUpdateStatus: (id: string, status: string, note?: string) => api.patch(`/admin/sell/leads/${id}/status`, { status, note }).then((r) => r.data),
  adminOfferPrice: (id: string, offeredPrice: number, note?: string) => api.post(`/admin/sell/leads/${id}/offer-price`, { offeredPrice, note }).then((r) => r.data),
  adminAddNote: (id: string, note: string) => api.post(`/admin/sell/leads/${id}/notes`, { note }).then((r) => r.data),
  adminSchedulePickup: (id: string, packageData: { packageWeight: number; packageLength: number; packageBreadth: number; packageHeight: number }) => api.post(`/admin/sell/leads/${id}/schedule-pickup`, packageData).then((r) => r.data),
  adminGetStats: () => api.get('/admin/sell/stats').then((r) => r.data),
  adminGetProducts: () => api.get('/admin/sell/products').then((r) => r.data),
  adminCreateProduct: (formData: FormData) => api.post('/admin/sell/products', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  adminUpdateProduct: (id: string, formData: FormData) => api.put(`/admin/sell/products/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  adminDeleteProduct: (id: string) => api.delete(`/admin/sell/products/${id}`).then((r) => r.data),

  adminGetCategories: () => api.get('/admin/sell/categories').then((r) => r.data),
  adminCreateCategory: (data: FormData) => api.post('/admin/sell/categories', data, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  adminUpdateCategory: (id: string, data: FormData) => api.put(`/admin/sell/categories/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  adminDeleteCategory: (id: string) => api.delete(`/admin/sell/categories/${id}`).then((r) => r.data),

  adminGetBrands: (category?: string) => api.get('/admin/sell/brands', category ? { params: { category } } : undefined).then((r) => r.data),
  adminCreateBrand: (data: { name: string; category: string; active?: boolean; sortOrder?: number }) => api.post('/admin/sell/brands', data).then((r) => r.data),
  adminUpdateBrand: (id: string, data: { name?: string; category?: string; active?: boolean; sortOrder?: number }) => api.put(`/admin/sell/brands/${id}`, data).then((r) => r.data),
  adminDeleteBrand: (id: string) => api.delete(`/admin/sell/brands/${id}`).then((r) => r.data),

  adminGetModels: (brand?: string) => api.get('/admin/sell/models', brand ? { params: { brand } } : undefined).then((r) => r.data),
  adminCreateModel: (data: { name: string; brand: string; active?: boolean; sortOrder?: number }) => api.post('/admin/sell/models', data).then((r) => r.data),
  adminUpdateModel: (id: string, data: { name?: string; brand?: string; active?: boolean; sortOrder?: number }) => api.put(`/admin/sell/models/${id}`, data).then((r) => r.data),
  adminDeleteModel: (id: string) => api.delete(`/admin/sell/models/${id}`).then((r) => r.data),

  getSellData: () => api.get('/public/sell-data').then((r) => r.data),
};
