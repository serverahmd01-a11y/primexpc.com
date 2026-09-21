import { Link } from 'react-router-dom';
import { Minus, Plus, ShoppingCart, Trash2, X, ArrowRight } from 'lucide-react';
import { useCart, formatINR } from '@/lib/cart';
import { getImageUrl } from '@/lib/utils';

export function CartDrawer() {
  const { items, isOpen, close, setQty, remove, subtotal, count } = useCart();

  return (
    <>
      <div onClick={close} className={`fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={!isOpen} />
      <aside className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-2xl transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`} aria-label="Shopping cart" role="dialog">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-primary" /><h2 className="font-display text-lg font-black uppercase tracking-wider">Your Cart <span className="text-primary">({count})</span></h2></div>
          <button onClick={close} aria-label="Close cart" className="rounded-full p-2 text-muted-foreground hover:bg-primary/10 hover:text-primary"><X className="h-5 w-5" /></button>
        </header>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary"><ShoppingCart className="h-9 w-9" /></div>
            <h3 className="mt-5 font-display text-xl font-bold">Your cart is empty</h3>
            <p className="mt-2 text-sm text-muted-foreground">Browse our deals and add something powerful.</p>
            <button onClick={close} className="mt-6 rounded-full bg-primary px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110">Continue Shopping</button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <ul className="space-y-4">
                {items.map((i, idx) => (
                  <li key={`${i.slug}-${idx}`} className="flex min-w-0 gap-3 rounded-xl border border-border bg-card p-3">
                    <Link to={`/product/${i.productId || i.slug}`} onClick={close} className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-surface to-background overflow-hidden">
                      {i.image ? <img src={getImageUrl(i.image)} alt={i.name} className="h-full w-full object-cover" /> : <div className="text-xs font-black text-primary">{i.brand.slice(0, 2).toUpperCase()}</div>}
                    </Link>
                    <div className="min-w-0 flex flex-1 flex-col">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-primary">{i.brand}</div>
                      <Link to={`/product/${i.productId || i.slug}`} onClick={close} className="line-clamp-2 text-sm font-bold leading-snug hover:text-primary">{i.name}</Link>
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
                          <button onClick={() => setQty(i.slug, i.qty - 1)} aria-label="Decrease" className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary"><Minus className="h-3 w-3" /></button>
                          <span className="w-6 text-center text-xs font-bold">{i.qty}</span>
                          <button onClick={() => setQty(i.slug, i.qty + 1)} aria-label="Increase" className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary"><Plus className="h-3 w-3" /></button>
                        </div>
                        <span className="font-display text-sm font-black text-primary">{formatINR(i.price * i.qty)}</span>
                      </div>
                    </div>
                    <button onClick={() => remove(i.slug)} aria-label="Remove" className="self-start rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            </div>
            <footer className="border-t border-border bg-surface/60 px-5 py-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground"><span>Subtotal</span><span className="font-display text-2xl font-black text-primary">{formatINR(subtotal)}</span></div>
              <p className="mt-1 text-xs text-muted-foreground">Shipping & taxes calculated at checkout.</p>
              <Link to="/cart" onClick={close} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border border-primary/40 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary/10 transition">View Full Cart <ArrowRight className="h-3.5 w-3.5" /></Link>
              <Link to="/checkout" onClick={close} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110">Checkout <ArrowRight className="h-4 w-4" /></Link>
              <button onClick={close} className="mt-2 w-full text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary">Continue Shopping</button>
            </footer>
          </>
        )}
      </aside>
    </>
  );
}
