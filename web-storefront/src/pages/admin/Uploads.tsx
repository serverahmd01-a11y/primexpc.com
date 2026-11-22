import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { getImageUrl } from '@/lib/utils';
import { RefreshCw, CheckCircle, AlertTriangle, FolderOpen, ImageOff, ScrollText } from 'lucide-react';

type RecentFile = { name: string; sizeKB: number; modified: string; url: string };
type MissingRef = { where: string; url: string };
type Status = {
  envValue: string | null;
  folder: string;
  cwd: string;
  logsFolder: string;
  exists: boolean;
  writable: boolean;
  error: string | null;
  totalFiles: number;
  totalSizeMB: number;
  recent: RecentFile[];
  otherFolders: { folder: string; files: number }[];
  db: null | { error?: string; totalRefs?: number; localRefs?: number; externalRefs?: number; missingCount?: number; missing?: MissingRef[] };
};

function Row({ label, value, ok }: { label: string; value: React.ReactNode; ok?: boolean }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-2.5 sm:flex-row sm:items-center sm:gap-4">
      <div className="w-48 shrink-0 text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex min-w-0 items-center gap-2 text-sm">
        {ok === true && <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />}
        {ok === false && <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />}
        <span className="break-all font-mono">{value}</span>
      </div>
    </div>
  );
}

const fmtIST = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

export default function Uploads() {
  const [data, setData] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/uploads/status');
      setData(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.response?.data?.message || e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black">Uploads Check</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Which folder photos are saved in, latest saved files, and photos missing on disk
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/logs" className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-surface transition">
            <ScrollText className="h-4 w-4" /> Upload logs
          </Link>
          <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-surface transition disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}

      {data && (
        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-surface/40 p-4">
            <h2 className="mb-2 flex items-center gap-2 font-bold"><FolderOpen className="h-4 w-4" /> Upload folder</h2>
            <Row label="UPLOADS_DIR (env)" value={data.envValue || 'NOT SET - using default folder (deleted on every redeploy!)'} ok={!!data.envValue} />
            <Row label="Folder in use" value={data.folder} />
            <Row label="Folder exists" value={data.exists ? 'Yes' : 'No'} ok={data.exists} />
            <Row label="App can write" value={data.writable ? 'Yes' : `No${data.error ? ` - ${data.error}` : ''}`} ok={data.writable} />
            <Row label="Files in folder" value={`${data.totalFiles} files · ${data.totalSizeMB} MB`} />
            <Row label="App working dir" value={data.cwd} />
            <Row label="Logs folder" value={data.logsFolder} />
          </section>

          {data.otherFolders.length > 0 && (
            <section className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
              <h2 className="mb-2 flex items-center gap-2 font-bold text-amber-400"><AlertTriangle className="h-4 w-4" /> Other uploads folders found</h2>
              <p className="mb-2 text-xs text-muted-foreground">Photos here are NOT in the folder above. They were probably saved before UPLOADS_DIR was set, and will be lost on the next redeploy. Copy them into the folder above.</p>
              {data.otherFolders.map((f) => (
                <Row key={f.folder} label={`${f.files} files`} value={f.folder} />
              ))}
            </section>
          )}

          <section className="rounded-xl border border-border bg-surface/40 p-4">
            <h2 className="mb-3 font-bold">Latest saved files ({data.recent.length})</h2>
            {data.recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No files in the folder yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {data.recent.map((f) => (
                  <a key={f.name} href={getImageUrl(f.url)} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-lg border border-border hover:border-primary/60">
                    <div className="flex aspect-square items-center justify-center bg-background">
                      {/\.(mp4|mov|webm|avi)$/i.test(f.name) ? (
                        <span className="text-xs font-bold text-muted-foreground">VIDEO</span>
                      ) : (
                        <img src={getImageUrl(f.url)} alt={f.name} loading="lazy" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="p-2">
                      <div className="truncate font-mono text-[11px]">{f.name}</div>
                      <div className="text-[10px] text-muted-foreground">{f.sizeKB} KB · {fmtIST(f.modified)}</div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-surface/40 p-4">
            <h2 className="mb-2 flex items-center gap-2 font-bold"><ImageOff className="h-4 w-4" /> Photos used in products/categories but missing in folder</h2>
            {data.db?.error ? (
              <p className="text-sm text-red-400">{data.db.error}</p>
            ) : data.db ? (
              <>
                <p className="mb-3 text-xs text-muted-foreground">
                  {data.db.totalRefs} photo links in DB · {data.db.localRefs} point to /uploads · {data.db.externalRefs} external ·{' '}
                  <span className={data.db.missingCount ? 'font-bold text-red-400' : 'font-bold text-emerald-400'}>{data.db.missingCount} missing</span>
                </p>
                {(data.db.missing || []).length > 0 && (
                  <div className="max-h-96 overflow-auto rounded-lg border border-border">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-surface">
                        <tr><th className="p-2">Used in</th><th className="p-2">File</th></tr>
                      </thead>
                      <tbody>
                        {data.db.missing!.map((m, i) => (
                          <tr key={i} className="border-t border-border">
                            <td className="p-2">{m.where}</td>
                            <td className="break-all p-2 font-mono">{m.url}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
