import { useEffect, useRef, useState } from 'react';
import { adminApi } from '@/lib/api';
import api from '@/lib/api';
import { FileText, RefreshCw, Search, X, AlertTriangle, CheckCircle, Info, Bug, Download, Radio, Braces } from 'lucide-react';

type LogEntry = { timestamp: string; level: string; message: string; data?: unknown; type?: string };
type LogFileMeta = { date: string; file: string; entries: number; errors: number; warns: number };
type LogFiles = Record<string, LogFileMeta[]>;

const LEVEL_ICON: Record<string, React.ReactNode> = {
  SUCCESS: <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />,
  INFO: <Info className="h-3.5 w-3.5 text-blue-400" />,
  WARN: <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />,
  ERROR: <AlertTriangle className="h-3.5 w-3.5 text-red-400" />,
  FATAL: <Bug className="h-3.5 w-3.5 text-red-500" />,
};

const LEVEL_BG: Record<string, string> = {
  SUCCESS: 'bg-emerald-500/10 border-emerald-500/30',
  INFO: 'bg-blue-500/10 border-blue-500/30',
  WARN: 'bg-amber-500/10 border-amber-500/30',
  ERROR: 'bg-red-500/10 border-red-500/30',
  FATAL: 'bg-red-600/15 border-red-500/50',
};

const LOG_TYPES = [
  { key: 'order', label: 'Orders', desc: 'Order creation, stock updates, cart clearing' },
  { key: 'payment', label: 'Payments', desc: 'Razorpay transactions, webhooks' },
  { key: 'auth', label: 'Auth', desc: 'Login, register, password resets' },
  { key: 'admin', label: 'Admin Actions', desc: 'Product/order/customer changes by staff' },
  { key: 'error', label: 'Server Errors', desc: 'Unhandled server errors, crashes' },
];

const TYPE_CHIP: Record<string, string> = {
  order: 'bg-emerald-500/15 text-emerald-400',
  payment: 'bg-blue-500/15 text-blue-400',
  auth: 'bg-purple-500/15 text-purple-400',
  admin: 'bg-amber-500/15 text-amber-400',
  error: 'bg-red-500/15 text-red-400',
};

export default function Logs() {
  const [files, setFiles] = useState<LogFiles>({});
  const [selectedType, setSelectedType] = useState('all');
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');
  const [live, setLive] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const liveRef = useRef({ type: 'all', date: undefined as string | undefined });

  const currentDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const activeDate = selectedDate || currentDate;

  useEffect(() => { loadFiles(); }, []);

  useEffect(() => {
    liveRef.current = { type: selectedType, date: selectedDate };
    loadLogs(selectedType, selectedDate);
  }, [selectedType, selectedDate]);

  // LIVE mode: poll every 5s so the admin sees problems as they happen.
  useEffect(() => {
    if (!live) return;
    const i = setInterval(() => {
      const { type, date } = liveRef.current;
      loadLogs(type, date, true);
      loadFiles(true);
    }, 5000);
    return () => clearInterval(i);
  }, [live]);

  useEffect(() => {
    let filtered = logs;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((l) =>
        l.message.toLowerCase().includes(q) ||
        (l.type || '').includes(q) ||
        JSON.stringify(l.data || '').toLowerCase().includes(q)
      );
    }
    if (filterLevel !== 'all') {
      filtered = filtered.filter((l) => l.level === filterLevel);
    }
    setFilteredLogs(filtered);
  }, [logs, search, filterLevel]);

  const loadFiles = async (silent = false) => {
    try {
      const data = await adminApi.getLogFiles();
      setFiles(data.files || {});
    } catch {
      if (!silent) setError('Failed to load log files');
    }
  };

  const loadLogs = async (type: string, date?: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await adminApi.getLogs(type, date);
      setLogs((data.logs || []).slice().reverse());
      setLastUpdated(new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date()));
      if (!silent) setError('');
    } catch {
      if (!silent) setError('Failed to load logs');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const download = async () => {
    setDownloading(true);
    try {
      const res = await api.get('/admin/logs/download', {
        params: { type: selectedType, date: activeDate },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/plain' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedType}_${activeDate}.log`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const countFor = (typeKey: string) => {
    const meta = (files[typeKey] || []).find((f) => f.date === activeDate);
    return meta ? { entries: meta.entries, errors: meta.errors, warns: meta.warns } : { entries: 0, errors: 0, warns: 0 };
  };

  const allCount = LOG_TYPES.reduce((s, t) => s + countFor(t.key).entries, 0);
  const allErrors = LOG_TYPES.reduce((s, t) => s + countFor(t.key).errors, 0);

  const levelCounts: Record<string, number> = {};
  for (const l of logs) {
    levelCounts[l.level] = (levelCounts[l.level] || 0) + 1;
  }

  const availableDateMap = new Map<string, { entries: number; errors: number }>();
  for (const t of LOG_TYPES) {
    for (const f of files[t.key] || []) {
      const prev = availableDateMap.get(f.date) || { entries: 0, errors: 0 };
      availableDateMap.set(f.date, { entries: prev.entries + f.entries, errors: prev.errors + f.errors });
    }
  }
  const availableDates = Array.from(availableDateMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-black">System Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Everything that happens on the shop — orders, payments, logins, admin actions
            {lastUpdated && <span className="ml-1 text-[11px]">· updated {lastUpdated} IST</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLive((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold transition ${live ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400' : 'border-border text-muted-foreground hover:text-foreground'}`}
            title="Auto-refresh every 5 seconds"
          >
            <Radio className={`h-4 w-4 ${live ? 'animate-pulse' : ''}`} /> {live ? 'LIVE' : 'Paused'}
          </button>
          <button onClick={download} disabled={downloading} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-surface transition disabled:opacity-50">
            {downloading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download
          </button>
          <button onClick={() => { loadLogs(selectedType, selectedDate); loadFiles(); }} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-surface transition disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => { setSelectedType('all'); setSelectedDate(undefined); setSearch(''); setFilterLevel('all'); }}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${selectedType === 'all' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50 text-muted-foreground'}`}
        >
          All Types
          <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px]">{allCount}</span>
          {allErrors > 0 && <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-400">{allErrors} err</span>}
        </button>
        {LOG_TYPES.map((t) => {
          const c = countFor(t.key);
          return (
            <button
              key={t.key}
              onClick={() => { setSelectedType(t.key); setSelectedDate(undefined); setSearch(''); setFilterLevel('all'); }}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${selectedType === t.key ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50 text-muted-foreground'}`}
              title={t.desc}
            >
              {t.label}
              <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px]">{c.entries}</span>
              {c.errors > 0 && <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-400">{c.errors}</span>}
              {c.errors === 0 && c.warns > 0 && <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-400">{c.warns}</span>}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        {availableDates.length > 0 && (
          <select
            value={activeDate}
            onChange={(e) => setSelectedDate(e.target.value === currentDate ? undefined : e.target.value)}
            className="h-9 rounded-lg border border-border bg-input px-3 text-xs font-bold text-foreground"
          >
            {availableDates.map(([d, c]) => (
              <option key={d} value={d}>
                {d}{d === currentDate ? ' (Today)' : ''} — {c.entries} entries{c.errors > 0 ? ` · ${c.errors} errors` : ''}
              </option>
            ))}
          </select>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {['all', 'FATAL', 'ERROR', 'WARN', 'INFO', 'SUCCESS'].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setFilterLevel(lvl)}
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border transition ${
                filterLevel === lvl
                  ? `${LEVEL_BG[lvl] || 'border-border bg-surface'}`
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {lvl}{levelCounts[lvl] ? ` (${levelCounts[lvl]})` : ''}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search message, email, payment id, order number..."
            className="h-9 w-full rounded-lg border border-border bg-input pl-9 pr-8 text-xs text-foreground outline-none focus:border-primary"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">{error}</div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <FileText className="mx-auto h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-bold">No logs found</p>
            <p className="text-xs mt-1">Make a test order or perform some actions to generate logs</p>
          </div>
        ) : (
          <div className="divide-y divide-border max-h-[70vh] overflow-y-auto">
            {filteredLogs.map((log, i) => (
              <div key={i} className={`px-4 py-2.5 text-xs font-mono border-l-2 ${LEVEL_BG[log.level] || ''} border-l-transparent`}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">{LEVEL_ICON[log.level] || <Info className="h-3.5 w-3.5" />}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{log.timestamp}</span>
                      <span className={`text-[10px] font-bold uppercase ${log.level === 'FATAL' || log.level === 'ERROR' ? 'text-red-400' : log.level === 'WARN' ? 'text-amber-400' : log.level === 'SUCCESS' ? 'text-emerald-400' : 'text-blue-400'}`}>{log.level}</span>
                      {log.type && (
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${TYPE_CHIP[log.type] || 'bg-surface text-muted-foreground'}`}>{log.type}</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-foreground break-all leading-relaxed">{log.message}</div>
                    {log.data != null && (
                      <details className="mt-1 group">
                        <summary className="inline-flex cursor-pointer items-center gap-1 text-[10px] font-bold text-muted-foreground hover:text-primary">
                          <Braces className="h-3 w-3" /> details
                        </summary>
                        <pre className="mt-1 max-h-60 overflow-auto rounded-lg border border-border bg-surface/60 p-2 text-[10px] leading-relaxed text-muted-foreground">{JSON.stringify(log.data, null, 2)}</pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 text-xs text-muted-foreground text-right">
        {logs.length} entries · {filteredLogs.length} shown · {activeDate}{selectedType === 'all' ? ' · all types merged' : ''}
      </div>
    </div>
  );
}
