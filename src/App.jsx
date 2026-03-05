import { useState, useEffect, useCallback, useRef } from "react";

// ─── API key comes from Vercel environment variable ───────────────────────────
const API_KEY = import.meta.env.VITE_ANTHROPIC_KEY || "";
const MODEL   = "claude-sonnet-4-20250514";

// ─── Read ?client= from URL ───────────────────────────────────────────────────
function getClientId() {
  const p = new URLSearchParams(window.location.search);
  return p.get("client") || "demo";
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:"#080C14", panel:"#0D1420", card:"#111B2D", card2:"#162035",
  border:"#1C2D45", border2:"#243555",
  amber:"#F5A623", blue:"#0070F3", teal:"#00CFFF",
  green:"#00E59A", orange:"#FF6B2B", lime:"#8EE000",
  red:"#FF4060", purple:"#9B6DFF",
  white:"#F0F7FF", text:"#C0D4F0", muted:"#5A7399", dim:"#2D4060",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt$  = v => v!=null ? `$${Number(v).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}` : "—";
const fmtK  = v => v>=1000000 ? `$${(v/1e6).toFixed(2)}M` : `$${Math.round(v).toLocaleString()}`;
const fmtPct= v => v!=null ? `${(v*100).toFixed(1)}%` : "—";

const s = {
  app:  {fontFamily:"'DM Mono','Fira Code',monospace", background:C.bg, color:C.text, minHeight:"100vh", display:"flex", flexDirection:"column"},
  card: (extra={}) => ({background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:20, ...extra}),
  tag:  (color=C.teal) => ({display:"inline-flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:20,fontSize:10,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",background:`${color}1A`,color,border:`1px solid ${color}40`}),
  btn:  (v="primary") => ({padding:"9px 18px",borderRadius:8,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",fontFamily:"inherit",transition:"all .15s",
    ...(v==="primary"?{background:`linear-gradient(135deg,${C.blue},${C.teal})`,color:"#000"}
      :v==="amber" ?{background:`${C.amber}1A`,color:C.amber,border:`1px solid ${C.amber}40`}
      :v==="green" ?{background:`${C.green}1A`,color:C.green,border:`1px solid ${C.green}40`}
      :v==="red"   ?{background:`${C.red}1A`,color:C.red,border:`1px solid ${C.red}40`}
      :             {background:"transparent",color:C.muted,border:`1px solid ${C.border}`})}),
  th:   {padding:"9px 12px",textAlign:"left",fontSize:10,letterSpacing:"0.1em",textTransform:"uppercase",color:C.muted,borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"},
  td:   (x={}) => ({padding:"9px 12px",borderBottom:`1px solid ${C.border}22`,color:C.text,fontSize:12,verticalAlign:"middle",...x}),
  label:{fontSize:10,letterSpacing:"0.14em",color:C.muted,textTransform:"uppercase",marginBottom:12,display:"flex",alignItems:"center",gap:8},
};

const Bar = ({pct,color=C.teal}) => (
  <div style={{height:4,borderRadius:2,background:`${C.white}08`,marginTop:5}}>
    <div style={{width:`${Math.min(pct,100)}%`,height:"100%",borderRadius:2,background:color,transition:"width .6s ease"}}/>
  </div>
);

// ─── Service type color map ───────────────────────────────────────────────────
const TYPE_COLOR = {
  Electric:C.amber, Gas:C.orange, Water:C.teal,
  Waste:C.lime, POTS:C.amber, Internet:C.blue,
  "UCaaS/VOIP":C.purple, "Software License":C.green, "Analog Circuit":C.muted,
};
const SERVICE_TYPES = ["Electric","Gas","Water","Waste","POTS","Internet","UCaaS/VOIP","Software License","Analog Circuit"];

// ─── Empty client shell ───────────────────────────────────────────────────────
function emptyClient(id) {
  return {
    id, name:id, fullName:"", contact:"", locations:0,
    capRate:0.065, services:[], files:[], notes:"",
  };
}

// ─── PDF export (print-to-PDF via browser) ────────────────────────────────────
function exportReport(client, summary) {
  const w = window.open("","_blank");
  const totalSavings = summary.totalAnnual;
  const noi = totalSavings * 0.92;
  const val = noi / (client.capRate||0.065);
  w.document.write(`
<!DOCTYPE html><html><head>
<title>BLG — ${client.name} Portfolio Analysis</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',sans-serif;color:#1A2B4A;background:#fff;padding:0}
  .cover{background:#0A1628;color:#fff;padding:60px 48px;min-height:220px}
  .cover h1{font-size:13px;letter-spacing:.15em;text-transform:uppercase;color:#F5A623;margin-bottom:8px}
  .cover h2{font-size:32px;font-weight:900;margin-bottom:6px}
  .cover p{color:#8BAED4;font-size:14px}
  .section{padding:32px 48px;border-bottom:1px solid #E2E8F0}
  .section h3{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#8BAED4;margin-bottom:16px}
  .kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
  .kpi{background:#F4F6F9;border-radius:10px;padding:18px;text-align:center}
  .kpi .val{font-size:28px;font-weight:900;color:#0A1628}
  .kpi .lbl{font-size:11px;color:#6B7FA8;margin-top:4px}
  .kpi.green .val{color:#00875A}
  .kpi.amber .val{color:#B87A00}
  .kpi.blue  .val{color:#0050B3}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{padding:9px 12px;text-align:left;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#8BAED4;border-bottom:2px solid #E2E8F0}
  td{padding:9px 12px;border-bottom:1px solid #F0F4F8;color:#1A2B4A}
  tr:last-child td{border-bottom:none}
  .tag{display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
  .footer{background:#0A1628;color:#5A7399;font-size:11px;padding:20px 48px;text-align:center}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
</head><body>
<div class="cover">
  <h1>Bottom Line Generation · Portfolio Analysis</h1>
  <h2>${client.fullName||client.name}</h2>
  <p>Prepared by ${client.preparedBy||"Byron Braun — Bottom Line Generation"} &nbsp;·&nbsp; ${new Date().toLocaleDateString("en-US",{month:"long",year:"numeric"})}</p>
</div>

<div class="section">
  <h3>Portfolio Summary</h3>
  <div class="kpi-row">
    <div class="kpi amber"><div class="val">${fmtK(totalSavings)}</div><div class="lbl">Annual Savings</div></div>
    <div class="kpi green"><div class="val">${fmtK(noi)}</div><div class="lbl">NOI Impact</div></div>
    <div class="kpi blue"><div class="val">${fmtK(val)}</div><div class="lbl">Valuation Uplift</div></div>
    <div class="kpi"><div class="val">${summary.serviceCount}</div><div class="lbl">Services Analyzed</div></div>
  </div>
</div>

<div class="section">
  <h3>Service Inventory</h3>
  <table>
    <thead><tr><th>Location</th><th>Type</th><th>Vendor / Carrier</th><th>Monthly Cost</th><th>Proposed</th><th>Annual Savings</th><th>% Savings</th></tr></thead>
    <tbody>
      ${(client.services||[]).map(r=>`
      <tr>
        <td><strong>${r.location||"—"}</strong></td>
        <td><span class="tag" style="background:${(TYPE_COLOR[r.type]||"#999")}22;color:${TYPE_COLOR[r.type]||"#999"}">${r.type||"—"}</span></td>
        <td>${r.vendor||r.carrier||"—"}</td>
        <td>${fmt$(r.monthly)}</td>
        <td>${r.proposed>0?fmt$(r.proposed):"Pending"}</td>
        <td style="color:#00875A;font-weight:600">${r.savings>0?fmt$(r.savings*12):"—"}</td>
        <td>${r.monthly>0&&r.savings>0?fmtPct(r.savings/r.monthly):"—"}</td>
      </tr>`).join("")}
    </tbody>
  </table>
</div>

<div class="section">
  <h3>Financial Analysis</h3>
  <table>
    <thead><tr><th>Metric</th><th>Value</th></tr></thead>
    <tbody>
      <tr><td>Total Annual Savings Identified</td><td style="font-weight:700;color:#00875A">${fmtK(totalSavings)}</td></tr>
      <tr><td>NOI Improvement (92% flow-through)</td><td style="font-weight:700">${fmtK(noi)}</td></tr>
      <tr><td>Cap Rate Applied</td><td>${((client.capRate||0.065)*100).toFixed(1)}%</td></tr>
      <tr><td>Incremental Asset Valuation</td><td style="font-weight:700;color:#0050B3">${fmtK(val)}</td></tr>
      <tr><td>3-Year Cumulative Savings</td><td style="font-weight:700">${fmtK(totalSavings*3.09)}</td></tr>
      <tr><td>3-Year NOI Impact</td><td>${fmtK(noi*3.09)}</td></tr>
    </tbody>
  </table>
</div>

<div class="footer">
  Bottom Line Generation &nbsp;·&nbsp; Byron Braun &nbsp;·&nbsp; 678.852.3928 &nbsp;·&nbsp; byronbraun@bottomlinegeneration.com &nbsp;·&nbsp; www.bottomlinegeneration.com
</div>
<script>window.onload=()=>{window.print()}</script>
</body></html>`);
  w.document.close();
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const clientId = getClientId();

  // Per-client state stored in localStorage keyed by clientId
  const STORE_KEY = `blg_client_${clientId}`;
  const loadStored = () => {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || emptyClient(clientId); }
    catch { return emptyClient(clientId); }
  };

  const [client, setClient]   = useState(loadStored);
  const [tab, setTab]         = useState("dashboard");
  const [files, setFiles]     = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [chat, setChat]       = useState([{role:"assistant", content:`Hello! I'm your BLG Intelligence Analyst. Upload invoices and documents on the Upload tab to start building the inventory for ${client.name||"this client"}. I'll extract all the data automatically and populate the dashboard.`}]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [editingClient, setEditingClient] = useState(false);
  const [clientForm, setClientForm] = useState({name:"", fullName:"", contact:"", capRate:"6.5"});
  const fileRef  = useRef();
  const chatEnd  = useRef();

  // Persist client data to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(client));
  }, [client]);

  // ── Computed totals ──────────────────────────────────────────────────────────
  const services      = client.services || [];
  const totalMonthly  = services.reduce((s,r)=>s+(r.monthly||0),0);
  const totalSavings  = services.reduce((s,r)=>s+(r.savings||0),0);  // monthly savings
  const totalAnnual   = totalSavings * 12;
  const noi           = totalAnnual * 0.92;
  const capRate       = parseFloat(client.capRate)||0.065;
  const valuation     = noi / capRate;
  const locations     = [...new Set(services.map(r=>r.location).filter(Boolean))].length;
  const summary       = { totalAnnual, serviceCount:services.length };

  // ── File upload & AI extraction ──────────────────────────────────────────────
  const processFiles = useCallback(async (newFiles) => {
    const arr = Array.from(newFiles);
    const objs = arr.map(f=>({id:Date.now()+Math.random(), name:f.name, size:f.size, status:"queued", file:f, extracted:null}));
    setFiles(prev=>[...prev,...objs]);
    setTab("upload");

    for (const fo of objs) {
      setFiles(prev=>prev.map(x=>x.id===fo.id?{...x,status:"processing"}:x));
      try {
        let msgContent = [];

        if (fo.file.type==="application/pdf" || fo.name.endsWith(".pdf")) {
          const b64 = await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(fo.file)});
          msgContent = [
            {type:"document", source:{type:"base64", media_type:"application/pdf", data:b64}},
            {type:"text", text:EXTRACT_PROMPT}
          ];
        } else if (fo.file.type.startsWith("image/")) {
          const b64 = await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(fo.file)});
          msgContent = [
            {type:"image", source:{type:"base64", media_type:fo.file.type, data:b64}},
            {type:"text", text:EXTRACT_PROMPT}
          ];
        } else {
          const text = await fo.file.text().catch(()=>"");
          msgContent = [{type:"text", text:`File: ${fo.name}\n\nContent:\n${text.slice(0,8000)}\n\n${EXTRACT_PROMPT}`}];
        }

        const resp = await fetch("https://api.anthropic.com/v1/messages",{
          method:"POST",
          headers:{"Content-Type":"application/json","x-api-key":API_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
          body:JSON.stringify({model:MODEL, max_tokens:2000, messages:[{role:"user",content:msgContent}]})
        });

        if (!resp.ok) throw new Error(`API ${resp.status}`);
        const data = await resp.json();
        const raw  = data.content?.map(c=>c.text||"").join("") || "";
        let extracted = null;
        try {
          const clean = raw.replace(/```json|```/g,"").trim();
          const start = clean.indexOf("[");
          const end   = clean.lastIndexOf("]");
          if (start!==-1&&end!==-1) extracted = JSON.parse(clean.slice(start,end+1));
        } catch(_) { extracted = null; }

        setFiles(prev=>prev.map(x=>x.id===fo.id?{...x,status:"complete",extracted,rawText:raw}:x));

        // Merge extracted services into client
        if (extracted && Array.isArray(extracted) && extracted.length>0) {
          setClient(prev=>({
            ...prev,
            services:[...( prev.services||[]), ...extracted.map(svc=>({
              id: Date.now()+Math.random(),
              ...svc,
              source: fo.name,
              addedAt: new Date().toISOString(),
            }))],
          }));
        }

      } catch(e) {
        setFiles(prev=>prev.map(x=>x.id===fo.id?{...x,status:"error",error:e.message}:x));
      }
    }
  }, []);

  // ── Chat ──────────────────────────────────────────────────────────────────────
  const sendChat = async () => {
    if (!chatInput.trim()||chatLoading) return;
    const msg = chatInput.trim(); setChatInput("");
    const history = [...chat, {role:"user",content:msg}];
    setChat(history); setChatLoading(true);

    const systemPrompt = `You are the BLG (Bottom Line Generation) Intelligence Analyst — expert in Telecom Expense Management AND Utility (Electric, Gas, Water, Waste) optimization for REIT and commercial real estate portfolios.

Client: ${client.fullName||client.name||clientId}
Locations analyzed: ${locations}
Services in inventory: ${services.length}
Current monthly spend: ${fmt$(totalMonthly)}
Identified monthly savings: ${fmt$(totalSavings)} (${fmtPct(totalMonthly>0?totalSavings/totalMonthly:0)})
Annual savings: ${fmtK(totalAnnual)}
NOI lift: ${fmtK(noi)}
Valuation impact at ${(capRate*100).toFixed(1)}% cap rate: ${fmtK(valuation)}

Service inventory: ${JSON.stringify(services.slice(0,20))}

BLG 5-step process: Audit → Benchmark → Analyze → Optimize → Implement
Company: Bottom Line Generation | Byron Braun | 678.852.3928 | byronbraun@bottomlinegeneration.com

Be specific, data-driven, professional. Tie everything back to NOI and valuation impact. If no data has been uploaded yet, guide the user to upload invoices to get started.`;

    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":API_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({model:MODEL, max_tokens:1000, system:systemPrompt, messages:history.map(({role,content})=>({role,content}))})
      });
      const data = await resp.json();
      const reply = data.content?.map(c=>c.text||"").join("")||"Error — check API key.";
      setChat([...history,{role:"assistant",content:reply}]);
    } catch(e) {
      setChat([...history,{role:"assistant",content:`Connection error: ${e.message}`}]);
    }
    setChatLoading(false);
    setTimeout(()=>chatEnd.current?.scrollIntoView({behavior:"smooth"}),100);
  };

  // ── Delete service ─────────────────────────────────────────────────────────
  const deleteService = id => setClient(prev=>({...prev, services:prev.services.filter(s=>s.id!==id)}));

  // ── Update service field inline ────────────────────────────────────────────
  const updateService = (id, field, value) => setClient(prev=>({
    ...prev,
    services: prev.services.map(s=>s.id===id?{...s,[field]:isNaN(value)?value:Number(value)}:s)
  }));

  // ── Reset client data ──────────────────────────────────────────────────────
  const resetClient = () => { if (confirm("Clear all data for this client? This cannot be undone.")) { localStorage.removeItem(STORE_KEY); setClient(emptyClient(clientId)); setFiles([]); }};

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const TABS = [{id:"dashboard",label:"Dashboard"},{id:"upload",label:"Upload Docs"},{id:"inventory",label:"Inventory"},{id:"analysis",label:"Analysis"},{id:"chat",label:"AI Analyst"}];

  // ── Empty state ────────────────────────────────────────────────────────────
  const isEmpty = services.length === 0;

  return (
    <div style={s.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-thumb{background:#1A2840;border-radius:3px}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
        button:hover{opacity:.85}
        input:focus,select:focus,textarea:focus{outline:none;border-color:${C.amber}!important;box-shadow:0 0 0 2px ${C.amber}15}
        input,select,textarea{background:${C.card2};border:1px solid ${C.border};border-radius:8px;padding:9px 12px;color:${C.white};font-family:inherit;font-size:12px;width:100%}
      `}</style>

      {/* ── Header ── */}
      <header style={{background:C.panel,borderBottom:`1px solid ${C.border}`,padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",height:58,position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:30,height:30,borderRadius:8,background:`linear-gradient(135deg,${C.amber},${C.orange})`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:15,color:"#000"}}>B</div>
          <div>
            <div style={{fontSize:12,fontWeight:800,color:C.white,letterSpacing:"0.06em"}}>BOTTOM LINE <span style={{color:C.amber}}>GENERATION</span></div>
            <div style={{fontSize:9,color:C.muted,letterSpacing:"0.12em",textTransform:"uppercase"}}>Telecom · Energy · NOI Optimization</div>
          </div>
        </div>

        <nav style={{display:"flex",gap:2}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"6px 14px",borderRadius:6,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,letterSpacing:"0.05em",fontFamily:"inherit",background:tab===t.id?`${C.amber}18`:"transparent",color:tab===t.id?C.amber:C.muted,borderBottom:tab===t.id?`2px solid ${C.amber}`:"2px solid transparent",transition:"all .15s"}}>
              {t.label}
            </button>
          ))}
        </nav>

        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {!isEmpty && <button style={s.btn("amber")} onClick={()=>exportReport(client,summary)}>⬇ Export Report</button>}
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:12,fontWeight:700,color:C.white}}>{client.name||clientId}</div>
            <div style={{fontSize:10,color:C.muted}}>{locations} locations · {services.length} services</div>
          </div>
          <div style={{width:8,height:8,borderRadius:"50%",background:isEmpty?C.muted:C.green,boxShadow:isEmpty?"none":`0 0 6px ${C.green}`}}/>
        </div>
      </header>

      <main style={{flex:1,padding:24,maxWidth:1560,margin:"0 auto",width:"100%"}}>

        {/* ── DASHBOARD ── */}
        {tab==="dashboard" && (
          <div>
            {/* Client setup prompt */}
            {!client.fullName && (
              <div style={{...s.card({marginBottom:20,border:`1px solid ${C.amber}40`,background:`${C.amber}08`})}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:C.amber,marginBottom:4}}>Set up this client profile</div>
                    <div style={{fontSize:12,color:C.muted}}>Add the client name, contact, and cap rate to personalize the dashboard and reports.</div>
                  </div>
                  <button style={s.btn("amber")} onClick={()=>{setClientForm({name:client.name||"",fullName:client.fullName||"",contact:client.contact||"",capRate:((client.capRate||0.065)*100).toFixed(1)});setEditingClient(true)}}>Set Up Client →</button>
                </div>
              </div>
            )}

            {/* Client setup modal */}
            {editingClient && (
              <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <div style={s.card({width:480,padding:28})}>
                  <div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:20}}>Client Profile</div>
                  {[
                    {label:"Short Name (used in URL)", field:"name", placeholder:"e.g. integracare"},
                    {label:"Full Client / Portfolio Name", field:"fullName", placeholder:"e.g. IntegraCare Senior Living Portfolio"},
                    {label:"Primary Contact", field:"contact", placeholder:"e.g. John Smith, CFO"},
                    {label:"Cap Rate %", field:"capRate", placeholder:"e.g. 6.5"},
                  ].map(({label,field,placeholder})=>(
                    <div key={field} style={{marginBottom:14}}>
                      <div style={{fontSize:11,color:C.muted,marginBottom:5}}>{label}</div>
                      <input value={clientForm[field]} onChange={e=>setClientForm(f=>({...f,[field]:e.target.value}))} placeholder={placeholder}/>
                    </div>
                  ))}
                  <div style={{display:"flex",gap:10,marginTop:20}}>
                    <button style={s.btn("amber")} onClick={()=>{setClient(prev=>({...prev,...clientForm,capRate:parseFloat(clientForm.capRate)/100||0.065}));setEditingClient(false)}}>Save Profile</button>
                    <button style={s.btn("ghost")} onClick={()=>setEditingClient(false)}>Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {isEmpty ? (
              /* Empty state */
              <div style={{textAlign:"center",padding:"80px 40px"}}>
                <div style={{fontSize:48,marginBottom:20}}>📂</div>
                <div style={{fontSize:22,fontWeight:800,color:C.white,marginBottom:10}}>No data yet for {client.name||clientId}</div>
                <div style={{fontSize:14,color:C.muted,marginBottom:32,maxWidth:480,margin:"0 auto 32px"}}>Upload telecom invoices, utility bills, or contracts on the Upload tab. The AI will extract everything automatically and populate this dashboard.</div>
                <button style={s.btn("primary")} onClick={()=>setTab("upload")}>Upload First Documents →</button>
              </div>
            ) : (
              <>
                {/* KPIs */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
                  {[
                    {label:"Monthly Spend",     value:fmt$(totalMonthly),    sub:"current portfolio total",  color:C.white},
                    {label:"Monthly Savings",   value:fmt$(totalSavings),    sub:fmtPct(totalMonthly>0?totalSavings/totalMonthly:0)+" reduction", color:C.green},
                    {label:"Annual Savings",    value:fmtK(totalAnnual),     sub:"12-month projection",      color:C.amber},
                    {label:"Valuation Uplift",  value:fmtK(valuation),       sub:`NOI ÷ ${(capRate*100).toFixed(1)}% cap rate`, color:C.teal},
                  ].map(m=>(
                    <div key={m.label} style={s.card()}>
                      <div style={{fontSize:10,letterSpacing:"0.12em",color:C.muted,textTransform:"uppercase",marginBottom:8}}>{m.label}</div>
                      <div style={{fontSize:26,fontWeight:800,color:m.color,letterSpacing:"-0.02em"}}>{m.value}</div>
                      <div style={{fontSize:11,color:C.muted,marginTop:4}}>{m.sub}</div>
                    </div>
                  ))}
                </div>

                {/* NOI model + by type */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:20}}>
                  <div style={s.card()}>
                    <div style={s.label}>📐 NOI & Valuation Model</div>
                    {[
                      {label:"Annual Savings",       v:totalAnnual,  color:C.green},
                      {label:"NOI Improvement (92%)",v:noi,          color:C.amber},
                      {label:"Cap Rate",             raw:`${(capRate*100).toFixed(1)}%`},
                      {label:"Asset Valuation Uplift",v:valuation,    color:C.teal, bold:true},
                      {label:"3-Year Cumulative",    v:totalAnnual*3.09, color:C.green},
                    ].map((r,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
                        <span style={{fontSize:12,color:C.muted}}>{r.label}</span>
                        <span style={{fontSize:13,fontWeight:r.bold?800:500,color:r.color||C.text}}>{r.v!=null?fmtK(r.v):r.raw}</span>
                      </div>
                    ))}
                  </div>

                  <div style={s.card()}>
                    <div style={s.label}>📊 Spend by Service Type</div>
                    {SERVICE_TYPES.map(t=>{
                      const spend = services.filter(r=>r.type===t).reduce((s,r)=>s+(r.monthly||0),0);
                      if (!spend) return null;
                      const pct = totalMonthly>0?spend/totalMonthly:0;
                      return (
                        <div key={t} style={{marginBottom:10}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                            <span style={{fontSize:12,color:C.text}}>{t}</span>
                            <span style={{fontSize:11,color:C.muted}}>{fmt$(spend)} · {fmtPct(pct)}</span>
                          </div>
                          <Bar pct={pct*100} color={TYPE_COLOR[t]||C.muted}/>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Location breakdown */}
                <div style={s.card()}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <div style={s.label}>📍 Location Summary</div>
                    <button style={s.btn("amber")} onClick={()=>exportReport(client,summary)}>⬇ Download Client Report</button>
                  </div>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr>{["Location","Service Types","Monthly Spend","Monthly Savings","Annual Savings","% Saved"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {[...new Set(services.map(r=>r.location).filter(Boolean))].map(loc=>{
                        const rows = services.filter(r=>r.location===loc);
                        const monthly = rows.reduce((t,r)=>t+(r.monthly||0),0);
                        const savings = rows.reduce((t,r)=>t+(r.savings||0),0);
                        const types   = [...new Set(rows.map(r=>r.type).filter(Boolean))];
                        const pct     = monthly>0?savings/monthly:0;
                        return (
                          <tr key={loc}>
                            <td style={s.td({color:C.white,fontWeight:600})}>{loc}</td>
                            <td style={s.td()}>{types.map(t=><span key={t} style={{...s.tag(TYPE_COLOR[t]||C.muted),marginRight:4}}>{t}</span>)}</td>
                            <td style={s.td()}>{fmt$(monthly)}</td>
                            <td style={s.td({color:C.green,fontWeight:600})}>{savings>0?fmt$(savings):"—"}</td>
                            <td style={s.td({color:C.amber,fontWeight:600})}>{savings>0?fmtK(savings*12):"—"}</td>
                            <td style={s.td()}>
                              {pct>0&&<><span style={{color:pct>.3?C.green:C.amber,fontWeight:700}}>{fmtPct(pct)}</span><Bar pct={pct*100} color={pct>.3?C.green:C.amber}/></>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── UPLOAD ── */}
        {tab==="upload" && (
          <div>
            <div style={{fontSize:20,fontWeight:800,color:C.white,marginBottom:6}}>Document Upload</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:20}}>Upload any invoice, bill, contract, or proposal — the AI extracts all data automatically.</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              {/* Drop zone */}
              <div>
                <div style={{border:`2px dashed ${dragOver?C.amber:C.border}`,borderRadius:12,padding:"40px 24px",textAlign:"center",cursor:"pointer",background:dragOver?`${C.amber}08`:"transparent",transition:"all .2s",marginBottom:14}}
                  onDragOver={e=>{e.preventDefault();setDragOver(true)}}
                  onDragLeave={()=>setDragOver(false)}
                  onDrop={e=>{e.preventDefault();setDragOver(false);processFiles(e.dataTransfer.files)}}
                  onClick={()=>fileRef.current.click()}>
                  <div style={{fontSize:40,marginBottom:12}}>📂</div>
                  <div style={{fontSize:14,fontWeight:700,color:C.white,marginBottom:6}}>Drop invoices, bills & contracts here</div>
                  <div style={{fontSize:12,color:C.muted,marginBottom:16}}>Electric · Gas · Water · Waste · POTS · Internet · UCaaS · Contracts · Proposals</div>
                  <button style={s.btn("amber")}>Browse Files</button>
                </div>
                <input ref={fileRef} type="file" multiple accept=".pdf,.xlsx,.csv,.docx,.txt,image/*" style={{display:"none"}} onChange={e=>processFiles(e.target.files)}/>

                <div style={s.card()}>
                  <div style={s.label}>What gets extracted automatically</div>
                  {[
                    ["⚡","Electric Bills","Utility, rate, usage, contract dates, savings vs market rate"],
                    ["🔥","Gas Bills","Provider, CCF usage, rates, contract terms"],
                    ["💧","Water & Sewer","Meter info, tier rates, usage history"],
                    ["♻️","Waste / Recycling","Hauler, service frequency, monthly cost"],
                    ["📞","POTS / Analog Lines","Carrier, phone numbers, per-line cost, account number"],
                    ["🌐","Internet / Circuits","Provider, speed, monthly rate, contract end date"],
                    ["☁️","UCaaS / VOIP","Platform, seats, monthly total"],
                    ["💻","Software Licenses","Vendor, product, seats, renewal date"],
                    ["📋","Contracts","Term dates, rates, termination clauses"],
                    ["📊","Vendor Proposals","Quoted rates, terms, SLA — for side-by-side comparison"],
                  ].map(([icon,title,sub])=>(
                    <div key={title} style={{display:"flex",gap:10,padding:"7px 0",borderBottom:`1px solid ${C.border}`}}>
                      <span style={{fontSize:16,flexShrink:0}}>{icon}</span>
                      <div><div style={{fontSize:12,fontWeight:600,color:C.white}}>{title}</div><div style={{fontSize:11,color:C.muted}}>{sub}</div></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Queue */}
              <div style={s.card()}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div style={s.label}>Processing Queue ({files.length})</div>
                  {files.length>0&&<button style={s.btn("ghost")} onClick={()=>setFiles([])}>Clear</button>}
                </div>
                {files.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:C.muted,fontSize:13}}>No files uploaded yet</div>}
                {files.map(f=>(
                  <div key={f.id} style={{padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                      <span style={{fontSize:12,color:C.text,flex:1,marginRight:8}}>{f.name}</span>
                      <span style={s.tag(f.status==="complete"?C.green:f.status==="error"?C.red:f.status==="processing"?C.amber:C.muted)}>{f.status}</span>
                    </div>
                    <div style={{fontSize:11,color:C.muted}}>{(f.size/1024).toFixed(1)} KB</div>
                    {f.status==="processing"&&(
                      <div style={{height:3,borderRadius:2,background:`${C.amber}20`,marginTop:6,overflow:"hidden",position:"relative"}}>
                        <div style={{position:"absolute",width:"40%",height:"100%",background:C.amber,borderRadius:2,animation:"shimmer 1.2s ease-in-out infinite"}}/>
                      </div>
                    )}
                    {f.extracted&&Array.isArray(f.extracted)&&(
                      <div style={{marginTop:8,padding:"8px 10px",background:`${C.green}08`,borderRadius:6,border:`1px solid ${C.green}20`}}>
                        <div style={{fontSize:11,color:C.green,fontWeight:700,marginBottom:3}}>✓ Extracted {f.extracted.length} service{f.extracted.length!==1?"s":""}</div>
                        {f.extracted.slice(0,3).map((e,i)=>(
                          <div key={i} style={{fontSize:11,color:C.muted}}>{e.type||"Service"} · {e.location||"?"} · {e.vendor||e.carrier||"?"} · {fmt$(e.monthly)}/mo</div>
                        ))}
                        {f.extracted.length>3&&<div style={{fontSize:11,color:C.dim}}>+{f.extracted.length-3} more</div>}
                      </div>
                    )}
                    {f.status==="error"&&<div style={{fontSize:11,color:C.red,marginTop:4}}>{f.error}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── INVENTORY ── */}
        {tab==="inventory" && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div>
                <div style={{fontSize:20,fontWeight:800,color:C.white}}>Service Inventory</div>
                <div style={{fontSize:13,color:C.muted,marginTop:2}}>{services.length} services across {locations} locations</div>
              </div>
              <div style={{display:"flex",gap:8}}>
                {services.length>0&&<button style={s.btn("red")} onClick={resetClient}>Reset All Data</button>}
                <button style={s.btn("ghost")} onClick={()=>setTab("upload")}>+ Upload More</button>
              </div>
            </div>

            {isEmpty ? (
              <div style={{...s.card({textAlign:"center",padding:"60px 40px"})}}>
                <div style={{fontSize:36,marginBottom:12}}>📋</div>
                <div style={{fontSize:14,color:C.muted}}>No services yet — upload invoices to build the inventory</div>
                <button style={{...s.btn("amber"),marginTop:16}} onClick={()=>setTab("upload")}>Upload Documents →</button>
              </div>
            ) : (
              <div style={s.card()}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead>
                    <tr>{["Location","Type","Vendor / Carrier","Monthly Cost","Proposed","Monthly Savings","Savings %","Source",""].map(h=><th key={h} style={s.th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {services.map((r)=>{
                      const pct = r.monthly>0&&r.savings>0?r.savings/r.monthly:0;
                      return (
                        <tr key={r.id}>
                          <td style={s.td({color:C.white,fontWeight:600})}>{r.location||"—"}</td>
                          <td style={s.td()}><span style={s.tag(TYPE_COLOR[r.type]||C.muted)}>{r.type||"—"}</span></td>
                          <td style={s.td()}>{r.vendor||r.carrier||"—"}</td>
                          <td style={s.td()}>{fmt$(r.monthly)}</td>
                          <td style={s.td({color:r.proposed>0?C.green:C.muted})}>{r.proposed>0?fmt$(r.proposed):"—"}</td>
                          <td style={s.td({color:r.savings>0?C.green:C.muted,fontWeight:r.savings>0?600:400})}>{r.savings>0?fmt$(r.savings):"—"}</td>
                          <td style={s.td()}>
                            {pct>0&&<><span style={{color:pct>.3?C.green:C.amber,fontWeight:700}}>{fmtPct(pct)}</span><Bar pct={pct*100} color={pct>.3?C.green:C.amber}/></>}
                          </td>
                          <td style={s.td({color:C.dim,fontSize:10})}>{r.source?.slice(0,20)||"manual"}</td>
                          <td style={s.td()}><button style={{...s.btn("red"),padding:"4px 8px",fontSize:10}} onClick={()=>deleteService(r.id)}>✕</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── ANALYSIS ── */}
        {tab==="analysis" && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div>
                <div style={{fontSize:11,letterSpacing:"0.14em",color:C.green,textTransform:"uppercase",marginBottom:4}}>Financial Analysis</div>
                <div style={{fontSize:20,fontWeight:800,color:C.white}}>C-Suite Deliverable · NOI & Valuation Impact</div>
              </div>
              {!isEmpty&&<button style={s.btn("amber")} onClick={()=>exportReport(client,summary)}>⬇ Download Client Report</button>}
            </div>

            {isEmpty ? (
              <div style={{...s.card({textAlign:"center",padding:"60px 40px"})}}>
                <div style={{fontSize:36,marginBottom:12}}>📐</div>
                <div style={{fontSize:14,color:C.muted}}>Upload invoices first to generate financial analysis</div>
                <button style={{...s.btn("amber"),marginTop:16}} onClick={()=>setTab("upload")}>Upload Documents →</button>
              </div>
            ) : (
              <>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
                  <div style={s.card()}>
                    <div style={s.label}>📐 Combined NOI Model</div>
                    {[
                      {label:"Total Annual Savings",          v:totalAnnual,    color:C.green, bold:true},
                      {label:"NOI Improvement (92%)",         v:noi,            color:C.amber, bold:true},
                      {label:`Cap Rate (${(capRate*100).toFixed(1)}%)`,raw:"applied"},
                      {label:"Asset Valuation Uplift",        v:valuation,      color:C.teal,  bold:true},
                      {label:"3-Year Cumulative Savings",     v:totalAnnual*3.09,color:C.green},
                      {label:"3-Year NOI Impact",             v:noi*3.09,       color:C.amber},
                    ].map((r,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
                        <span style={{fontSize:12,color:C.muted}}>{r.label}</span>
                        <span style={{fontSize:13,fontWeight:r.bold?800:500,color:r.color||C.text}}>{r.v!=null?fmtK(r.v):r.raw}</span>
                      </div>
                    ))}
                  </div>
                  <div style={s.card()}>
                    <div style={s.label}>📋 Executive Talking Points</div>
                    {[
                      {icon:"💰",title:"OPEX Reduction",     desc:`Identified ${fmtK(totalAnnual)}/year in combined savings across ${services.length} services — zero capital expenditure required.`},
                      {icon:"📈",title:"NOI Enhancement",    desc:`${fmtK(noi)}/year NOI improvement. Direct contribution to portfolio operating performance.`},
                      {icon:"🏗️",title:"Valuation Impact",   desc:`At ${(capRate*100).toFixed(1)}% cap rate: ${fmtK(valuation)} in incremental asset value. BLG benchmark 10-12x NOI implies ${fmtK(noi*10)}–${fmtK(noi*12)}.`},
                      {icon:"⚡",title:"Market Timing",      desc:`Current market conditions favor locking in fixed-rate supply contracts and renegotiating legacy telecom agreements.`},
                      {icon:"📊",title:"No Upfront Cost",    desc:`100% performance-based model. BLG fees tied to verified savings only. Zero financial risk to engage.`},
                    ].map(pt=>(
                      <div key={pt.title} style={{padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
                        <div style={{fontSize:12,fontWeight:700,color:C.white,marginBottom:3}}>{pt.icon} {pt.title}</div>
                        <div style={{fontSize:11,color:C.muted,lineHeight:1.6}}>{pt.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={s.card()}>
                  <div style={s.label}>📅 3-Year Projection</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:10}}>
                    {[
                      {label:"Year 1\nSavings",    v:totalAnnual,      color:C.green},
                      {label:"Year 2\n(+3%)",      v:totalAnnual*1.03, color:C.green},
                      {label:"Year 3\n(+6%)",      v:totalAnnual*1.06, color:C.green},
                      {label:"3-Year\nTotal",       v:totalAnnual*3.09, color:C.amber, bold:true},
                      {label:"3-Year\nNOI",         v:noi*3.09,         color:C.amber},
                      {label:"Valuation\nDelta",    v:valuation,        color:C.teal,  bold:true},
                    ].map((m,i)=>(
                      <div key={i} style={{padding:"14px 12px",background:`${m.color}08`,borderRadius:10,border:`1px solid ${m.color}25`,textAlign:"center"}}>
                        <div style={{fontSize:10,color:C.muted,marginBottom:6,whiteSpace:"pre-line"}}>{m.label}</div>
                        <div style={{fontSize:18,fontWeight:m.bold?800:600,color:m.color}}>{fmtK(m.v)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── AI ANALYST CHAT ── */}
        {tab==="chat" && (
          <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 130px)"}}>
            <div style={{fontSize:20,fontWeight:800,color:C.white,marginBottom:16}}>AI Analyst — {client.name||clientId}</div>
            <div style={{flex:1,overflowY:"auto",marginBottom:14}}>
              {chat.map((m,i)=>(
                <div key={i} style={{display:"flex",gap:10,marginBottom:14,flexDirection:m.role==="user"?"row-reverse":"row"}}>
                  <div style={{width:32,height:32,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:m.role==="user"?`${C.blue}25`:`${C.amber}15`,fontSize:14,border:`1px solid ${m.role==="user"?C.blue:C.amber}40`}}>
                    {m.role==="user"?"👤":"⚡"}
                  </div>
                  <div style={{maxWidth:"72%",padding:"12px 16px",borderRadius:m.role==="user"?"16px 4px 16px 16px":"4px 16px 16px 16px",background:m.role==="user"?`${C.blue}15`:C.card,border:`1px solid ${m.role==="user"?C.blue+"40":C.border}`,fontSize:13,lineHeight:1.7,color:C.text,whiteSpace:"pre-wrap"}}>
                    {m.content}
                  </div>
                </div>
              ))}
              {chatLoading&&(
                <div style={{display:"flex",gap:10,marginBottom:14}}>
                  <div style={{width:32,height:32,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:`${C.amber}15`,fontSize:14}}>⚡</div>
                  <div style={{padding:"14px 16px",borderRadius:"4px 16px 16px 16px",background:C.card,border:`1px solid ${C.border}`,display:"flex",gap:5,alignItems:"center"}}>
                    {[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:C.amber,animation:"pulse 1s infinite",animationDelay:`${i*.2}s`}}/>)}
                  </div>
                </div>
              )}
              <div ref={chatEnd}/>
            </div>
            <div style={{display:"flex",gap:10}}>
              <input style={{flex:1}} value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendChat()} placeholder="Ask about savings, NOI impact, contract strategy, vendor comparison..."/>
              <button style={s.btn("amber")} onClick={sendChat} disabled={chatLoading}>Send →</button>
            </div>
            <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
              {["Summarize the portfolio","Calculate valuation impact","What should we quote next?","Build executive summary","Identify highest savings opportunities"].map(q=>(
                <button key={q} style={{...s.btn("ghost"),fontSize:11,padding:"5px 11px"}} onClick={()=>setChatInput(q)}>{q}</button>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer style={{borderTop:`1px solid ${C.border}`,padding:"10px 24px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:10,color:C.muted}}>Bottom Line Generation · Byron Braun · 678.852.3928 · byronbraun@bottomlinegeneration.com</div>
        <div style={{fontSize:10,color:C.dim}}>Client: {clientId} · Data stored locally in this browser</div>
      </footer>
    </div>
  );
}

// ─── Extraction prompt ────────────────────────────────────────────────────────
const EXTRACT_PROMPT = `You are a telecom and utility expense analyst. Extract ALL services from this document.

Return a JSON ARRAY (and nothing else — no explanation, no markdown) where each item is one service line:

[
  {
    "location": "property or site name",
    "type": "Electric|Gas|Water|Waste|POTS|Internet|UCaaS/VOIP|Software License|Analog Circuit",
    "vendor": "vendor or carrier name",
    "accountNumber": "account number if present",
    "monthly": 0.00,
    "proposed": 0,
    "savings": 0,
    "contractStart": "MM/YYYY or blank",
    "contractEnd": "MM/YYYY or blank",
    "annualKwh": 0,
    "notes": "any relevant details, phone numbers, speeds, etc"
  }
]

Rules:
- One array item per service line / circuit / meter / phone number
- monthly = current monthly cost (number, no $ sign)
- proposed = quoted replacement cost if present, otherwise 0
- savings = monthly - proposed if both known, otherwise 0
- If it's a proposal/quote document, set proposed = the quoted amount
- If multiple locations appear, create separate items per location
- Return ONLY the JSON array, nothing else`;
