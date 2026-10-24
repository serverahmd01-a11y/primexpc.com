import { useEffect, useState } from 'react';
import { notifyApi } from '@/lib/api';
import { Bot, Plus, Pencil, Trash2, Send, Loader2, X, Save, ChevronDown, Braces } from 'lucide-react';

type EventConfig = { fields: string[]; template: string };
type Channel = {
  _id: string;
  name: string;
  type: 'telegram' | 'whatsapp' | 'email';
  enabled: boolean;
  events: string[];
  interactive?: boolean;
  dailySummaryTime?: string;
  eventConfigs?: { event: string; fields: string[]; template: string }[];
  telegramToken: string;
  telegramChat: string;
  whatsappPhone: string;
  whatsappApikey: string;
  emailTo: string;
};
type EventDef = { key: string; label: string };
type FieldsMap = Record<string, [string, string][]>;

const TYPE_META: Record<string, { label: string; chip: string; setup: string }> = {
  telegram: {
    label: 'Telegram',
    chip: 'bg-blue-500/15 text-blue-400',
    setup: 'Telegram → @BotFather → /newbot → copy token. Send any message to your bot, then get your chat ID from @userinfobot.',
  },
  whatsapp: {
    label: 'WhatsApp',
    chip: 'bg-emerald-500/15 text-emerald-400',
    setup: 'From your WhatsApp send "I allow callmebot to send me messages" to +34 644 51 95 23 — you get the API key instantly.',
  },
  email: {
    label: 'Email',
    chip: 'bg-purple-500/15 text-purple-400',
    setup: 'Uses the SMTP settings from Settings → Email (Gmail app password works).',
  },
};

const emptyForm = {
  name: '',
  type: 'telegram' as Channel['type'],
  enabled: true,
  events: ['new_order'] as string[],
  interactive: false,
  dailySummaryTime: '21:30',
  telegramToken: '',
  telegramChat: '',
  whatsappPhone: '',
  whatsappApikey: '',
  emailTo: '',
};

type FormState = typeof emptyForm & { eventConfigs: Record<string, EventConfig> };

export default function AdminBots() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [events, setEvents] = useState<EventDef[]>([]);
  const [eventFields, setEventFields] = useState<FieldsMap>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Channel | null>(null);
  const [form, setForm] = useState<FormState>({ ...emptyForm, eventConfigs: {} });
  const [openConfig, setOpenConfig] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<'ok' | 'err'>('ok');

  const load = () => {
    notifyApi.list()
      .then((d) => {
        setChannels(d.channels || []);
        setEvents(d.events || []);
        setEventFields(d.eventFields || {});
      })
      .catch(() => flash('Failed to load bots', 'err'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const flash = (text: string, type: 'ok' | 'err' = 'ok') => {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(null), 4000);
  };

  const configFor = (ev: string): EventConfig => form.eventConfigs[ev] || { fields: [], template: '' };

  const setConfig = (ev: string, patch: Partial<EventConfig>) => {
    setForm((f) => ({
      ...f,
      eventConfigs: { ...f.eventConfigs, [ev]: { ...configFor(ev), ...patch } },
    }));
  };

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm, eventConfigs: {} });
    setOpenConfig(null);
    setMsg(null);
    setShowModal(true);
  };

  const openEdit = (ch: Channel) => {
    setEditing(ch);
    const cfgs: Record<string, EventConfig> = {};
    for (const c of ch.eventConfigs || []) cfgs[c.event] = { fields: c.fields || [], template: c.template || '' };
    setForm({
      name: ch.name,
      type: ch.type,
      enabled: ch.enabled,
      events: [...ch.events],
      interactive: !!ch.interactive,
      dailySummaryTime: ch.dailySummaryTime || '21:30',
      telegramToken: ch.telegramToken || '',
      telegramChat: ch.telegramChat || '',
      whatsappPhone: ch.whatsappPhone || '',
      whatsappApikey: ch.whatsappApikey || '',
      emailTo: ch.emailTo || '',
      eventConfigs: cfgs,
    });
    setOpenConfig(null);
    setMsg(null);
    setShowModal(true);
  };

  const toggleEnabled = async (ch: Channel) => {
    try {
      await notifyApi.update(ch._id, { enabled: !ch.enabled });
      setChannels((prev) => prev.map((c) => (c._id === ch._id ? { ...c, enabled: !c.enabled } : c)));
    } catch { flash('Failed to update bot', 'err'); }
  };

  const save = async () => {
    if (!form.name.trim()) { flash('Give the bot a name', 'err'); return; }
    if (form.events.length === 0) { flash('Select at least one event', 'err'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        eventConfigs: form.events
          .filter((ev) => form.eventConfigs[ev]?.fields?.length || form.eventConfigs[ev]?.template?.trim())
          .map((ev) => ({ event: ev, fields: form.eventConfigs[ev].fields, template: form.eventConfigs[ev].template })),
      };
      if (editing) await notifyApi.update(editing._id, payload);
      else await notifyApi.create(payload);
      setShowModal(false);
      flash(editing ? 'Bot updated' : 'Bot created — send a test to verify!');
      load();
    } catch (e: unknown) {
      flash((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Save failed', 'err');
    } finally { setSaving(false); }
  };

  const test = async (ch: Channel) => {
    setTesting(ch._id);
    try {
      const r = await notifyApi.test(ch._id);
      flash(r.message || 'Test sent');
    } catch (e: unknown) {
      flash((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Test failed', 'err');
    } finally { setTesting(null); }
  };

  const remove = async (ch: Channel) => {
    if (!confirm(`Delete bot "${ch.name}"?`)) return;
    try {
      await notifyApi.remove(ch._id);
      setChannels((prev) => prev.filter((c) => c._id !== ch._id));
      flash('Bot deleted');
    } catch { flash('Delete failed', 'err'); }
  };

  const toggleEvent = (key: string) => {
    setForm((f) => ({ ...f, events: f.events.includes(key) ? f.events.filter((e) => e !== key) : [...f.events, key] }));
  };

  const toggleField = (ev: string, field: string) => {
    const cur = configFor(ev).fields;
    setConfig(ev, { fields: cur.includes(field) ? cur.filter((f) => f !== field) : [...cur, field] });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black flex items-center gap-2"><Bot className="h-6 w-6 text-primary" /> Notification Bots</h1>
          <p className="text-sm text-muted-foreground mt-1">Unlimited bots — each with its own channel, events, and per-event message customization (fields + custom template).</p>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110">
          <Plus className="h-4 w-4" /> New Bot
        </button>
      </div>

      {msg && <div className={`rounded-lg border px-4 py-2.5 text-xs font-bold ${msgType === 'ok' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-destructive/40 bg-destructive/10 text-destructive'}`}>{msg}</div>}

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Loading...</div>
      ) : channels.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Bot className="mx-auto h-10 w-10 mb-3 text-muted-foreground opacity-40" />
          <p className="text-sm font-bold">No bots yet</p>
          <p className="text-xs mt-1 text-muted-foreground">Create your first bot — e.g. "Order Alerts" on Telegram with the New Order event.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {channels.map((ch) => (
            <div key={ch._id} className={`rounded-xl border p-5 ${ch.enabled ? 'border-border bg-card' : 'border-border bg-card opacity-60'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TYPE_META[ch.type]?.chip || ''}`}>{TYPE_META[ch.type]?.label || ch.type}</span>
                    {!!ch.interactive && <span className="rounded bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">🎛 Interactive · summary {ch.dailySummaryTime || '21:30'}</span>}
                    {!ch.enabled && <span className="rounded bg-surface px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">Paused</span>}
                  </div>
                  <h3 className="mt-1.5 font-display text-base font-black">{ch.name}</h3>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-[10px] font-bold uppercase text-muted-foreground">
                  <input type="checkbox" checked={ch.enabled} onChange={() => toggleEnabled(ch)} className="h-4 w-4 accent-primary" />
                  {ch.enabled ? 'On' : 'Off'}
                </label>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {ch.events.map((ev) => (
                  <span key={ev} className={`rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary ${ch.eventConfigs?.some((c) => c.event === ev && (c.template || c.fields.length)) ? 'ring-1 ring-primary/50' : ''}`}>
                    {events.find((e) => e.key === ev)?.label || ev}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => test(ch)} disabled={testing === ch._id} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50">
                  {testing === ch._id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Test
                </button>
                <button onClick={() => openEdit(ch)} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:border-primary hover:text-primary">
                  <Pencil className="h-3 w-3" /> Edit
                </button>
                <button onClick={() => remove(ch)} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:border-destructive hover:text-destructive">
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-black">{editing ? `Edit "${editing.name}"` : 'New Bot'}</h2>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Bot Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Order Alerts" className="h-10 w-full rounded-lg border border-border bg-input px-3 text-sm outline-none focus:border-primary" />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Channel</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['telegram', 'whatsapp', 'email'] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setForm({ ...form, type: t })} className={`rounded-lg border px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition ${form.type === t ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                      {TYPE_META[t].label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">Setup: {TYPE_META[form.type].setup}</p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Alert on these events — tap ⚙ to customize the message</label>
                <div className="space-y-1.5">
                  {events.map((ev) => {
                    const selected = form.events.includes(ev.key);
                    return (
                      <div key={ev.key} className={`rounded-lg border transition ${selected ? 'border-primary/40 bg-primary/5' : 'border-border'}`}>
                        <div className="flex items-center">
                          <label className="flex flex-1 cursor-pointer items-center gap-2 px-3 py-2 text-sm">
                            <input type="checkbox" checked={selected} onChange={() => toggleEvent(ev.key)} className="h-4 w-4 accent-primary" />
                            {ev.label}
                          </label>
                          {selected && (
                            <button type="button" onClick={() => setOpenConfig(openConfig === ev.key ? null : ev.key)} className="mr-2 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary" title="Customize message">
                              ⚙ {openConfig === ev.key ? 'Close' : 'Custom'}
                            </button>
                          )}
                        </div>
                        {selected && openConfig === ev.key && (
                          <div className="space-y-2 border-t border-border/60 px-3 py-2.5">
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">What to include (empty = all)</div>
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {(eventFields[ev.key] || []).map(([key, label]) => {
                                  const on = configFor(ev.key).fields.includes(key);
                                  return (
                                    <button key={key} type="button" onClick={() => toggleField(ev.key, key)} className={`rounded-full border px-2 py-0.5 text-[10px] font-bold transition ${on ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center justify-between">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Custom template (optional — overrides fields)</div>
                                {configFor(ev.key).template && (
                                  <button type="button" onClick={() => setConfig(ev.key, { template: '' })} className="text-[10px] font-bold text-destructive hover:underline">Clear</button>
                                )}
                              </div>
                              <textarea
                                value={configFor(ev.key).template}
                                onChange={(e) => setConfig(ev.key, { template: e.target.value })}
                                rows={4}
                                placeholder={`Custom message — use placeholders like {{${(eventFields[ev.key] || [['key', 'value']])[0][0]}}}. Leave empty to use the fields above.`}
                                className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-[11px] outline-none focus:border-primary"
                              />
                              <div className="mt-1 flex flex-wrap gap-1">
                                <Braces className="h-3 w-3 text-muted-foreground" />
                                {(eventFields[ev.key] || []).map(([key]) => (
                                  <code key={key} className="rounded bg-surface px-1 text-[10px] text-primary">{`{{${key}}}`}</code>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {form.type === 'telegram' && (
                <div className="grid gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Bot Token (@BotFather)</label>
                    <input type="password" value={form.telegramToken} onChange={(e) => setForm({ ...form, telegramToken: e.target.value })} placeholder={editing?.telegramToken ? 'Saved — type to replace' : '123456:ABC-DEF...'} className="h-10 w-full rounded-lg border border-border bg-input px-3 text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Chat ID (@userinfobot)</label>
                    <input value={form.telegramChat} onChange={(e) => setForm({ ...form, telegramChat: e.target.value })} placeholder="e.g. 812345678" className="h-10 w-full rounded-lg border border-border bg-input px-3 text-sm outline-none focus:border-primary" />
                  </div>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <input type="checkbox" checked={form.interactive} onChange={(e) => setForm({ ...form, interactive: e.target.checked })} className="mt-0.5 h-4 w-4 accent-primary" />
                    <span className="text-xs">
                      <span className="font-bold text-primary">🎛 Interactive Report Bot</span>
                      <span className="mt-0.5 block text-muted-foreground">Replies to /today /month /pending /recent /stock + automatic daily summary. Only one bot can be interactive.</span>
                    </span>
                  </label>
                  {form.interactive && (
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Daily summary time (IST)</label>
                      <input type="time" value={form.dailySummaryTime} onChange={(e) => setForm({ ...form, dailySummaryTime: e.target.value })} className="h-10 w-full rounded-lg border border-border bg-input px-3 text-sm outline-none focus:border-primary" />
                      <p className="mt-1 text-[11px] text-muted-foreground">Every day at this time the bot sends today's business + pending COD summary.</p>
                    </div>
                  )}
                </div>
              )}

              {form.type === 'whatsapp' && (
                <div className="grid gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Your WhatsApp (with country code)</label>
                    <input value={form.whatsappPhone} onChange={(e) => setForm({ ...form, whatsappPhone: e.target.value })} placeholder="919971331723" className="h-10 w-full rounded-lg border border-border bg-input px-3 text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">CallMeBot API Key</label>
                    <input type="password" value={form.whatsappApikey} onChange={(e) => setForm({ ...form, whatsappApikey: e.target.value })} placeholder={editing?.whatsappApikey ? 'Saved — type to replace' : 'abc123...'} className="h-10 w-full rounded-lg border border-border bg-input px-3 text-sm outline-none focus:border-primary" />
                  </div>
                </div>
              )}

              {form.type === 'email' && (
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Send alerts to</label>
                  <input value={form.emailTo} onChange={(e) => setForm({ ...form, emailTo: e.target.value })} placeholder="you@gmail.com" className="h-10 w-full rounded-lg border border-border bg-input px-3 text-sm outline-none focus:border-primary" />
                </div>
              )}

              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} className="h-4 w-4 accent-primary" />
                Bot active
              </label>

              <button onClick={save} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110 disabled:opacity-60">
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><Save className="h-4 w-4" /> {editing ? 'Update Bot' : 'Create Bot'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
