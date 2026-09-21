import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Search, UserPlus, X } from 'lucide-react';
import Pagination, { paginate, sortNewestFirst } from './Pagination';

const ROLES = [
  { value: 'user', label: 'User', color: 'bg-surface text-muted-foreground' },
  { value: 'admin', label: 'Admin', color: 'bg-primary/15 text-primary' },
  { value: 'ca', label: 'CA', color: 'bg-blue-500/15 text-blue-400' },
  { value: 'shipping', label: 'Shipping', color: 'bg-amber-500/15 text-amber-400' },
];

export default function AdminCustomers() {
  const { isAdmin, user } = useAuth();
  const [customers, setCustomers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'user' });
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const loadCustomers = () => {
    adminApi.getCustomers().then((d) => setCustomers(d.customers || [])).catch(() => setCustomers([])).finally(() => setLoading(false));
  };
  useEffect(() => { loadCustomers(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateMsg(null);
    try {
      await adminApi.createCustomer(newUser);
      setCreateMsg({ type: 'success', text: 'User created!' });
      setNewUser({ name: '', email: '', password: '', role: 'user' });
      loadCustomers();
      setTimeout(() => setShowCreate(false), 800);
    } catch (err: unknown) {
      setCreateMsg({ type: 'error', text: (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed' });
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    const target = customers.find((c) => c._id === userId);
    if (String(target?._id) === String(user?._id) && role !== 'admin') {
      alert('You cannot demote yourself.');
      return;
    }
    if (!confirm(`Change role to "${role}"?`)) return;
    try {
      await adminApi.updateUserRole(userId, role);
      setCustomers((prev) => prev.map((c) => c._id === userId ? { ...c, role } : c));
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Role update failed');
    }
  };

  const searchQ = search.trim().toLowerCase();
  const filteredAll = sortNewestFirst(searchQ
    ? customers.filter((c) => {
        const addr = (c.addresses as Record<string, string>[]) || [];
        const phones = addr.map((a) => String(a.phoneNumber || '')).join(' ');
        const hay = `${String(c.name || '')} ${String(c.email || '')} ${phones}`.toLowerCase();
        return hay.includes(searchQ);
      })
    : customers);
  const filtered = paginate(filteredAll, page, perPage);

  useEffect(() => { setPage(1); }, [search]);

  const roleColor = (role: string) => ROLES.find((r) => r.value === role)?.color || 'bg-surface text-muted-foreground';

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">{filteredAll.length} of {customers.length} customer(s)</div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button onClick={() => { setShowCreate(true); setCreateMsg(null); }} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:brightness-110">
              <UserPlus className="h-3.5 w-3.5" /> Create User
            </button>
          )}
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name / email / phone..."
              className="h-10 w-full rounded-lg border border-border bg-input pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30" />
          </div>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-black">Create User</h2>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div><label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Name</label><input required value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-border bg-input px-3 text-sm outline-none focus:border-primary" /></div>
              <div><label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email</label><input required type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-border bg-input px-3 text-sm outline-none focus:border-primary" /></div>
              <div><label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Password</label><input required type="password" minLength={8} value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-border bg-input px-3 text-sm outline-none focus:border-primary" /></div>
              <div><label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Role</label><select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-border bg-input px-3 text-sm outline-none focus:border-primary">{[{v:'user',l:'User'},{v:'admin',l:'Admin'},{v:'ca',l:'CA'},{v:'shipping',l:'Shipping'}].map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}</select></div>
              {createMsg && <div className={`rounded-lg border px-3 py-2 text-xs font-bold ${createMsg.type === 'success' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-destructive/40 bg-destructive/10 text-destructive'}`}>{createMsg.text}</div>}
              <button type="submit" disabled={creating} className="w-full rounded-full bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 disabled:opacity-50">{creating ? 'Creating...' : 'Create User'}</button>
            </form>
          </div>
        </div>
      )}
      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Loading...</div>
      ) : filteredAll.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">No customers match the search</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface/40 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Addresses</th>
                <th className="px-5 py-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={String(c._id)} className="border-b border-border">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                        {String(c.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <Link to={`/admin/customers/${String(c._id)}`} className="font-semibold text-primary hover:underline">{String(c.name)}</Link>
                    </div>
                  </td>
                  <td className="px-5 py-3">{String(c.email)}</td>
                  <td className="px-5 py-3">
                    {isAdmin ? (
                      <select
                        value={String(c.role || 'user')}
                        onChange={(e) => handleRoleChange(String(c._id), e.target.value)}
                        className="h-8 rounded border border-border bg-input px-2 text-xs font-bold text-foreground outline-none focus:border-primary"
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`inline-flex rounded px-2 py-0.5 text-[11px] font-bold ${roleColor(String(c.role || 'user'))}`}>
                        {String(c.role)}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">{(c.addresses as unknown[])?.length || 0}</td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">{c.createdAt ? new Date(String(c.createdAt)).toLocaleDateString('en-IN') : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        total={filteredAll.length}
        page={page}
        perPage={perPage}
        onPage={setPage}
        onPerPage={(n) => { setPerPage(n); setPage(1); }}
      />
    </div>
  );
}
