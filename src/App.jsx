import { useState, useEffect, useRef, useCallback } from 'react'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const API_KEY = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env.VITE_ANTHROPIC_KEY || ''
  : ''

const SERVICE_CATEGORIES = [
  'Telecom',
  'VoIP / UCaaS',
  'Internet Circuit',
  'Analog POTS',
  'Software License',
  'Managed Services',
  'Cloud & Infrastructure',
  'Security Services',
  'Hardware / Device Lease',
  'Other Technology',
]

const CATEGORY_META = {
  'Telecom':                 { icon: '📞', color: '#388bfd', group: 'Connectivity' },
  'VoIP / UCaaS':            { icon: '🎙️', color: '#3fb950', group: 'Connectivity' },
  'Internet Circuit':        { icon: '🌐', color: '#58a6ff', group: 'Connectivity' },
  'Analog POTS':             { icon: '☎️', color: '#79c0ff', group: 'Connectivity' },
  'Software License':        { icon: '💿', color: '#d2a8ff', group: 'Software & Services' },
  'Managed Services':        { icon: '🛠️', color: '#ffa657', group: 'Software & Services' },
  'Cloud & Infrastructure':  { icon: '☁️', color: '#56d364', group: 'Software & Services' },
  'Security Services':       { icon: '🔒', color: '#ff7b72', group: 'Software & Services' },
  'Hardware / Device Lease': { icon: '🖥️', color: '#e3b341', group: 'Hardware' },
  'Other Technology':        { icon: '⚙️', color: '#8b949e', group: 'Other' },
}

const RENEWAL_TYPES = ['Auto-Renew', 'Annual Opt-In', 'Evergreen', 'Month-to-Month', 'Multi-Year']
const SERVICE_STATUSES = ['Active', 'Pending', 'Expired', 'Under Review', 'Flagged for Consolidation']
const SPEND_OWNERS = ['IT', 'Operations', 'Finance', 'Property Management', 'Executive', 'Unknown']

const NAV_TABS = [
  { id: 'upload',    icon: '⬆️', label: 'Upload & Extract' },
  { id: 'inventory', icon: '📋', label: 'Inventory' },
  { id: 'locations', icon: '📍', label: 'Locations' },
  { id: 'financial', icon: '📊', label: 'Financial Analysis' },
  { id: 'spend',     icon: '💡', label: 'Spend Summary' },
  { id: 'quotes',    icon: '💼', label: 'Vendor Quotes' },
  { id: 'report',    icon: '📄', label: 'Export Report' },
]

const EMPTY_SERVICE = {
  id: '', location: '', category: '', vendor: '', accountNumber: '',
  description: '', monthlyCharge: '', contractStart: '', contractEnd: '',
  renewalType: 'Auto-Renew', status: 'Active', spendOwner: 'IT',
  seatCount: '', perUnitCost: '', consolidationFlag: false,
  notes: '', proposedSavings: '', newMonthly: '',
}

// ─── THEME ────────────────────────────────────────────────────────────────────
const T = {
  bg0: '#080b0f', bg1: '#0d1117', bg2: '#161b22', bg3: '#1c2128',
  border: '#21262d', border2: '#30363d',
  text0: '#f0f6fc', text1: '#e2e8f0', text2: '#c9d1d9', text3: '#8b949e',
  blue: '#388bfd', blueLight: '#79c0ff',
  green: '#3fb950', greenLight: '#56d364',
  orange: '#ffa657', red: '#ff7b72', purple: '#d2a8ff', yellow: '#e3b341',
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9)
const fmt$ = (n) => (parseFloat(n) || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })
const fmt$d = (n) => (parseFloat(n) || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const parseNum = (v) => parseFloat(String(v || '').replace(/[^0-9.-]/g, '')) || 0

function useClientStorage(clientId, key, defaultVal) {
  const sKey = `blg_${clientId}_${key}`
  const [val, setValRaw] = useState(() => {
    try { const s = localStorage.getItem(sKey); return s ? JSON.parse(s) : defaultVal }
    catch { return defaultVal }
  })
  const setVal = useCallback((v) => {
    setValRaw(prev => {
      const next = typeof v === 'function' ? v(prev) : v
      try { localStorage.setItem(sKey, JSON.stringify(next)) } catch {}
      return next
    })
  }, [sKey])
  return [val, setVal]
}

function isExpiringSoon(dateStr) {
  if (!dateStr) return false
  const diff = (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24)
  return diff >= 0 && diff <= 90
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const css = {
  app: { minHeight: '100vh', background: T.bg0, color: T.text1, fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", display: 'flex', flexDirection: 'column' },
  header: { background: `linear-gradient(135deg, ${T.bg1} 0%, ${T.bg2} 100%)`, borderBottom: `1px solid ${T.border}`, padding: '0 32px', display: 'flex', alignItems: 'center', gap: '20px', height: '60px', flexShrink: 0 },
  logoMark: { width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0, background: 'linear-gradient(135deg, #1f6feb, #388bfd)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', boxShadow: '0 2px 8px rgba(56,139,253,0.35)' },
  logoText: { fontSize: '17px', fontWeight: '700', color: T.blueLight, letterSpacing: '0.03em' },
  logoSub: { fontSize: '11px', color: T.text3, letterSpacing: '0.06em', marginTop: '1px' },
  clientBadge: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', background: T.bg3, border: `1px solid ${T.border2}`, borderRadius: '8px', padding: '5px 12px', fontSize: '12px', color: T.text3 },
  nav: { background: T.bg1, borderBottom: `1px solid ${T.border}`, padding: '0 28px', display: 'flex', flexShrink: 0, overflowX: 'auto' },
  navBtn: (active) => ({ padding: '0 16px', height: '46px', cursor: 'pointer', fontSize: '12.5px', fontWeight: active ? '600' : '400', color: active ? T.blue : T.text3, borderBottom: `2px solid ${active ? T.blue : 'transparent'}`, display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', background: 'none', border: 'none', borderBottom: `2px solid ${active ? T.blue : 'transparent'}`, outline: 'none', transition: 'all 0.15s', cursor: 'pointer' }),
  main: { flex: 1, padding: '24px 32px', maxWidth: '1440px', width: '100%', margin: '0 auto', boxSizing: 'border-box' },
  card: { background: T.bg2, border: `1px solid ${T.border}`, borderRadius: '12px', padding: '22px 24px', marginBottom: '18px' },
  cardTitle: { fontSize: '14px', fontWeight: '600', color: T.text0, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' },
  label: { fontSize: '11px', fontWeight: '600', color: T.text3, marginBottom: '5px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' },
  input: { width: '100%', background: T.bg1, border: `1px solid ${T.border2}`, borderRadius: '7px', padding: '8px 11px', color: T.text1, fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  select: { width: '100%', background: T.bg1, border: `1px solid ${T.border2}`, borderRadius: '7px', padding: '8px 11px', color: T.text1, fontSize: '13px', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' },
  textarea: { width: '100%', background: T.bg1, border: `1px solid ${T.border2}`, borderRadius: '7px', padding: '8px 11px', color: T.text1, fontSize: '13px', outline: 'none', resize: 'vertical', minHeight: '80px', boxSizing: 'border-box', fontFamily: 'inherit' },
  btn: (variant = 'primary', size = 'md') => {
    const sz = { sm: '5px 11px', md: '9px 18px', lg: '11px 24px' }[size]
    const v = { primary: { background: T.blue, color: '#fff', border: 'none' }, secondary: { background: T.bg3, color: T.text2, border: `1px solid ${T.border2}` }, danger: { background: 'rgba(255,123,114,0.12)', color: T.red, border: `1px solid rgba(255,123,114,0.25)` }, success: { background: 'rgba(63,185,80,0.12)', color: T.green, border: `1px solid rgba(63,185,80,0.25)` }, ghost: { background: 'none', color: T.text3, border: 'none' } }[variant]
    return { ...v, borderRadius: '7px', padding: sz, fontSize: size === 'sm' ? '11px' : '13px', fontWeight: '500', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', transition: 'opacity 0.15s', outline: 'none', whiteSpace: 'nowrap' }
  },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px' },
  statCard: (color = T.blue) => ({ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: '10px', padding: '18px 20px', borderLeft: `3px solid ${color}` }),
  statVal: { fontSize: '24px', fontWeight: '700', color: T.text0, lineHeight: 1 },
  statLabel: { fontSize: '11px', color: T.text3, marginTop: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  statSub: { fontSize: '12px', color: T.text3, marginTop: '4px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: { textAlign: 'left', padding: '10px 12px', fontSize: '11px', fontWeight: '600', color: T.text3, borderBottom: `1px solid ${T.border}`, textTransform: 'uppercase', letterSpacing: '0.05em' },
  td: { padding: '10px 12px', borderBottom: `1px solid ${T.border}`, color: T.text2, verticalAlign: 'middle' },
  badge: (color = T.blue) => ({ display: 'inline-flex', alignItems: 'center', gap: '4px', background: `${color}22`, color: color, borderRadius: '5px', padding: '2px 8px', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }),
  pill: (color = T.blue) => ({ display: 'inline-block', background: `${color}1a`, color: color, borderRadius: '20px', padding: '2px 10px', fontSize: '11px', fontWeight: '600' }),
  uploadZone: (drag) => ({ border: `2px dashed ${drag ? T.blue : T.border2}`, borderRadius: '12px', padding: '48px 32px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', background: drag ? 'rgba(56,139,253,0.04)' : 'transparent' }),
  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
  modalBox: { background: T.bg2, border: `1px solid ${T.border}`, borderRadius: '14px', padding: '28px', width: '100%', maxWidth: '760px', maxHeight: '90vh', overflowY: 'auto' },
  progress: { height: '6px', background: T.bg3, borderRadius: '3px', overflow: 'hidden', marginTop: '8px' },
  progressBar: (pct, color = T.blue) => ({ height: '100%', width: `${Math.min(100, pct)}%`, background: color, borderRadius: '3px', transition: 'width 0.3s' }),
}

function statusColor(s) {
  if (s === 'Active') return T.green
  if (s === 'Pending') return T.yellow
  if (s === 'Expired') return T.red
  if (s === 'Under Review') return T.orange
  if (s === 'Flagged for Consolidation') return T.purple
  return T.text3
}

// ─── API ──────────────────────────────────────────────────────────────────────
async function callClaude(systemPrompt, userMessage, onChunk) {
  const key = API_KEY || window._BLG_KEY || ''
  if (!key) throw new Error('No API key configured. Add VITE_ANTHROPIC_KEY to Vercel environment variables.')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-opus-4-5', max_tokens: 4096, system: systemPrompt, messages: [{ role: 'user', content: userMessage }], stream: !!onChunk }),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `API error ${res.status}`) }
  if (onChunk) {
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = ''
    while (true) {
      const { done, value } = await reader.read(); if (done) break
      buf += dec.decode(value, { stream: true })
      const lines = buf.split('\n'); buf = lines.pop()
      for (const line of lines) {
        if (line.startsWith('data: ')) { try { const d = JSON.parse(line.slice(6)); if (d.type === 'content_block_delta' && d.delta?.text) onChunk(d.delta.text) } catch {} }
      }
    }
    return null
  }
  const data = await res.json(); return data.content[0].text
}

const EXTRACT_SYSTEM = `You are an expert telecom and technology expense analyst. Extract ALL service line items from the provided document text.
Return ONLY a valid JSON array with no markdown or explanation. Each item:
{ "vendor":"", "accountNumber":"", "location":"", "category":"one of: Telecom|VoIP / UCaaS|Internet Circuit|Analog POTS|Software License|Managed Services|Cloud & Infrastructure|Security Services|Hardware / Device Lease|Other Technology", "description":"", "monthlyCharge":"numeric only", "contractStart":"", "contractEnd":"", "renewalType":"Auto-Renew|Annual Opt-In|Evergreen|Month-to-Month|Multi-Year", "status":"Active", "seatCount":"", "perUnitCost":"", "spendOwner":"IT|Operations|Finance|Property Management|Executive|Unknown", "notes":"" }
Extract every line item. For seat-based services extract seatCount and perUnitCost if mentioned.`

// ─── UI COMPONENTS ────────────────────────────────────────────────────────────
function Spinner() {
  return <span style={{ display: 'inline-block', width: '13px', height: '13px', border: `2px solid ${T.border2}`, borderTop: `2px solid ${T.blue}`, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
}

function FG({ label, children }) {
  return <div style={{ marginBottom: '13px' }}><label style={css.label}>{label}</label>{children}</div>
}

function StatCard({ label, value, sub, color, pct }) {
  return (
    <div style={css.statCard(color)}>
      <div style={css.statVal}>{value}</div>
      <div style={css.statLabel}>{label}</div>
      {sub && <div style={css.statSub}>{sub}</div>}
      {pct !== undefined && <div style={css.progress}><div style={css.progressBar(pct, color)} /></div>}
    </div>
  )
}

function CatBadge({ cat }) {
  const m = CATEGORY_META[cat] || { icon: '⚙️', color: T.text3 }
  return <span style={css.badge(m.color)}>{m.icon} {cat}</span>
}

function StatusBadge({ status }) {
  return <span style={css.pill(statusColor(status))}>{status}</span>
}

function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null
  return (
    <div style={css.modal} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...css.modalBox, maxWidth: wide ? '960px' : '760px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: T.text0 }}>{title}</h3>
          <button style={css.btn('ghost', 'sm')} onClick={onClose}>✕ Close</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── SERVICE FORM ─────────────────────────────────────────────────────────────
function ServiceForm({ svc, onChange }) {
  return (
    <div>
      <div style={css.grid3}>
        <FG label="Category">
          <select style={css.select} value={svc.category} onChange={e => onChange('category', e.target.value)}>
            <option value="">— Select —</option>
            {SERVICE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </FG>
        <FG label="Vendor">
          <input style={css.input} value={svc.vendor} onChange={e => onChange('vendor', e.target.value)} placeholder="e.g. AT&T, Microsoft, Cisco" />
        </FG>
        <FG label="Account / Contract #">
          <input style={css.input} value={svc.accountNumber} onChange={e => onChange('accountNumber', e.target.value)} />
        </FG>
      </div>
      <div style={css.grid2}>
        <FG label="Location / Property">
          <input style={css.input} value={svc.location} onChange={e => onChange('location', e.target.value)} placeholder="e.g. 123 Main St, Atlanta GA" />
        </FG>
        <FG label="Description / Service Name">
          <input style={css.input} value={svc.description} onChange={e => onChange('description', e.target.value)} placeholder="e.g. Primary Voice Lines, M365 Business Premium" />
        </FG>
      </div>
      <div style={css.grid4}>
        <FG label="Monthly Charge ($)">
          <input style={css.input} type="number" value={svc.monthlyCharge} onChange={e => onChange('monthlyCharge', e.target.value)} placeholder="0.00" />
        </FG>
        <FG label="Seat / Unit Count">
          <input style={css.input} type="number" value={svc.seatCount} onChange={e => onChange('seatCount', e.target.value)} placeholder="e.g. 50" />
        </FG>
        <FG label="Per-Unit Cost ($)">
          <input style={css.input} type="number" value={svc.perUnitCost} onChange={e => onChange('perUnitCost', e.target.value)} placeholder="0.00" />
        </FG>
        <FG label="Spend Owner">
          <select style={css.select} value={svc.spendOwner} onChange={e => onChange('spendOwner', e.target.value)}>
            <option value="">— Select —</option>
            {SPEND_OWNERS.map(o => <option key={o}>{o}</option>)}
          </select>
        </FG>
      </div>
      <div style={css.grid4}>
        <FG label="Contract Start">
          <input style={css.input} type="date" value={svc.contractStart} onChange={e => onChange('contractStart', e.target.value)} />
        </FG>
        <FG label="Contract End">
          <input style={css.input} type="date" value={svc.contractEnd} onChange={e => onChange('contractEnd', e.target.value)} />
        </FG>
        <FG label="Renewal Type">
          <select style={css.select} value={svc.renewalType} onChange={e => onChange('renewalType', e.target.value)}>
            {RENEWAL_TYPES.map(r => <option key={r}>{r}</option>)}
          </select>
        </FG>
        <FG label="Status">
          <select style={css.select} value={svc.status} onChange={e => onChange('status', e.target.value)}>
            {SERVICE_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </FG>
      </div>
      <div style={css.grid2}>
        <FG label="Proposed New Monthly ($)">
          <input style={css.input} type="number" value={svc.newMonthly} onChange={e => onChange('newMonthly', e.target.value)} placeholder="After savings" />
        </FG>
        <FG label="Monthly Savings ($)">
          <input style={css.input} type="number" value={svc.proposedSavings}
            onChange={e => onChange('proposedSavings', e.target.value)}
            placeholder={svc.monthlyCharge && svc.newMonthly ? (parseNum(svc.monthlyCharge) - parseNum(svc.newMonthly)).toFixed(2) : 'Auto-calc'}
          />
        </FG>
      </div>
      <FG label="Notes">
        <textarea style={css.textarea} value={svc.notes} onChange={e => onChange('notes', e.target.value)} placeholder="Contract notes, consolidation opportunities, action items..." />
      </FG>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: T.text2, cursor: 'pointer' }}>
        <input type="checkbox" checked={!!svc.consolidationFlag} onChange={e => onChange('consolidationFlag', e.target.checked)} />
        Flag for Consolidation
      </label>
    </div>
  )
}

// ─── UPLOAD TAB ───────────────────────────────────────────────────────────────
function UploadTab({ clientId, onAdd }) {
  const [drag, setDrag] = useState(false)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [preview, setPreview] = useState([])
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [showKey, setShowKey] = useState(!API_KEY && !window._BLG_KEY)
  const fileRef = useRef()

  async function runExtraction(docText) {
    setLoading(true); setStatus('🔍 Analyzing document with AI...'); setPreview([])
    try {
      const raw = await callClaude(EXTRACT_SYSTEM, `Extract all service line items from this document:\n\n${docText}`)
      const arr = JSON.parse(raw.replace(/```json|```/g, '').trim())
      const services = arr.map(s => ({ ...EMPTY_SERVICE, ...s, id: uid() }))
      setPreview(services)
      setStatus(`✅ Extracted ${services.length} service(s) — review below and confirm to add to inventory`)
    } catch (e) { setStatus('❌ ' + e.message) }
    finally { setLoading(false) }
  }

  function readFile(file) {
    const reader = new FileReader()
    reader.onload = ev => { setText(ev.target.result); runExtraction(ev.target.result) }
    reader.readAsText(file)
  }

  return (
    <div>
      {showKey && (
        <div style={{ ...css.card, borderColor: T.orange }}>
          <div style={css.cardTitle}>🔑 API Key Required</div>
          <p style={{ fontSize: '13px', color: T.text3, marginBottom: '12px' }}>Enter your Anthropic API key to enable AI extraction. Or set VITE_ANTHROPIC_KEY in your Vercel environment variables (recommended for production).</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input style={{ ...css.input, flex: 1 }} type="password" value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)} placeholder="sk-ant-..." />
            <button style={css.btn('primary')} onClick={() => { window._BLG_KEY = apiKeyInput; setShowKey(false) }}>Save Key</button>
          </div>
        </div>
      )}

      <div style={css.card}>
        <div style={css.cardTitle}>📄 Upload Invoice, Contract, or Bill</div>
        <p style={{ fontSize: '13px', color: T.text3, marginBottom: '16px' }}>
          Paste text or drop a file. AI extracts every service line item — vendor, cost, contract dates, seat counts, and categorizes by service type automatically.
        </p>
        <div
          style={css.uploadZone(drag)}
          onDragOver={e => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]) }}
          onClick={() => fileRef.current.click()}
        >
          <div style={{ fontSize: '36px', marginBottom: '10px' }}>📁</div>
          <div style={{ fontSize: '14px', color: T.text2, marginBottom: '4px' }}>Drop file here or click to browse</div>
          <div style={{ fontSize: '12px', color: T.text3 }}>.txt, .csv supported — or paste text below</div>
          <input ref={fileRef} type="file" accept=".txt,.csv" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) readFile(e.target.files[0]) }} />
        </div>
        <div style={{ marginTop: '14px' }}>
          <label style={css.label}>— or paste document text —</label>
          <textarea style={{ ...css.textarea, minHeight: '140px' }} value={text} onChange={e => setText(e.target.value)} placeholder="Paste invoice, bill copy, contract terms, MSP agreement, software licensing document, or any service/pricing document..." />
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button style={css.btn('primary')} onClick={() => text && runExtraction(text)} disabled={loading || !text}>
              {loading ? <><Spinner /> Extracting...</> : '🤖 Extract with AI'}
            </button>
            <button style={css.btn('secondary')} onClick={() => { setText(''); setPreview([]); setStatus('') }}>Clear</button>
          </div>
        </div>
        {status && <div style={{ marginTop: '12px', padding: '10px 14px', background: T.bg3, borderRadius: '8px', fontSize: '13px', color: status.startsWith('❌') ? T.red : T.green }}>{status}</div>}
      </div>

      {preview.length > 0 && (
        <div style={css.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={css.cardTitle}>🔍 Extracted Services — Review Before Adding</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={css.btn('success')} onClick={() => { preview.forEach(s => onAdd(s)); setPreview([]); setStatus(`✅ Added ${preview.length} service(s) to inventory`) }}>✅ Add All {preview.length} to Inventory</button>
              <button style={css.btn('secondary')} onClick={() => setPreview([])}>Discard</button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={css.table}>
              <thead><tr>{['Category','Vendor','Location','Description','Monthly','Seats','Contract End','Status'].map(h => <th key={h} style={css.th}>{h}</th>)}</tr></thead>
              <tbody>
                {preview.map(s => (
                  <tr key={s.id}>
                    <td style={css.td}><CatBadge cat={s.category} /></td>
                    <td style={css.td}>{s.vendor}</td>
                    <td style={css.td}><span style={{ fontSize: '12px' }}>{s.location || '—'}</span></td>
                    <td style={css.td}>{s.description}</td>
                    <td style={css.td}><strong style={{ color: T.text0 }}>{s.monthlyCharge ? fmt$d(s.monthlyCharge) : '—'}</strong></td>
                    <td style={css.td}>{s.seatCount || '—'}</td>
                    <td style={css.td}><span style={{ fontSize: '12px', color: T.text3 }}>{s.contractEnd || '—'}</span></td>
                    <td style={css.td}><StatusBadge status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={css.card}>
        <div style={css.cardTitle}>✏️ Add Service Manually</div>
        <ManualAddForm onAdd={onAdd} />
      </div>
    </div>
  )
}

function ManualAddForm({ onAdd }) {
  const [svc, setSvc] = useState({ ...EMPTY_SERVICE })
  return (
    <>
      <ServiceForm svc={svc} onChange={(f, v) => setSvc(p => ({ ...p, [f]: v }))} />
      <div style={{ marginTop: '8px' }}>
        <button style={css.btn('primary')} onClick={() => { if (!svc.vendor && !svc.description) return; onAdd({ ...svc, id: uid() }); setSvc({ ...EMPTY_SERVICE }) }}>➕ Add to Inventory</button>
      </div>
    </>
  )
}

// ─── INVENTORY TAB ────────────────────────────────────────────────────────────
function InventoryTab({ services, onUpdate, onDelete }) {
  const [filterCat, setFilterCat] = useState('')
  const [filterLoc, setFilterLoc] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [sortCol, setSortCol] = useState('category')
  const [sortDir, setSortDir] = useState('asc')

  const locations = [...new Set(services.map(s => s.location).filter(Boolean))].sort()
  const filtered = services
    .filter(s => (!filterCat || s.category === filterCat) && (!filterLoc || s.location === filterLoc) && (!filterStatus || s.status === filterStatus) && (!search || [s.vendor, s.description, s.location, s.accountNumber].join(' ').toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => {
      let av = a[sortCol] || '', bv = b[sortCol] || ''
      if (sortCol === 'monthlyCharge') { av = parseNum(av); bv = parseNum(bv) }
      return (av < bv ? -1 : av > bv ? 1 : 0) * (sortDir === 'asc' ? 1 : -1)
    })

  const totalMonthly = filtered.reduce((s, r) => s + parseNum(r.monthlyCharge), 0)
  const totalSavings = filtered.reduce((s, r) => s + (parseNum(r.proposedSavings) || Math.max(0, parseNum(r.monthlyCharge) - parseNum(r.newMonthly))), 0)

  function SortTh({ col, children }) {
    return <th style={{ ...css.th, cursor: 'pointer', userSelect: 'none' }} onClick={() => { if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(col); setSortDir('asc') } }}>{children}{sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</th>
  }

  return (
    <div>
      <div style={css.card}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 180px' }}><label style={css.label}>Search</label><input style={css.input} value={search} onChange={e => setSearch(e.target.value)} placeholder="Vendor, description, location..." /></div>
          <div style={{ flex: '0 1 180px' }}><label style={css.label}>Category</label><select style={css.select} value={filterCat} onChange={e => setFilterCat(e.target.value)}><option value="">All Categories</option>{SERVICE_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
          <div style={{ flex: '0 1 180px' }}><label style={css.label}>Location</label><select style={css.select} value={filterLoc} onChange={e => setFilterLoc(e.target.value)}><option value="">All Locations</option>{locations.map(l => <option key={l}>{l}</option>)}</select></div>
          <div style={{ flex: '0 1 160px' }}><label style={css.label}>Status</label><select style={css.select} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}><option value="">All Statuses</option>{SERVICE_STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
        </div>
        <div style={{ marginTop: '12px', display: 'flex', gap: '20px', fontSize: '13px', color: T.text3, flexWrap: 'wrap' }}>
          <span><strong style={{ color: T.text0 }}>{filtered.length}</strong> of {services.length} records</span>
          <span>Monthly: <strong style={{ color: T.blue }}>{fmt$(totalMonthly)}</strong></span>
          <span>Annual: <strong style={{ color: T.blue }}>{fmt$(totalMonthly * 12)}</strong></span>
          {totalSavings > 0 && <span>Savings Potential: <strong style={{ color: T.green }}>{fmt$(totalSavings)}/mo · {fmt$(totalSavings * 12)}/yr</strong></span>}
        </div>
      </div>

      <div style={{ ...css.card, padding: '0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={css.table}>
            <thead>
              <tr style={{ background: T.bg3 }}>
                <SortTh col="category">Category</SortTh>
                <SortTh col="vendor">Vendor</SortTh>
                <SortTh col="location">Location</SortTh>
                <th style={css.th}>Description</th>
                <SortTh col="monthlyCharge">Monthly</SortTh>
                <th style={css.th}>Seats</th>
                <th style={css.th}>$/Seat</th>
                <th style={css.th}>Spend Owner</th>
                <SortTh col="contractEnd">Contract End</SortTh>
                <th style={css.th}>Renewal</th>
                <SortTh col="status">Status</SortTh>
                <th style={css.th}>Savings</th>
                <th style={css.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={13} style={{ ...css.td, textAlign: 'center', color: T.text3, padding: '48px' }}>No services found. Upload a document or add manually on the Upload tab.</td></tr>}
              {filtered.map(s => {
                const savings = parseNum(s.proposedSavings) || Math.max(0, parseNum(s.monthlyCharge) - parseNum(s.newMonthly))
                const perUnit = s.perUnitCost || (s.seatCount && s.monthlyCharge ? (parseNum(s.monthlyCharge) / parseNum(s.seatCount)).toFixed(2) : '')
                return (
                  <tr key={s.id} onMouseEnter={e => e.currentTarget.style.background = T.bg3} onMouseLeave={e => e.currentTarget.style.background = ''} style={{ transition: 'background 0.1s' }}>
                    <td style={css.td}><CatBadge cat={s.category} /></td>
                    <td style={css.td}><strong style={{ color: T.text0 }}>{s.vendor}</strong>{s.accountNumber && <div style={{ fontSize: '11px', color: T.text3 }}>{s.accountNumber}</div>}</td>
                    <td style={css.td}><span style={{ fontSize: '12px' }}>{s.location || '—'}</span></td>
                    <td style={css.td}>{s.description}</td>
                    <td style={css.td}><strong style={{ color: T.text0 }}>{s.monthlyCharge ? fmt$d(s.monthlyCharge) : '—'}</strong></td>
                    <td style={css.td}>{s.seatCount || '—'}</td>
                    <td style={css.td}>{perUnit ? fmt$d(perUnit) : '—'}</td>
                    <td style={css.td}><span style={{ fontSize: '11px', color: T.text3 }}>{s.spendOwner || '—'}</span></td>
                    <td style={css.td}><span style={{ color: isExpiringSoon(s.contractEnd) ? T.orange : T.text2, fontSize: '12px' }}>{s.contractEnd || '—'}{isExpiringSoon(s.contractEnd) && ' ⚠️'}</span></td>
                    <td style={css.td}><span style={{ fontSize: '11px', color: T.text3 }}>{s.renewalType || '—'}</span></td>
                    <td style={css.td}><StatusBadge status={s.status} /></td>
                    <td style={css.td}>{savings > 0 ? <span style={{ color: T.green, fontWeight: '600', fontSize: '12px' }}>-{fmt$(savings)}/mo</span> : <span style={{ color: T.text3, fontSize: '12px' }}>—</span>}</td>
                    <td style={css.td}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button style={css.btn('secondary', 'sm')} onClick={() => setEditing(s)}>Edit</button>
                        <button style={css.btn('danger', 'sm')} onClick={() => onDelete(s.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Service" wide>
        {editing && <>
          <ServiceForm svc={editing} onChange={(f, v) => setEditing(p => ({ ...p, [f]: v }))} />
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button style={css.btn('primary')} onClick={() => { onUpdate(editing); setEditing(null) }}>Save Changes</button>
            <button style={css.btn('secondary')} onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </>}
      </Modal>
    </div>
  )
}

// ─── LOCATIONS TAB ────────────────────────────────────────────────────────────
function LocationsTab({ services }) {
  const locations = [...new Set(services.map(s => s.location).filter(Boolean))].sort()
  const totalMonthly = services.reduce((a, s) => a + parseNum(s.monthlyCharge), 0)

  if (!locations.length) return (
    <div style={{ ...css.card, textAlign: 'center', padding: '60px', color: T.text3 }}>
      <div style={{ fontSize: '36px', marginBottom: '10px' }}>📍</div>
      <div>No location data yet. Add services with a location in the Inventory tab.</div>
    </div>
  )

  return (
    <div>
      <div style={css.grid4}>
        <StatCard label="Total Locations" value={locations.length} color={T.blue} />
        <StatCard label="Total Services" value={services.length} color={T.purple} />
        <StatCard label="Monthly Spend" value={fmt$(totalMonthly)} color={T.orange} />
        <StatCard label="Annual Spend" value={fmt$(totalMonthly * 12)} color={T.yellow} />
      </div>
      {locations.map(loc => {
        const svcs = services.filter(s => s.location === loc)
        const monthly = svcs.reduce((a, s) => a + parseNum(s.monthlyCharge), 0)
        const savings = svcs.reduce((a, s) => a + (parseNum(s.proposedSavings) || Math.max(0, parseNum(s.monthlyCharge) - parseNum(s.newMonthly))), 0)
        const cats = SERVICE_CATEGORIES.reduce((acc, cat) => { const m = svcs.filter(s => s.category === cat).reduce((a, s) => a + parseNum(s.monthlyCharge), 0); if (m > 0) acc[cat] = m; return acc }, {})
        return (
          <div key={loc} style={css.card}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: T.text0 }}>📍 {loc}</div>
                <div style={{ fontSize: '12px', color: T.text3, marginTop: '3px' }}>{svcs.length} services</div>
              </div>
              <div style={{ display: 'flex', gap: '20px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: T.blue }}>{fmt$(monthly)}<span style={{ fontSize: '12px', fontWeight: '400', color: T.text3 }}>/mo</span></div>
                  <div style={{ fontSize: '11px', color: T.text3 }}>{fmt$(monthly * 12)}/yr</div>
                </div>
                {savings > 0 && <div style={{ textAlign: 'right' }}><div style={{ fontSize: '16px', fontWeight: '700', color: T.green }}>-{fmt$(savings)}/mo</div><div style={{ fontSize: '11px', color: T.text3 }}>potential savings</div></div>}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
              {Object.entries(cats).map(([cat, amt]) => { const m = CATEGORY_META[cat] || { color: T.text3, icon: '⚙️' }; return <span key={cat} style={{ ...css.badge(m.color), padding: '4px 10px' }}>{m.icon} {cat}: {fmt$(amt)}/mo</span> })}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={css.table}>
                <thead><tr>{['Category','Vendor','Description','Monthly','Seats','Contract End','Status'].map(h => <th key={h} style={css.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {svcs.map(s => (
                    <tr key={s.id}>
                      <td style={css.td}><CatBadge cat={s.category} /></td>
                      <td style={css.td}><strong style={{ color: T.text0 }}>{s.vendor}</strong></td>
                      <td style={css.td}>{s.description}</td>
                      <td style={css.td}><strong>{s.monthlyCharge ? fmt$d(s.monthlyCharge) : '—'}</strong></td>
                      <td style={css.td}>{s.seatCount || '—'}</td>
                      <td style={css.td}><span style={{ color: isExpiringSoon(s.contractEnd) ? T.orange : T.text2, fontSize: '12px' }}>{s.contractEnd || '—'}</span></td>
                      <td style={css.td}><StatusBadge status={s.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── FINANCIAL TAB ────────────────────────────────────────────────────────────
function FinancialTab({ services, clientId }) {
  const [noiRate, setNoiRate] = useClientStorage(clientId, 'noiRate', '5.5')
  const [units, setUnits] = useClientStorage(clientId, 'units', '')
  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  const totalMonthly = services.reduce((a, s) => a + parseNum(s.monthlyCharge), 0)
  const totalSavings = services.reduce((a, s) => a + (parseNum(s.proposedSavings) || Math.max(0, parseNum(s.monthlyCharge) - parseNum(s.newMonthly))), 0)
  const annualSavings = totalSavings * 12
  const cap = parseNum(noiRate) / 100
  const valuationUplift = cap > 0 ? annualSavings / cap : 0
  const unitCount = parseNum(units)

  const catBreakdown = SERVICE_CATEGORIES.map(cat => {
    const svcs = services.filter(s => s.category === cat)
    const monthly = svcs.reduce((a, s) => a + parseNum(s.monthlyCharge), 0)
    return { cat, count: svcs.length, monthly, pct: totalMonthly > 0 ? (monthly / totalMonthly) * 100 : 0 }
  }).filter(r => r.count > 0).sort((a, b) => b.monthly - a.monthly)

  const flagged = services.filter(s => s.consolidationFlag || s.status === 'Flagged for Consolidation')
  const expiring = services.filter(s => isExpiringSoon(s.contractEnd))

  async function genAnalysis() {
    setAiLoading(true); setAiText('')
    const summary = {
      totalMonthly: fmt$(totalMonthly), totalAnnual: fmt$(totalMonthly * 12),
      savingsMonthly: fmt$(totalSavings), savingsAnnual: fmt$(annualSavings),
      valuationUplift: fmt$(valuationUplift), capRate: noiRate + '%',
      locations: [...new Set(services.map(s => s.location).filter(Boolean))].length,
      services: services.length, flagged: flagged.length, expiring: expiring.length,
      unitCount: unitCount || 'unknown',
      perUnitMonthly: unitCount > 0 ? fmt$d(totalMonthly / unitCount) : 'N/A',
      perUnitSavings: unitCount > 0 ? fmt$d(annualSavings / unitCount) : 'N/A',
      breakdown: catBreakdown.map(r => `${r.cat}: ${fmt$(r.monthly)}/mo (${r.pct.toFixed(1)}%)`).join(', '),
    }
    try {
      await callClaude(
        'You are a REIT technology expense advisor. Be concise, professional, and metric-focused.',
        `Write a 3-4 paragraph executive analysis for this portfolio:\n${JSON.stringify(summary, null, 2)}\nCover: spend profile, savings opportunities, NOI/valuation impact, priority actions. No bullet points.`,
        chunk => setAiText(p => p + chunk)
      )
    } catch (e) { setAiText('Error: ' + e.message) }
    finally { setAiLoading(false) }
  }

  return (
    <div>
      <div style={css.grid4}>
        <StatCard label="Total Monthly Spend" value={fmt$(totalMonthly)} color={T.blue} sub={`${fmt$(totalMonthly * 12)} annually`} />
        <StatCard label="Monthly Savings Potential" value={fmt$(totalSavings)} color={T.green} sub={`${fmt$(annualSavings)} annually`} />
        <StatCard label="NOI Impact" value={fmt$(annualSavings)} color={T.orange} sub="Annual savings = NOI uplift" />
        <StatCard label="Valuation Uplift" value={fmt$(valuationUplift)} color={T.purple} sub={`At ${noiRate}% cap rate`} />
      </div>

      {unitCount > 0 && (
        <div style={css.grid2}>
          <StatCard label="Technology Cost / Unit / Month" value={fmt$d(totalMonthly / unitCount)} color={T.blueLight} />
          <StatCard label="Savings / Unit / Year" value={fmt$d(annualSavings / unitCount)} color={T.greenLight} />
        </div>
      )}

      <div style={css.card}>
        <div style={css.cardTitle}>⚙️ NOI & Valuation Parameters</div>
        <div style={css.grid3}>
          <FG label="Cap Rate (%)"><input style={css.input} type="number" step="0.1" value={noiRate} onChange={e => setNoiRate(e.target.value)} /></FG>
          <FG label="Total Units / Doors"><input style={css.input} type="number" value={units} onChange={e => setUnits(e.target.value)} placeholder="e.g. 1200" /></FG>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ ...css.statCard(T.yellow), flex: 1, padding: '12px 16px' }}>
              <div style={{ fontSize: '11px', color: T.text3 }}>NOI-to-Value Multiplier</div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: T.yellow, marginTop: '4px' }}>{cap > 0 ? `${(1 / cap).toFixed(1)}x` : '—'}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={css.card}>
        <div style={css.cardTitle}>📊 Spend by Category</div>
        {catBreakdown.map(r => {
          const m = CATEGORY_META[r.cat] || { color: T.text3 }
          return (
            <div key={r.cat} style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}>
                <span style={{ color: T.text2 }}>{CATEGORY_META[r.cat]?.icon} {r.cat} <span style={{ color: T.text3 }}>({r.count} services)</span></span>
                <span style={{ color: T.text0, fontWeight: '600' }}>{fmt$(r.monthly)}/mo <span style={{ color: T.text3 }}>({r.pct.toFixed(1)}%)</span></span>
              </div>
              <div style={css.progress}><div style={css.progressBar(r.pct, m.color)} /></div>
            </div>
          )
        })}
        {catBreakdown.length === 0 && <p style={{ fontSize: '13px', color: T.text3 }}>No services in inventory yet.</p>}
      </div>

      <div style={css.grid2}>
        <div style={css.card}>
          <div style={css.cardTitle}>🚩 Flagged for Consolidation ({flagged.length})</div>
          {flagged.length === 0 ? <p style={{ fontSize: '13px', color: T.text3 }}>None flagged. Use the consolidationFlag checkbox in inventory.</p> : flagged.map(s => (
            <div key={s.id} style={{ padding: '8px 0', borderBottom: `1px solid ${T.border}`, fontSize: '13px' }}>
              <div style={{ color: T.text0 }}>{s.vendor} — {s.description}</div>
              <div style={{ color: T.text3, fontSize: '12px' }}>{s.location} · {s.monthlyCharge ? fmt$d(s.monthlyCharge) + '/mo' : ''}</div>
            </div>
          ))}
        </div>
        <div style={css.card}>
          <div style={css.cardTitle}>⚠️ Expiring Within 90 Days ({expiring.length})</div>
          {expiring.length === 0 ? <p style={{ fontSize: '13px', color: T.text3 }}>No contracts expiring soon.</p> : expiring.map(s => (
            <div key={s.id} style={{ padding: '8px 0', borderBottom: `1px solid ${T.border}`, fontSize: '13px' }}>
              <div style={{ color: T.text0 }}>{s.vendor} — {s.description}</div>
              <div style={{ color: T.orange, fontSize: '12px' }}>Expires: {s.contractEnd} · {s.location}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={css.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={css.cardTitle}>🤖 AI Executive Analysis</div>
          <button style={css.btn('primary')} onClick={genAnalysis} disabled={aiLoading || !services.length}>
            {aiLoading ? <><Spinner /> Generating...</> : '⚡ Generate Analysis'}
          </button>
        </div>
        {aiText
          ? <div style={{ fontSize: '14px', lineHeight: '1.75', color: T.text2, whiteSpace: 'pre-wrap' }}>{aiText}</div>
          : <p style={{ fontSize: '13px', color: T.text3 }}>Click "Generate Analysis" for an AI-powered executive summary — NOI impact, valuation uplift, and prioritized recommendations for C-Suite review.</p>}
      </div>
    </div>
  )
}

// ─── SPEND SUMMARY TAB ────────────────────────────────────────────────────────
function SpendSummaryTab({ services }) {
  const totalMonthly = services.reduce((a, s) => a + parseNum(s.monthlyCharge), 0)
  const totalSavings = services.reduce((a, s) => a + (parseNum(s.proposedSavings) || Math.max(0, parseNum(s.monthlyCharge) - parseNum(s.newMonthly))), 0)

  const groups = [
    { name: 'Connectivity', categories: ['Telecom', 'VoIP / UCaaS', 'Internet Circuit', 'Analog POTS'], color: T.blue },
    { name: 'Software & Services', categories: ['Software License', 'Managed Services', 'Cloud & Infrastructure', 'Security Services'], color: T.purple },
    { name: 'Hardware & Other', categories: ['Hardware / Device Lease', 'Other Technology'], color: T.yellow },
  ]

  const byLocation = [...new Set(services.map(s => s.location).filter(Boolean))].sort().map(loc => {
    const svcs = services.filter(s => s.location === loc)
    const monthly = svcs.reduce((a, s) => a + parseNum(s.monthlyCharge), 0)
    return { loc, monthly, annual: monthly * 12, count: svcs.length }
  }).sort((a, b) => b.monthly - a.monthly)

  const byVendor = Object.entries(services.reduce((acc, s) => {
    if (!s.vendor) return acc
    if (!acc[s.vendor]) acc[s.vendor] = { monthly: 0, count: 0 }
    acc[s.vendor].monthly += parseNum(s.monthlyCharge)
    acc[s.vendor].count++
    return acc
  }, {})).map(([vendor, d]) => ({ vendor, ...d })).sort((a, b) => b.monthly - a.monthly).slice(0, 12)

  const vendorGroups = services.reduce((acc, s) => {
    if (!s.vendor) return acc
    if (!acc[s.vendor]) acc[s.vendor] = []
    acc[s.vendor].push(s)
    return acc
  }, {})
  const consolidation = Object.entries(vendorGroups).filter(([, svcs]) => svcs.length > 1).map(([vendor, svcs]) => ({ vendor, count: svcs.length, locations: [...new Set(svcs.map(s => s.location).filter(Boolean))].length, monthly: svcs.reduce((a, s) => a + parseNum(s.monthlyCharge), 0) })).sort((a, b) => b.count - a.count)

  return (
    <div>
      <div style={css.grid4}>
        <StatCard label="Total Tech Spend" value={fmt$(totalMonthly) + '/mo'} color={T.blue} sub={`${fmt$(totalMonthly * 12)} annually`} />
        <StatCard label="Savings Identified" value={fmt$(totalSavings) + '/mo'} color={T.green} sub={`${fmt$(totalSavings * 12)} annually`} />
        <StatCard label="Savings Rate" value={totalMonthly > 0 ? ((totalSavings / totalMonthly) * 100).toFixed(1) + '%' : '—'} color={T.orange} sub="Of current spend" />
        <StatCard label="Portfolio Size" value={services.length + ' services'} color={T.purple} sub={`${[...new Set(services.map(s => s.location).filter(Boolean))].length} locations`} />
      </div>

      <div style={css.card}>
        <div style={css.cardTitle}>💡 Spend by Group — C-Suite Summary View</div>
        {groups.map(g => {
          const svcs = services.filter(s => g.categories.includes(s.category))
          const monthly = svcs.reduce((a, s) => a + parseNum(s.monthlyCharge), 0)
          const pct = totalMonthly > 0 ? (monthly / totalMonthly) * 100 : 0
          if (!monthly) return null
          return (
            <div key={g.name} style={{ marginBottom: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <strong style={{ color: T.text0, fontSize: '14px' }}>{g.name}</strong>
                <span style={{ color: g.color, fontWeight: '600' }}>{fmt$(monthly)}/mo · {fmt$(monthly * 12)}/yr · {pct.toFixed(1)}%</span>
              </div>
              <div style={css.progress}><div style={css.progressBar(pct, g.color)} /></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {g.categories.map(cat => {
                  const catMonthly = services.filter(s => s.category === cat).reduce((a, s) => a + parseNum(s.monthlyCharge), 0)
                  if (!catMonthly) return null
                  const m = CATEGORY_META[cat] || { color: T.text3, icon: '⚙️' }
                  return <span key={cat} style={css.badge(m.color)}>{m.icon} {cat}: {fmt$(catMonthly)}/mo</span>
                })}
              </div>
            </div>
          )
        })}
        {!totalMonthly && <p style={{ fontSize: '13px', color: T.text3 }}>Add services to see spend breakdown.</p>}
      </div>

      <div style={css.grid2}>
        <div style={css.card}>
          <div style={css.cardTitle}>🏢 Spend by Location</div>
          <table style={css.table}>
            <thead><tr><th style={css.th}>Location</th><th style={css.th}>Svcs</th><th style={css.th}>Monthly</th><th style={css.th}>Annual</th><th style={css.th}>%</th></tr></thead>
            <tbody>
              {byLocation.map(r => (
                <tr key={r.loc}>
                  <td style={css.td}><span style={{ fontSize: '12px' }}>{r.loc}</span></td>
                  <td style={css.td}>{r.count}</td>
                  <td style={css.td}><strong style={{ color: T.text0 }}>{fmt$(r.monthly)}</strong></td>
                  <td style={css.td}>{fmt$(r.annual)}</td>
                  <td style={css.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ ...css.progress, flex: 1 }}><div style={css.progressBar(totalMonthly > 0 ? (r.monthly / totalMonthly) * 100 : 0, T.blue)} /></div>
                      <span style={{ fontSize: '11px', color: T.text3, minWidth: '32px' }}>{totalMonthly > 0 ? ((r.monthly / totalMonthly) * 100).toFixed(1) : 0}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {!byLocation.length && <tr><td colSpan={5} style={{ ...css.td, textAlign: 'center', color: T.text3 }}>No location data</td></tr>}
            </tbody>
          </table>
        </div>

        <div style={css.card}>
          <div style={css.cardTitle}>🏷️ Top Vendors by Spend</div>
          <table style={css.table}>
            <thead><tr><th style={css.th}>Vendor</th><th style={css.th}>Svcs</th><th style={css.th}>Monthly</th><th style={css.th}>Annual</th></tr></thead>
            <tbody>
              {byVendor.map(r => (
                <tr key={r.vendor}>
                  <td style={css.td}><strong style={{ color: T.text0 }}>{r.vendor}</strong></td>
                  <td style={css.td}>{r.count}</td>
                  <td style={css.td}><strong style={{ color: T.blue }}>{fmt$(r.monthly)}</strong></td>
                  <td style={css.td}>{fmt$(r.monthly * 12)}</td>
                </tr>
              ))}
              {!byVendor.length && <tr><td colSpan={4} style={{ ...css.td, textAlign: 'center', color: T.text3 }}>No vendor data</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div style={css.card}>
        <div style={css.cardTitle}>🔍 Consolidation Opportunities</div>
        {consolidation.length === 0 ? (
          <p style={{ fontSize: '13px', color: T.text3 }}>No consolidation opportunities detected yet. Add more services to identify patterns.</p>
        ) : (
          <>
            <p style={{ fontSize: '13px', color: T.text3, marginBottom: '12px' }}>Vendors appearing across multiple services or locations are candidates for enterprise pricing negotiation.</p>
            {consolidation.map(o => (
              <div key={o.vendor} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: T.bg3, borderRadius: '8px', marginBottom: '8px' }}>
                <div>
                  <strong style={{ color: T.text0 }}>{o.vendor}</strong>
                  <span style={{ color: T.text3, fontSize: '12px', marginLeft: '10px' }}>{o.count} services · {o.locations} location(s)</span>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <strong style={{ color: T.blue }}>{fmt$(o.monthly)}/mo</strong>
                  <span style={css.badge(T.orange)}>Consolidation Candidate</span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ─── QUOTES TAB ───────────────────────────────────────────────────────────────
function QuotesTab({ services, clientId }) {
  const [quotes, setQuotes] = useClientStorage(clientId, 'quotes', [])
  const [showForm, setShowForm] = useState(false)
  const [editQ, setEditQ] = useState(null)
  const EMPTY_Q = { id: '', vendor: '', category: '', scope: '', monthlyProposed: '', setupFee: '', contractTerm: '', notes: '', submittedDate: '', status: 'Received' }

  function saveQ(q) {
    if (q.id) setQuotes(p => p.map(x => x.id === q.id ? q : x))
    else setQuotes(p => [...p, { ...q, id: uid() }])
    setEditQ(null); setShowForm(false)
  }

  const quotedCats = [...new Set(quotes.map(q => q.category).filter(Boolean))]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: T.text0 }}>Vendor Quotes & Proposals</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: T.text3 }}>Side-by-side comparison of incoming proposals vs. current spend</p>
        </div>
        <button style={css.btn('primary')} onClick={() => { setEditQ({ ...EMPTY_Q }); setShowForm(true) }}>+ Add Quote</button>
      </div>

      {!quotes.length && (
        <div style={{ ...css.card, textAlign: 'center', padding: '60px', color: T.text3 }}>
          <div style={{ fontSize: '36px', marginBottom: '10px' }}>💼</div>
          <div>No quotes yet. Add vendor proposals to compare against current spend.</div>
        </div>
      )}

      {quotedCats.map(cat => {
        const catQuotes = quotes.filter(q => q.category === cat)
        const currentSvcs = services.filter(s => s.category === cat)
        const currentMonthly = currentSvcs.reduce((a, s) => a + parseNum(s.monthlyCharge), 0)
        const m = CATEGORY_META[cat] || { icon: '⚙️', color: T.text3 }
        return (
          <div key={cat} style={css.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={css.cardTitle}>{m.icon} {cat}</div>
              {currentMonthly > 0 && <span style={css.badge(T.blue)}>Current: {fmt$(currentMonthly)}/mo</span>}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={css.table}>
                <thead><tr style={{ background: T.bg3 }}>{['Vendor','Scope','Monthly Proposed','vs Current','Setup Fee','Term','Status','Notes','Actions'].map(h => <th key={h} style={css.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {currentMonthly > 0 && (
                    <tr style={{ background: 'rgba(56,139,253,0.04)' }}>
                      <td style={css.td}><span style={css.badge(T.blue)}>📌 CURRENT</span></td>
                      <td style={{ ...css.td, color: T.blue, fontWeight: '600' }} colSpan={2}>{fmt$(currentMonthly)}/mo — {currentSvcs.length} service(s)</td>
                      <td style={css.td} colSpan={6} />
                    </tr>
                  )}
                  {catQuotes.map(q => {
                    const proposed = parseNum(q.monthlyProposed)
                    const diff = proposed - currentMonthly
                    const diffPct = currentMonthly > 0 ? ((diff / currentMonthly) * 100).toFixed(1) : null
                    return (
                      <tr key={q.id}>
                        <td style={css.td}><strong style={{ color: T.text0 }}>{q.vendor}</strong></td>
                        <td style={css.td}>{q.scope}</td>
                        <td style={css.td}><strong style={{ color: T.text0 }}>{proposed ? fmt$(proposed) + '/mo' : '—'}</strong></td>
                        <td style={css.td}>{currentMonthly > 0 && proposed ? <span style={{ color: diff < 0 ? T.green : T.red, fontWeight: '600' }}>{diff < 0 ? '▼' : '▲'} {fmt$(Math.abs(diff))}/mo{diffPct ? ` (${Math.abs(diffPct)}%)` : ''}</span> : '—'}</td>
                        <td style={css.td}>{q.setupFee ? fmt$(q.setupFee) : '—'}</td>
                        <td style={css.td}>{q.contractTerm || '—'}</td>
                        <td style={css.td}><StatusBadge status={q.status || 'Received'} /></td>
                        <td style={css.td}><span style={{ fontSize: '12px', color: T.text3 }}>{q.notes}</span></td>
                        <td style={css.td}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button style={css.btn('secondary', 'sm')} onClick={() => { setEditQ(q); setShowForm(true) }}>Edit</button>
                            <button style={css.btn('danger', 'sm')} onClick={() => setQuotes(p => p.filter(x => x.id !== q.id))}>✕</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditQ(null) }} title={editQ?.id ? 'Edit Quote' : 'Add Vendor Quote'}>
        {editQ && (
          <div>
            <div style={css.grid3}>
              <FG label="Vendor"><input style={css.input} value={editQ.vendor} onChange={e => setEditQ(p => ({ ...p, vendor: e.target.value }))} placeholder="e.g. Comcast, RingCentral" /></FG>
              <FG label="Category"><select style={css.select} value={editQ.category} onChange={e => setEditQ(p => ({ ...p, category: e.target.value }))}><option value="">— Select —</option>{SERVICE_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></FG>
              <FG label="Status"><select style={css.select} value={editQ.status} onChange={e => setEditQ(p => ({ ...p, status: e.target.value }))}>{['Received','Under Review','Shortlisted','Selected','Rejected'].map(s => <option key={s}>{s}</option>)}</select></FG>
            </div>
            <FG label="Scope / Description"><input style={css.input} value={editQ.scope} onChange={e => setEditQ(p => ({ ...p, scope: e.target.value }))} placeholder="What services does this quote cover?" /></FG>
            <div style={css.grid3}>
              <FG label="Monthly Proposed ($)"><input style={css.input} type="number" value={editQ.monthlyProposed} onChange={e => setEditQ(p => ({ ...p, monthlyProposed: e.target.value }))} /></FG>
              <FG label="Setup / One-Time Fee ($)"><input style={css.input} type="number" value={editQ.setupFee} onChange={e => setEditQ(p => ({ ...p, setupFee: e.target.value }))} /></FG>
              <FG label="Contract Term"><input style={css.input} value={editQ.contractTerm} onChange={e => setEditQ(p => ({ ...p, contractTerm: e.target.value }))} placeholder="e.g. 36 months" /></FG>
            </div>
            <FG label="Notes"><textarea style={css.textarea} value={editQ.notes} onChange={e => setEditQ(p => ({ ...p, notes: e.target.value }))} placeholder="Key terms, pros/cons..." /></FG>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={css.btn('primary')} onClick={() => saveQ(editQ)}>Save Quote</button>
              <button style={css.btn('secondary')} onClick={() => { setShowForm(false); setEditQ(null) }}>Cancel</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ─── REPORT TAB ───────────────────────────────────────────────────────────────
function ReportTab({ services, clientId, clientName }) {
  const [loading, setLoading] = useState(false)
  const [reportText, setReportText] = useState('')
  const [reportType, setReportType] = useState('executive')

  const totalMonthly = services.reduce((a, s) => a + parseNum(s.monthlyCharge), 0)
  const totalSavings = services.reduce((a, s) => a + (parseNum(s.proposedSavings) || Math.max(0, parseNum(s.monthlyCharge) - parseNum(s.newMonthly))), 0)

  const TYPES = [
    { id: 'executive', label: '📊 C-Suite Executive Summary', desc: 'NOI, valuation impact, key savings — board-ready' },
    { id: 'inventory', label: '📋 Full Inventory Report', desc: 'Complete service list with all fields and contract detail' },
    { id: 'savings', label: '💰 Savings & Opportunity Report', desc: 'Every identified saving, consolidation flag, and contract risk' },
    { id: 'vendor', label: '🏷️ Vendor Analysis', desc: 'Spend by vendor, consolidation candidates, rationalization recs' },
    { id: 'techstack', label: '🖥️ Technology Stack Summary', desc: 'Full tech stack breakdown by category for REIT due diligence' },
  ]

  async function generate() {
    setLoading(true); setReportText('')
    const data = {
      client: clientName || clientId, date: new Date().toLocaleDateString(),
      totalServices: services.length, totalMonthly: fmt$(totalMonthly), totalAnnual: fmt$(totalMonthly * 12),
      savingsMonthly: fmt$(totalSavings), savingsAnnual: fmt$(totalSavings * 12),
      locations: [...new Set(services.map(s => s.location).filter(Boolean))],
      categories: SERVICE_CATEGORIES.map(cat => { const svcs = services.filter(s => s.category === cat); const monthly = svcs.reduce((a, s) => a + parseNum(s.monthlyCharge), 0); return monthly > 0 ? { category: cat, count: svcs.length, monthly: fmt$(monthly), annual: fmt$(monthly * 12) } : null }).filter(Boolean),
      flagged: services.filter(s => s.consolidationFlag).length,
      expiring: services.filter(s => isExpiringSoon(s.contractEnd)).length,
      services: services.map(s => ({ vendor: s.vendor, category: s.category, location: s.location, description: s.description, monthly: s.monthlyCharge, seats: s.seatCount, spendOwner: s.spendOwner, contractEnd: s.contractEnd, status: s.status, savings: s.proposedSavings, consolidationFlag: s.consolidationFlag })),
    }
    const prompts = {
      executive: `Generate a formal C-Suite executive report for ${clientName}. Data:\n${JSON.stringify(data, null, 2)}\nSections: Executive Summary, Portfolio Technology Overview, Financial Impact (NOI + valuation at 5.5% cap), Top Opportunities, Priority Actions. Professional, metric-heavy, board-ready.`,
      inventory: `Generate a complete service inventory report for ${clientName}. Data:\n${JSON.stringify(data, null, 2)}\nGroup by category, include all service details, summarize by location.`,
      savings: `Generate a savings and opportunity analysis for ${clientName}. Data:\n${JSON.stringify(data, null, 2)}\nFocus: identified savings, consolidation opps, contract risks, prioritized action list with dollar values.`,
      vendor: `Generate a vendor analysis for ${clientName}. Data:\n${JSON.stringify(data, null, 2)}\nCover: ranked vendor spend, multi-location vendors, concentration risk, vendor rationalization recommendations.`,
      techstack: `Generate a technology stack summary for ${clientName} for REIT due diligence. Data:\n${JSON.stringify(data, null, 2)}\nCover: complete tech stack by category, coverage gaps, redundancies, per-unit costs, benchmarking observations, stack health rating.`,
    }
    try {
      await callClaude('You are a professional technology expense consultant writing a formal report for a REIT client. Use clear section headers with ═══ underlines. Be precise, metric-focused, and professional.', prompts[reportType], chunk => setReportText(p => p + chunk))
    } catch (e) { setReportText('Error: ' + e.message) }
    finally { setLoading(false) }
  }

  function exportCSV() {
    const headers = ['Category','Vendor','Account #','Location','Description','Monthly $','Annual $','Seats','Per-Unit $','Spend Owner','Contract Start','Contract End','Renewal Type','Status','Proposed Savings/mo','Consolidation Flag','Notes']
    const rows = services.map(s => [s.category, s.vendor, s.accountNumber, s.location, s.description, s.monthlyCharge, (parseNum(s.monthlyCharge) * 12).toFixed(2), s.seatCount, s.perUnitCost || (s.seatCount && s.monthlyCharge ? (parseNum(s.monthlyCharge) / parseNum(s.seatCount)).toFixed(2) : ''), s.spendOwner, s.contractStart, s.contractEnd, s.renewalType, s.status, s.proposedSavings, s.consolidationFlag ? 'Yes' : 'No', s.notes])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `BLG-Inventory-${clientName || clientId}-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  }

  return (
    <div>
      <div style={css.card}>
        <div style={css.cardTitle}>📤 Export Options</div>
        <div style={css.grid2}>
          <div style={{ ...css.statCard(T.green), cursor: 'pointer' }} onClick={exportCSV}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>📊</div>
            <div style={{ fontWeight: '600', color: T.text0 }}>Download Full Inventory CSV</div>
            <div style={{ fontSize: '12px', color: T.text3, marginTop: '4px' }}>All services, all fields — import to Excel or Google Sheets</div>
          </div>
          <div style={{ ...css.statCard(T.blue), cursor: 'pointer', opacity: reportText ? 1 : 0.5 }} onClick={reportText ? () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([reportText], { type: 'text/plain' })); a.download = `BLG-Report-${clientName || clientId}-${new Date().toISOString().slice(0, 10)}.txt`; a.click() } : undefined}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>📄</div>
            <div style={{ fontWeight: '600', color: T.text0 }}>Download Report (.txt)</div>
            <div style={{ fontSize: '12px', color: T.text3, marginTop: '4px' }}>Generate report below then download</div>
          </div>
        </div>
      </div>

      <div style={css.card}>
        <div style={css.cardTitle}>🤖 AI Report Generator</div>
        <div style={{ marginBottom: '16px' }}>
          {TYPES.map(rt => (
            <label key={rt.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px', background: reportType === rt.id ? 'rgba(56,139,253,0.08)' : T.bg3, border: `1px solid ${reportType === rt.id ? T.blue : T.border}`, borderRadius: '8px', marginBottom: '8px', cursor: 'pointer' }}>
              <input type="radio" name="reportType" value={rt.id} checked={reportType === rt.id} onChange={() => setReportType(rt.id)} style={{ marginTop: '2px', flexShrink: 0 }} />
              <div><div style={{ fontWeight: '500', color: T.text0, fontSize: '13px' }}>{rt.label}</div><div style={{ fontSize: '12px', color: T.text3 }}>{rt.desc}</div></div>
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={css.btn('primary')} onClick={generate} disabled={loading || !services.length}>
            {loading ? <><Spinner /> Generating...</> : '⚡ Generate Report'}
          </button>
          {reportText && <button style={css.btn('secondary')} onClick={() => navigator.clipboard.writeText(reportText)}>📋 Copy</button>}
        </div>
      </div>

      {reportText && (
        <div style={{ ...css.card, fontFamily: "'Courier New', monospace", fontSize: '13px', lineHeight: '1.75', color: T.text2, whiteSpace: 'pre-wrap', maxHeight: '700px', overflowY: 'auto' }}>
          {reportText}
        </div>
      )}
    </div>
  )
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  const clientId = params.get('client') || 'default'
  const clientLabel = clientId.charAt(0).toUpperCase() + clientId.slice(1).replace(/-/g, ' ')

  const [services, setServices] = useClientStorage(clientId, 'services_v2', [])
  const [tab, setTab] = useState('upload')

  const addService = (s) => setServices(p => [...p, { ...s, id: s.id || uid() }])
  const updateService = (s) => setServices(p => p.map(x => x.id === s.id ? s : x))
  const deleteService = (id) => setServices(p => p.filter(s => s.id !== id))

  const counts = {
    inventory: services.length,
    locations: [...new Set(services.map(s => s.location).filter(Boolean))].length,
  }

  return (
    <div style={css.app}>
      <style>{`*{box-sizing:border-box}@keyframes spin{to{transform:rotate(360deg)}}input:focus,select:focus,textarea:focus{border-color:#388bfd!important}button:hover{opacity:0.82}::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:#0d1117}::-webkit-scrollbar-thumb{background:#30363d;border-radius:3px}body{margin:0;background:#080b0f}`}</style>

      <header style={css.header}>
        <div style={css.logoMark}>💡</div>
        <div>
          <div style={css.logoText}>BLG Intelligence Platform</div>
          <div style={css.logoSub}>TELECOM · TECHNOLOGY · NOI OPTIMIZATION</div>
        </div>
        <div style={css.clientBadge}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: T.green, flexShrink: 0 }} />
          {clientLabel}
          <span style={{ color: T.border2 }}>·</span>
          <span>{services.length} services</span>
        </div>
      </header>

      <nav style={css.nav}>
        {NAV_TABS.map(t => (
          <button key={t.id} style={css.navBtn(tab === t.id)} onClick={() => setTab(t.id)}>
            {t.icon} {t.label}
            {counts[t.id] > 0 && <span style={{ ...css.badge(T.blue), padding: '1px 6px', fontSize: '10px' }}>{counts[t.id]}</span>}
          </button>
        ))}
      </nav>

      <main style={css.main}>
        {tab === 'upload'    && <UploadTab clientId={clientId} onAdd={addService} />}
        {tab === 'inventory' && <InventoryTab services={services} onUpdate={updateService} onDelete={deleteService} />}
        {tab === 'locations' && <LocationsTab services={services} />}
        {tab === 'financial' && <FinancialTab services={services} clientId={clientId} />}
        {tab === 'spend'     && <SpendSummaryTab services={services} />}
        {tab === 'quotes'    && <QuotesTab services={services} clientId={clientId} />}
        {tab === 'report'    && <ReportTab services={services} clientId={clientId} clientName={clientLabel} />}
      </main>
    </div>
  )
}
