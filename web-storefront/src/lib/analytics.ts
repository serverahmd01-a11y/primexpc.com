const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || '';

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

function enabled(): boolean {
  return !!GA_ID && typeof window !== 'undefined' && !!window.gtag;
}

function gtag(...args: any[]) {
  if (enabled()) {
    window.gtag!(...args);
  }
}

export function pageView(path: string, title?: string) {
  gtag('event', 'page_view', {
    page_path: path,
    page_title: title || document.title,
    page_location: window.location.href,
    send_to: GA_ID,
  });
}

export function viewItem(product: {
  id: string;
  name: string;
  price: number;
  category?: string;
  brand?: string;
}) {
  gtag('event', 'view_item', {
    currency: 'INR',
    value: product.price,
    items: [{
      item_id: product.id,
      item_name: product.name,
      price: product.price,
      item_category: product.category || '',
      item_brand: product.brand || '',
      currency: 'INR',
    }],
  });
}

export function viewItemList(items: {
  id: string;
  name: string;
  price: number;
  category?: string;
}[], listName = 'Product List') {
  gtag('event', 'view_item_list', {
    currency: 'INR',
    items: items.map((p) => ({
      item_id: p.id,
      item_name: p.name,
      price: p.price,
      item_category: p.category || '',
      currency: 'INR',
    })),
    item_list_name: listName,
  });
}

export function addToCart(product: {
  id: string;
  name: string;
  price: number;
  category?: string;
  quantity?: number;
}) {
  gtag('event', 'add_to_cart', {
    currency: 'INR',
    value: product.price * (product.quantity || 1),
    items: [{
      item_id: product.id,
      item_name: product.name,
      price: product.price,
      item_category: product.category || '',
      quantity: product.quantity || 1,
      currency: 'INR',
    }],
  });
}

export function removeFromCart(product: {
  id: string;
  name: string;
  price: number;
  category?: string;
  quantity?: number;
}) {
  gtag('event', 'remove_from_cart', {
    currency: 'INR',
    value: product.price * (product.quantity || 1),
    items: [{
      item_id: product.id,
      item_name: product.name,
      price: product.price,
      item_category: product.category || '',
      quantity: product.quantity || 1,
      currency: 'INR',
    }],
  });
}

export function beginCheckout(items: {
  id: string;
  name: string;
  price: number;
  category?: string;
  quantity: number;
}[], total: number) {
  gtag('event', 'begin_checkout', {
    currency: 'INR',
    value: total,
    items: items.map((p) => ({
      item_id: p.id,
      item_name: p.name,
      price: p.price,
      item_category: p.category || '',
      quantity: p.quantity,
      currency: 'INR',
    })),
  });
}

export function purchase(transactionId: string, items: {
  id: string;
  name: string;
  price: number;
  category?: string;
  quantity: number;
}[], total: number, shipping?: number, tax?: number) {
  gtag('event', 'purchase', {
    transaction_id: transactionId,
    currency: 'INR',
    value: total,
    shipping: shipping || 0,
    tax: tax || 0,
    items: items.map((p) => ({
      item_id: p.id,
      item_name: p.name,
      price: p.price,
      item_category: p.category || '',
      quantity: p.quantity,
      currency: 'INR',
    })),
  });
}

export function signUp(method = 'email') {
  gtag('event', 'sign_up', { method });
}

export function login(method = 'email') {
  gtag('event', 'login', { method });
}

export function search(term: string) {
  gtag('event', 'search', { search_term: term });
}

export function share(contentType: string, itemId: string) {
  gtag('event', 'share', { content_type: contentType, item_id: itemId });
}

export function viewPromotion(promoName: string, creative?: string) {
  gtag('event', 'view_promotion', {
    creative_name: promoName,
    creative_slot: creative || '',
  });
}

export function selectPromotion(promoName: string, creative?: string) {
  gtag('event', 'select_promotion', {
    creative_name: promoName,
    creative_slot: creative || '',
  });
}
