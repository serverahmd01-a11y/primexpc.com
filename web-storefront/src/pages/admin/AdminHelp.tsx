import { Link } from 'react-router-dom';
import {
  LayoutDashboard, Package, ClipboardList, Users, ShoppingBag, Settings,
  Banknote, CheckCircle2, Clock, AlertTriangle, ArrowRight, Search,
  FileSpreadsheet, PackagePlus, ScrollText, Tag, Percent, FileText, Coins,
  UserPlus, Pencil, Save, Download, Truck, CreditCard, ChevronDown, ShieldCheck
} from 'lucide-react';

const iconCls = 'h-5 w-5 shrink-0';

export default function AdminHelp() {
  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-primary/20 to-blue-500/10 border border-primary/30 p-8">
        <h1 className="font-display text-3xl font-black">Admin Panel Guide</h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          Complete walkthrough of the PrimeX PC admin panel. Learn how to manage products, orders, customers,
          process COD payments, and troubleshoot common issues.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href="#getting-started" className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground">Getting Started</a>
          <a href="#orders" className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground">Orders & COD</a>
          <a href="#troubleshooting" className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground">Troubleshooting</a>
        </div>
      </div>

      {/* Sidebar Legend */}
      <Section id="getting-started" title="Admin Panel Overview" icon={<LayoutDashboard className={iconCls} />}>
        <p className="text-sm text-muted-foreground mb-4">
          The admin panel has a sidebar on the left with different sections. Your role determines which sections you see:
        </p>
        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          <RoleCard role="Admin" color="bg-primary/15 text-primary border-primary/30" desc="Full access — Products, Orders, Customers, Settings, Role management, Logs" />
          <RoleCard role="CA" color="bg-blue-500/15 text-blue-400 border-blue-500/30" desc="Financial view — Orders, Invoices, Customers (read-only)" />
          <RoleCard role="Shipping" color="bg-amber-500/15 text-amber-400 border-amber-500/30" desc="Order fulfillment — Orders, Settle COD, Missed Orders" />
        </div>
        <div className="rounded-lg border border-border bg-surface/40 p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2">Quick Links</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <QuickLink to="/admin" label="Dashboard" icon={<LayoutDashboard className="h-3.5 w-3.5" />} />
            <QuickLink to="/admin/orders" label="Orders" icon={<ClipboardList className="h-3.5 w-3.5" />} />
            <QuickLink to="/admin/customers" label="Customers" icon={<Users className="h-3.5 w-3.5" />} />
            <QuickLink to="/admin/logs" label="Logs" icon={<ScrollText className="h-3.5 w-3.5" />} />
          </div>
        </div>
      </Section>

      {/* Orders & COD */}
      <Section id="orders" title="Orders & COD Payment Flow" icon={<ClipboardList className={iconCls} />}>
        <StepBlock
          num={1}
          title="Customer places COD order"
          desc="Customer selects 'Cash on Delivery' at checkout, pays 25% advance via Razorpay."
          link="/admin/orders"
          linkLabel="View Orders →"
        />
        <StepBlock
          num={2}
          title="Order appears in admin panel"
          desc="The order is created with status 'pending'. COD orders show a special badge and have advance/balance tracking."
        />
        <StepBlock
          num={3}
          title="Check order stats at top"
          desc={
            <span>
              The stats bar shows: <b>Total Orders</b>, <b>Prepaid</b>, <b>COD</b>, <b>Advance Paid (₹)</b>,
              <b>Balance Pending</b>, and <b>Settled</b>. Use this to track revenue at a glance.
            </span>
          }
        />
        <StepBlock
          num={4}
          title="Verify advance payment"
          desc="COD orders automatically mark advance as paid. The 'Advance' column shows 'Paid' with the amount."
        />
        <StepBlock
          num={5}
          title="Ship the order"
          desc={
            <span>
              Change status from <b>Pending</b> → <b>Shipped</b> using the dropdown. Add tracking URL.
              Shiprocket integration auto-generates AWB if configured.
            </span>
          }
        />
        <StepBlock
          num={6}
          title="Collect balance & settle"
          desc={
            <span>
              When the customer pays the remaining 75% at delivery, click the <b>'Settle'</b> button.
              This marks both advance and balance as paid. The order moves to <b>'Settled'</b> in stats.
            </span>
          }
          link="/admin/orders"
          linkLabel="Go to Orders →"
        />

        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <Banknote className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-400">COD Order Columns Explained</h4>
              <div className="mt-2 grid sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="font-bold text-foreground">Type</span>
                  <p className="text-muted-foreground mt-0.5">"COD" badge — indicates Cash on Delivery. "Prepaid" = full online payment.</p>
                </div>
                <div>
                  <span className="font-bold text-foreground">Advance</span>
                  <p className="text-muted-foreground mt-0.5">25% advance payment status. Green = paid, Yellow = pending.</p>
                </div>
                <div>
                  <span className="font-bold text-foreground">Settle</span>
                  <p className="text-muted-foreground mt-0.5">Button to mark the remaining 75% as received. One-click full settlement.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Products Management */}
      <Section id="products" title="Managing Products" icon={<Package className={iconCls} />}>
        <StepBlock
          num={1}
          title="Add a new product"
          desc="Go to Products page, click 'Add Product'. Fill name, description, price, sale price, stock, category, condition (new/refurbished), GST rate, specifications, and upload up to 3 images."
          link="/admin/products"
          linkLabel="Manage Products →"
        />
        <StepBlock
          num={2}
          title="Edit existing product"
          desc="Click on any product row to open the edit form. Update any field — price changes reflect immediately on the storefront."
        />
        <StepBlock
          num={3}
          title="Stock management"
          desc="Stock is automatically decremented when orders are placed. If stock reaches zero, the product shows 'Out of Stock' on the storefront. Update stock from the product edit form."
        />
      </Section>

      {/* Customers */}
      <Section id="customers" title="Managing Customers" icon={<Users className={iconCls} />}>
        <StepBlock
          num={1}
          title="View customer list"
          desc="See all registered users. Search by name, email, or phone number. Each row shows role, address count, and join date."
          link="/admin/customers"
          linkLabel="View Customers →"
        />
        <StepBlock
          num={2}
          title="Create new user (Admin only)"
          desc="Click 'Create User' button. Fill name, email, password, and select role (User/Admin/CA/Shipping)."
        />
        <StepBlock
          num={3}
          title="Change user role (Admin only)"
          desc="Use the dropdown in the Role column to change any user's role. Changes take effect immediately."
        />
        <StepBlock
          num={4}
          title="Edit customer details (Admin only)"
          desc="Click on a customer name → 'Edit Customer' button. You can change name, email, password, role, and add/edit/delete addresses."
          link="/admin/customers"
          linkLabel="Go to Customers →"
        />
        <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 shrink-0 text-blue-400 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-blue-400">User Roles Reference</h4>
              <div className="mt-2 space-y-2 text-xs">
                <div><span className="font-bold text-primary">Admin</span> <span className="text-muted-foreground">— Full access. Manage products, orders, customers, settings, role assignment.</span></div>
                <div><span className="font-bold text-blue-400">CA</span> <span className="text-muted-foreground">— Read-only access to Orders, Invoices, Customers. For accountants.</span></div>
                <div><span className="font-bold text-amber-400">Shipping</span> <span className="text-muted-foreground">— Orders management, COD settlement, tracking updates, missed orders.</span></div>
                <div><span className="font-bold text-muted-foreground">User</span> <span className="text-muted-foreground">— Normal customer. Can shop, place orders, view their order history.</span></div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Troubleshooting */}
      <Section id="troubleshooting" title="Troubleshooting" icon={<AlertTriangle className={iconCls} />}>
        <ProblemBlock
          problem="COD payment went through but order doesn't show anywhere"
          solution={
            <span>
              Check the <Link to="/admin/logs" className="text-primary font-bold hover:underline">System Logs →</Link> page.
              Select 'order' type. Look for entries with level <b>FATAL</b> or <b>ERROR</b>.
              The logs show exactly what went wrong — product not found, stock issue, or database error.
              Contact developer with the log details.
            </span>
          }
        />
        <ProblemBlock
          problem="Stock not updating after orders"
          solution={
            <span>
              Stock is decremented automatically. If it's not updating, check the <Link to="/admin/logs" className="text-primary font-bold hover:underline">System Logs →</Link>.
              Select 'order' type and look for <b>SUCCESS</b> level entries that say "Cart cleared and stock updated".
              If missing, the order creation failed.
            </span>
          }
        />
        <ProblemBlock
          problem="Cannot login / Network Error"
          solution="Ensure the backend server is running on port 3000. Check that MongoDB is running. Clear browser cache and try again. If the issue persists, check the server logs."
        />
        <ProblemBlock
          problem="Forgot password"
          solution={
            <span>
              Users can use the <b>"Forgot your password?"</b> link on the login page. They receive an email with a reset link.
              Admins can also reset any user's password from <Link to="/admin/customers" className="text-primary font-bold hover:underline">Customer Detail → Edit →</Link> set a new password.
            </span>
          }
        />
        <ProblemBlock
          problem="Email not sending (order confirmation, reset password)"
          solution="SMTP settings must be configured in Settings page. Go to Settings → fill SMTP Host, Port, Username, Password. Test by placing a test order or using forgot password."
        />
        <ProblemBlock
          problem="Razorpay payment not working"
          solution="Ensure Razorpay Key ID and Key Secret are configured in Settings. Test with Razorpay test mode keys first. The webhook URL must be configured in Razorpay dashboard."
        />
      </Section>

      {/* Other Pages */}
      <Section id="other" title="Other Admin Pages" icon={<FileText className={iconCls} />}>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <InfoCard icon={<FileSpreadsheet className="h-4 w-4" />} title="Invoices" desc="View and download invoices for all orders." to="/admin/invoices" />
          <InfoCard icon={<PackagePlus className="h-4 w-4" />} title="Missed Orders" desc="Manually create orders for payments that arrived but no order was placed." to="/admin/missed-orders" />
          <InfoCard icon={<Tag className="h-4 w-4" />} title="Categories" desc="Manage product categories. Add, edit, or delete categories." to="/admin/categories" />
          <InfoCard icon={<Percent className="h-4 w-4" />} title="GST" desc="Configure GST rates for products." to="/admin/gst" />
          <InfoCard icon={<Coins className="h-4 w-4" />} title="Sell" desc="Manage sell-to-us leads from customers selling their hardware." to="/admin/sell" />
          <InfoCard icon={<FileText className="h-4 w-4" />} title="Pages" desc="Manage CMS pages like Terms & Conditions, Privacy Policy." to="/admin/pages" />
          <InfoCard icon={<Settings className="h-4 w-4" />} title="Settings" desc="Configure Razorpay, Shiprocket, SMTP email, store name, banners." to="/admin/settings" />
          <InfoCard icon={<ScrollText className="h-4 w-4" />} title="Logs" desc="View real-time system logs for orders, payments, auth, and errors." to="/admin/logs" />
        </div>
      </Section>

      {/* Footer */}
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <ShoppingBag className="mx-auto h-8 w-8 text-primary/50" />
        <p className="mt-2 text-sm font-bold">PrimeX PC Admin Panel v1.0</p>
        <p className="text-xs text-muted-foreground">For technical issues, check System Logs or contact the developer.</p>
        <Link to="/admin/logs" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
          <ScrollText className="h-3.5 w-3.5" /> View System Logs
        </Link>
      </div>
    </div>
  );
}

/* ── Helper Components ── */

function Section({ id, title, icon, children }: { id?: string; title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-3 border-b border-border pb-3 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
        <h2 className="font-display text-lg font-black">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function StepBlock({ num, title, desc, link, linkLabel }: { num: number; title: string; desc: React.ReactNode; link?: string; linkLabel?: string }) {
  return (
    <div className="flex gap-4 rounded-lg bg-surface/40 p-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-black text-primary">{num}</div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-sm">{title}</h4>
        <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</div>
        {link && (
          <Link to={link} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
            {linkLabel || 'Go →'} <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

function ProblemBlock({ problem, solution }: { problem: string; solution: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-sm text-foreground">{problem}</h4>
          <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{solution}</div>
        </div>
      </div>
    </div>
  );
}

function QuickLink({ to, label, icon }: { to: string; label: string; icon: React.ReactNode }) {
  return (
    <Link to={to} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-bold text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition">
      {icon} {label}
    </Link>
  );
}

function InfoCard({ icon, title, desc, to }: { icon: React.ReactNode; title: string; desc: string; to: string }) {
  return (
    <Link to={to} className="flex items-start gap-3 rounded-lg border border-border bg-surface/40 p-3 hover:border-primary/50 hover:bg-primary/5 transition">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
      <div className="min-w-0">
        <h4 className="text-xs font-bold">{title}</h4>
        <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </Link>
  );
}

function RoleCard({ role, color, desc }: { role: string; color: string; desc: string }) {
  return (
    <div className={`rounded-lg border p-3 ${color}`}>
      <h4 className="font-display text-sm font-black">{role}</h4>
      <p className="text-[10px] mt-1 opacity-80">{desc}</p>
    </div>
  );
}
