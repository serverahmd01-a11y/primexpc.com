import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Phone, Mail, MapPin, Clock, Send, Loader2 } from 'lucide-react';
import api from '@/lib/api';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/contact', form);
      setSent(true);
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch {
      setError('Failed to send message. Please try again or email us directly.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary mb-6">
          <ChevronLeft className="h-4 w-4" /> Back to Home
        </Link>

        <h1 className="font-display text-3xl font-black text-foreground mb-8">Contact Us</h1>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h2 className="font-display text-base font-bold uppercase tracking-wider text-primary">Get in Touch</h2>
              <ContactItem icon={MapPin} line1="PrimeX Technologies" line2="123, Tech Park, Business District" line3="Mumbai, Maharashtra 400001" />
              <ContactItem icon={Phone} line1="+91 99713 31723" />
              <ContactItem icon={Mail} line1="support@primexpc.com" />
              <ContactItem icon={Clock} line1="Mon – Sat: 10:00 AM – 7:00 PM" line2="Sunday: Closed" />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-display text-base font-bold uppercase tracking-wider text-primary mb-4">Send a Message</h2>
            {sent ? (
              <div className="rounded-lg bg-primary/10 px-4 py-6 text-center">
                <Send className="mx-auto h-8 w-8 text-primary mb-2" />
                <p className="text-sm font-semibold text-foreground">Message sent!</p>
                <p className="text-xs text-muted-foreground mt-1">We'll get back to you within 24 hours.</p>
                <button onClick={() => setSent(false)} className="mt-3 text-xs font-bold text-primary hover:underline">Send another</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Your name" />
                  <FormField label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" placeholder="your@email.com" />
                </div>
                <FormField label="Subject" value={form.subject} onChange={(v) => setForm({ ...form, subject: v })} placeholder="How can we help?" />
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Message</label>
                  <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Write your message…" rows={5}
                    className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 resize-none" />
                </div>
                {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">{error}</div>}
                <button type="submit" disabled={loading || !form.name || !form.email || !form.message}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110 disabled:opacity-50">
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</> : <><Send className="h-4 w-4" /> Send Message</>}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ContactItem({ icon: Icon, line1, line2, line3 }: { icon: React.ComponentType<{ className?: string }>; line1: string; line2?: string; line3?: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10"><Icon className="h-4 w-4 text-primary" /></div>
      <div><p className="text-sm font-semibold text-foreground">{line1}</p>{line2 && <p className="text-xs text-muted-foreground">{line2}</p>}{line3 && <p className="text-xs text-muted-foreground">{line3}</p>}</div>
    </div>
  );
}

function FormField({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1 h-10 w-full rounded-md border border-border bg-input px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
    </div>
  );
}
