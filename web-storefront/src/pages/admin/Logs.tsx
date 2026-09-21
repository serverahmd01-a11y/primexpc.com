import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { FileText, RefreshCw, ChevronDown, ChevronRight, Search, X, AlertTriangle, CheckCircle, Info, Bug } from 'lucide-react';

type LogEntry = { timestamp: string; level: string; message: string };
type LogFiles = Record<string, { date: string; file: string }[]>;

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
  { key: 'order', label: 'Orders (COD & Prepaid)', desc: 'Order creation, stock updates, cart clearing' },
  { key: 'payment', label: 'Payments', desc: 'Razorpay transactions, webhooks' },
  { key: 'auth', label: 'Auth', desc: 'Login, register, token refresh' },
  { key: 'error', label: 'Server Errors', desc: 'Unhandled server errors, crashes' },
  { key: 'admin', label: 'Admin Actions', desc: 'Admin panel operations' },
];

export default function Logs() {
  const [files, setFiles] = useState<LogFiles>({});
  const [selectedType, setSelectedType] = useState('order');
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');
  const [showFiles, setShowFiles] = useState(false);

  useEffect(() => { loadFiles(); }, []);

  useEffect(() => {
    if (selectedType) loadLogs(selectedType, selectedDate);
  }, [selectedType, selectedDate]);

  useEffect(() => {
    let filtered = logs;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((l) => l.message.toLowerCase().includes(q));
    }
    if (filterLevel !== 'all') {
      filtered = filtered.filter((l) => l.level === filterLevel);
    }
    setFilteredLogs(filtered);
  }, [logs, search, filterLevel]);

  const loadFiles = async () => {
    try {
      const data = await adminApi.getLogFiles();
      setFiles(data.files || {});
      const types = Object.keys(data.files || {});
      if (types.length > 0 && !types.includes(selectedType)) {
        setSelectedType(types[0]);
      }
    } catch { setError('Failed to load log files'); }
  };

  const loadLogs = async (type: string, date?: string) => {
    setLoading(true);
    try {
      const data = await adminApi.getLogs(type, date);
      const entries = (data.logs || []).reverse();
      setLogs(entries);
      setFilteredLogs(entries);
      setError('');
    } catch {
      setError('Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  const availableDates = (files[selectedType] || []).map((f) => f.date);
  const currentDate = new Date().toISOString().slice(0, 10);
  const activeDate = selectedDate || currentDate;

  const levelCounts: Record<string, number> = {};
  for (const l of logs) {
    levelCounts[l.level] = (levelCounts[l.level] || 0) + 1;
  }

  return (
    <div>
       <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-black">System Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time logging for orders, payments, auth, and errors</p>
        </div>
        <button onClick={() => loadLogs(selectedType, selectedDate)} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-surface transition disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {LOG_TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => { setSelectedType(t.key); setSelectedDate(undefined); setSearch(''); setFilterLevel('all'); }}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${selectedType === t.key ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50 text-muted-foreground'}`}
            title={t.desc}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        {availableDates.length > 0 && (
          <>
            <select
              value={activeDate}
              onChange={(e) => setSelectedDate(e.target.value === currentDate ? undefined : e.target.value)}
              className="h-9 rounded-lg border border-border bg-input px-3 text-xs font-bold text-foreground"
            >
              {availableDates.map((d) => (
                <option key={d} value={d}>{d}{d === currentDate ? ' (Today)' : ''}</option>
              ))}
            </select>
          </>
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
            placeholder="Search logs..."
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
              <div key={i} className={`flex items-start gap-3 px-4 py-2.5 text-xs font-mono ${LEVEL_BG[log.level] || ''}`}>
                <div className="mt-0.5 shrink-0">{LEVEL_ICON[log.level] || <Info className="h-3.5 w-3.5" />}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">{log.timestamp}</span>
                    <span className={`text-[10px] font-bold uppercase ${log.level === 'FATAL' ? 'text-red-400' : log.level === 'ERROR' ? 'text-red-400' : log.level === 'WARN' ? 'text-amber-400' : log.level === 'SUCCESS' ? 'text-emerald-400' : 'text-blue-400'}`}>{log.level}</span>
                  </div>
                  <div className="mt-0.5 text-foreground break-all leading-relaxed">{log.message}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 text-xs text-muted-foreground text-right">
        {logs.length} entries total · {filteredLogs.length} shown
        {activeDate && ` · ${activeDate}`}
      </div>
    </div>
  );
}
