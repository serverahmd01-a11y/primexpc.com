import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, ArrowRight, ShoppingCart, ShieldCheck, Truck, Cpu } from 'lucide-react';
import { useCart, formatINR } from '@/lib/cart';
import { getImageUrl } from '@/lib/utils';

export default function CartPage() {
  const { items, count, subtotal, setQty, remove } = useCart();
  const navigate = useNavigate();

  const grandTotal = subtotal;

  if (items.length === 0) {
    return (
      <div className="container mx-auto flex flex-col items-center px-4 py-20 text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShoppingCart className="h-12 w-12" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-black">Your Cart is Empty</h1>
          <p className="mt-3 max-w-md text-muted-foreground">Looks like you haven't added anything yet. Browse our catalog and build your dream PC.</p>
          <Link to="/" className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110">
            Start Shopping <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
    );
  }

  return (
    <div>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-black">Shopping Cart</h1>
            <p className="mt-1 text-sm text-muted-foreground">{count} item{count !== 1 ? 's' : ''} in your cart</p>
          </div>
          <Link to="/" className="text-sm font-semibold text-primary hover:underline flex items-center gap-1">
            Continue Shopping
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.slug} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:flex-row sm:gap-4 sm:p-4">
                <Link to={`/product/${item.productId || item.slug}`} className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-surface to-background overflow-hidden sm:h-28 sm:w-28">
                  {item.image ? (
                    <img src={getImageUrl(item.image)} alt={item.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="text-primary/40 flex items-center justify-center h-full w-full">
                      <Cpu className="h-10 w-10" strokeWidth={1.2} />
                    </div>
                  )}
                </Link>
                <div className="flex flex-1 flex-col">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-primary">{item.brand}</div>
                      <Link to={`/product/${item.productId || item.slug}`} className="line-clamp-2 text-sm font-bold hover:text-primary">{item.name}</Link>
                    </div>
                    <button onClick={() => remove(item.slug)} className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition" aria-label={`Remove ${item.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
                    <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
                      <button onClick={() => setQty(item.slug, item.qty - 1)} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary transition" aria-label="Decrease quantity"><Minus className="h-3.5 w-3.5" /></button>
                      <span className="w-8 text-center text-sm font-bold">{item.qty}</span>
                      <button onClick={() => setQty(item.slug, item.qty + 1)} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary transition" aria-label="Increase quantity"><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-lg font-black text-primary">{formatINR(item.price * item.qty)}</div>
                      <div className="text-[11px] text-muted-foreground">{formatINR(item.price)} each</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <aside className="lg:sticky lg:top-24 h-fit">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-display text-lg font-black uppercase tracking-wider">Order Summary</h2>

              <dl className="mt-4 space-y-2.5 text-sm">
                <Row label="Subtotal" value={formatINR(subtotal)} />
                <Row label="GST" value={<span className="text-primary">Included</span>} />
                <div className="my-2 border-t border-border" />
                <Row label="Shipping" value={<span className="text-primary font-bold">FREE</span>} />
              </dl>

              <div className="mt-5 flex items-baseline justify-between border-t border-border pt-4">
                <span className="font-display text-sm font-bold uppercase tracking-wider">Grand Total</span>
                <span className="font-display text-2xl font-black text-primary">{formatINR(grandTotal)}</span>
              </div>

              <p className="mt-1 text-[11px] text-muted-foreground">Inclusive of all taxes</p>

              <button
                onClick={() => navigate('/checkout')}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110"
              >
                Proceed to Checkout <ArrowRight className="h-4 w-4" />
              </button>

              <div className="mt-4 space-y-2 rounded-xl border border-border bg-surface/40 p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" /> Secure checkout with Razorpay</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Truck className="h-4 w-4 text-primary" /> FREE shipping on all orders</div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold text-foreground">{value}</dd>
    </div>
  );
}
