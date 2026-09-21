import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cpu, MonitorSmartphone, Laptop, Monitor, Box, Server, HardDrive, Power, ChevronRight, Zap, Shield, Coins, CircuitBoard, MemoryStick, Disc, Network } from 'lucide-react';
import api from '@/lib/api';

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  'Graphics Card (GPU)': MonitorSmartphone,
  'Laptop': Laptop,
  'Desktop PC': Monitor,
  'Gaming PC': Monitor,
  'CPU Processor': Cpu,
  'Motherboard': CircuitBoard,
  'RAM': MemoryStick,
  'SSD': Disc,
  'HDD': HardDrive,
  'Power Supply': Power,
  'Server': Server,
  'Networking Equipment': Network,
  'Complete Mining Rig': Box,
};

type SellProduct = {
  _id: string;
  name: string;
  icon: string;
  image: string;
  description: string;
  active: boolean;
  sortOrder: number;
};

export default function SellHome() {
  const [sellProducts, setSellProducts] = useState<SellProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/public/sell-data')
      .then((r) => {
        if (r.data?.categories?.length > 0) {
          const mapped = r.data.categories.map((c: any) => ({
            _id: c._id,
            name: c.name,
            icon: c.icon,
            image: c.image,
            description: c.description,
            active: c.active,
            sortOrder: c.sortOrder,
          }));
          setSellProducts(mapped);
        } else {
          api.get('/public/sell-products').then((r2) => setSellProducts(r2.data || [])).catch(() => setSellProducts([]));
        }
      })
      .catch(() => {
        api.get('/public/sell-products').then((r2) => setSellProducts(r2.data || [])).catch(() => setSellProducts([]));
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <section className="relative overflow-hidden" style={{ background: 'var(--gradient-hero)' }}>
        <div className="container mx-auto grid items-center gap-10 px-4 py-20 md:grid-cols-2">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">
              <Coins className="h-3.5 w-3.5" /> Turn Old Into Gold
            </div>
            <h1 className="font-display text-4xl font-black leading-tight text-foreground md:text-6xl">
              Sell Your Used <span className="text-primary">Computer Hardware</span>
            </h1>
            <p className="mt-5 max-w-lg text-base text-muted-foreground md:text-lg">
              Get the best price for your GPUs, CPUs, laptops, PCs and servers. Free pickup across India after quote approval.
            </p>
            <Link
              to="/sell/submit"
              className="mt-8 inline-flex items-center gap-2 rounded-full border-2 border-primary bg-primary px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110"
            >
              Get Instant Quote <ChevronRight className="h-4 w-4" />
            </Link>
            <div className="mt-10 grid grid-cols-3 gap-4 max-w-md">
              {[{ v: 'Best', l: 'Price Guaranteed' }, { v: 'Free', l: 'Pan-India Pickup' }, { v: '24-48h', l: 'Quote Time' }].map((s) => (
                <div key={s.l}><div className="font-display text-xl font-black text-primary">{s.v}</div><div className="text-xs uppercase tracking-wider text-muted-foreground">{s.l}</div></div>
              ))}
            </div>
          </div>
          <div className="relative flex justify-center overflow-visible">
            <span className="logo-ring-wrap logo-ring-wrap--glow-only">
              <img src="/primex-logo.jpeg" alt="Sell Hardware" className="relative z-10 w-64 max-w-full rounded-full sm:w-80 md:w-96" />
            </span>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <h2 className="font-display text-3xl font-black text-foreground text-center mb-2">What are you selling?</h2>
        <p className="text-center text-muted-foreground mb-10">Select a category to get started</p>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 animate-pulse h-28" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {sellProducts.filter((p) => p.active).map((p) => {
              const Icon = p.icon && categoryIcons[p.name] ? categoryIcons[p.name] : p.icon && p.icon !== 'Box' ? (categoryIcons as Record<string, React.ComponentType<{ className?: string }>>)[p.icon] || Box : Box;
              return (
                <Link
                  key={p._id}
                  to={`/sell/submit?category=${encodeURIComponent(p._id)}`}
                  className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 transition hover:-translate-y-1 hover:border-primary hover:shadow-[var(--shadow-glow)] text-center"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="text-xs font-bold text-foreground leading-tight">{p.name}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="container mx-auto px-4 py-16">
        <h2 className="font-display text-3xl font-black text-foreground text-center mb-12">How It Works</h2>
        <div className="grid gap-8 md:grid-cols-3">
          {[
            { step: '01', icon: Box, title: 'Submit Details', desc: 'Fill product details, upload photos & video' },
            { step: '02', icon: Coins, title: 'Get Quote', desc: 'Our team reviews & sends best price offer' },
            { step: '03', icon: Zap, title: 'Get Paid', desc: 'After testing, payment sent to your account' },
          ].map((s) => (
            <div key={s.step} className="rounded-xl border border-border bg-card p-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                <s.icon className="h-7 w-7" />
              </div>
              <div className="text-xs font-bold text-primary mb-1">STEP {s.step}</div>
              <h3 className="font-display text-lg font-bold text-foreground">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 pt-4 pb-16">
        <div className="grid gap-6 md:grid-cols-2">
          {[
            { icon: Shield, t: 'Best Price', d: 'We offer competitive prices for your used hardware based on current market value.' },
            { icon: Zap, t: 'Fast Payment', d: 'Get paid within 48 hours after your hardware passes testing at our facility.' },
          ].map((f) => (
            <div key={f.t} className="rounded-xl border border-border bg-card p-6 text-center">
              <f.icon className="mx-auto h-8 w-8 text-primary" />
              <h3 className="mt-4 font-display text-lg font-bold text-foreground">{f.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 pb-20">
        <div className="relative overflow-hidden rounded-2xl border border-primary/30 p-10 text-center md:p-16" style={{ background: 'var(--gradient-hero)' }}>
          <h2 className="font-display text-3xl font-black text-foreground md:text-5xl">Ready to <span className="text-primary">sell your hardware?</span></h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">Fill in your product details and get the best price for your used hardware.</p>
          <Link
            to="/sell/submit"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow)] transition hover:brightness-110"
          >
            Get Instant Quote <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="container mx-auto px-4 pb-16">
        <Link
          to="/sell/status"
          className="block mx-auto w-fit rounded-xl border border-primary/50 bg-card px-6 py-3 text-sm font-bold text-primary hover:bg-primary/10 transition"
        >
          Track Your Submission
        </Link>
      </section>
    </>
  );
}
