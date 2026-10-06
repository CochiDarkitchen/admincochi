/* ============================================================
   COCHI ADMINISTRACIÓN — app.js
   Reemplaza los dos valores de abajo por los de TU proyecto Supabase
   (Project Settings → API → Project URL / anon public key).
   La anon key NO es secreta: está pensada para vivir en el navegador,
   la seguridad real la da RLS (ver schema.sql). Nunca pongas aquí la
   service_role key.
   ============================================================ */
const SUPABASE_URL = "https://nckixbdxifkibzczpiox.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_hPMA7Elf8N02liO33NyGgg_Idkecirf";
const TZ = "America/Caracas";

let sb;
try{
  if(typeof supabase === "undefined") throw new Error("No se pudo cargar la librería de Supabase (¿sin conexión a internet?)");
  const { createClient } = supabase;
  if(!SUPABASE_URL || SUPABASE_URL.indexOf("PEGA_AQUI") === 0) throw new Error("Falta configurar SUPABASE_URL y SUPABASE_ANON_KEY en app.js");
  sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}catch(e){
  console.error(e);
}
function showFatalError(){
  const root=document.getElementById("root");
  if(root) root.innerHTML = `<div id="login"><div class="login-box">
    <h1>COCHI</h1>
    <p style="color:var(--red);margin-bottom:10px">No se pudo iniciar la aplicación.</p>
    <p style="font-size:13px;color:var(--dim)">Revisa que en <b>app.js</b> reemplazaste <code>SUPABASE_URL</code> y <code>SUPABASE_ANON_KEY</code> por los datos reales de tu proyecto (Project Settings → API en Supabase), y que hay conexión a internet. Abre la consola del navegador (F12) para ver el detalle técnico.</p>
  </div></div>`;
}

/* ---------- helpers ---------- */
function fmt$(n){ return "$"+Number(n||0).toFixed(2); }
function fmtBs(n){ return "Bs. "+Math.round((n||0)*(cache.config.exchange_rate||1)).toLocaleString("es-VE"); }
function todayCaracas(){ return new Date().toLocaleDateString("en-CA",{timeZone:TZ}); }
function dateCaracas(ts){ return ts ? new Date(ts).toLocaleDateString("en-CA",{timeZone:TZ}) : ""; }
function fmtDate(ts){ return ts ? new Date(ts).toLocaleDateString("es-VE",{timeZone:TZ}) : ""; }
function fmtTime(ts){ return ts ? new Date(ts).toLocaleTimeString("es-VE",{timeZone:TZ,hour:"2-digit",minute:"2-digit"}) : ""; }
function escapeHtml(s){ return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

function lighten(hex, amt){
  hex = (hex||"#1c1a17").replace('#','');
  if(hex.length===3) hex = hex.split('').map(c=>c+c).join('');
  const num = parseInt(hex,16) || 0;
  let r=(num>>16)+amt, g=((num>>8)&0xff)+amt, b=(num&0xff)+amt;
  r=Math.max(0,Math.min(255,r)); g=Math.max(0,Math.min(255,g)); b=Math.max(0,Math.min(255,b));
  return "#"+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}
function applyTheme(){
  const c = cache.config || {};
  const bg = c.color_bg || "#1c1a17";
  const accent = c.color_accent || "#e8a33d";
  const root = document.documentElement.style;
  root.setProperty("--bg", bg);
  root.setProperty("--bg2", lighten(bg, 12));
  root.setProperty("--bg3", lighten(bg, 22));
  root.setProperty("--border", lighten(bg, 34));
  root.setProperty("--accent", accent);
  root.setProperty("--accent-d", lighten(accent, -25));
}
function logoHtml(size){
  return cache.config.logo_url ? `<img src="${escapeHtml(cache.config.logo_url)}" alt="logo" style="max-height:${size}px;display:block">` : `<h1>${escapeHtml(cache.config.name||"COCHI")}</h1>`;
}

function toast(msg, isError){
  let t = document.getElementById("toast");
  if(!t){ t=document.createElement("div"); t.id="toast"; document.body.appendChild(t); }
  t.textContent = msg; t.className = isError ? "toast err show" : "toast show";
  clearTimeout(t._h); t._h = setTimeout(()=>t.classList.remove("show"), isError?4000:2200);
}
function friendlyError(e){
  console.error(e);
  const msg = (e && e.message) || "";
  if(msg.includes("Stock insuficiente")) return msg;
  if(msg.includes("no encontrado")) return msg;
  if(msg.toLowerCase().includes("invalid login")) return "Correo o contraseña incorrectos";
  if(msg.toLowerCase().includes("failed to fetch")) return "Sin conexión a internet. Intenta de nuevo.";
  return "Ocurrió un error al procesar la información. Intenta nuevamente." + (msg ? (" ("+msg+")") : "");
}

/* ---------- capa de datos (Supabase) ---------- */
const Api = {
  async list(table, order){
    let q = sb.from(table).select("*");
    if(order) q = q.order(order.col, {ascending: !!order.asc});
    const {data, error} = await q; if(error) throw error; return data;
  },
  async insert(table, val){ const {data,error}=await sb.from(table).insert(val).select().single(); if(error) throw error; return data; },
  async update(table, id, val){ const {data,error}=await sb.from(table).update(val).eq("id",id).select().single(); if(error) throw error; return data; },
  async remove(table, id){ const {error}=await sb.from(table).delete().eq("id",id); if(error) throw error; }
};

let cache = { products:[], customers:[], orders:[], orderItemsAll:[], expenses:[], providers:[], zones:[], inventory:[], productIngredients:[], config:{name:"COCHI",phone:"",address:"",exchange_rate:1} };

async function loadProducts(){ cache.products = await Api.list("products",{col:"name",asc:true}); }
async function loadInventory(){ cache.inventory = await Api.list("ingredients",{col:"name",asc:true}); }
async function loadProductIngredients(){
  const {data,error}=await sb.from("product_ingredients").select("*, ingredients(name,unit,cost,merma_percent)").order("created_at",{ascending:true});
  if(error) throw error; cache.productIngredients=data||[];
}
async function loadCustomers(){ cache.customers = await Api.list("customers",{col:"name",asc:true}); }
async function loadOrders(){
  const {data,error} = await sb.from("orders").select("*, customers(name,phone,address)").order("order_number",{ascending:false});
  if(error) throw error; cache.orders = data;
}
async function loadOrderItemsAll(){
  const {data,error} = await sb.from("order_items").select("product_name, quantity, orders(status)");
  if(error) throw error; cache.orderItemsAll = data;
}
async function loadOrdersAndItems(){ await loadOrders(); await loadOrderItemsAll(); }
async function loadExpenses(){
  const {data,error} = await sb.from("expenses").select("*, providers(name)").order("expense_date",{ascending:false});
  if(error) throw error; cache.expenses = data;
}
async function loadProviders(){ cache.providers = await Api.list("providers",{col:"name",asc:true}); }
async function loadZones(){ cache.zones = await Api.list("delivery_zones",{col:"name",asc:true}); }
async function loadConfig(){ const {data,error}=await sb.from("config").select("*").eq("id",1).single(); if(error) throw error; cache.config=data; applyTheme(); }
async function loadAll(){ await Promise.all([loadProducts(),loadInventory(),loadProductIngredients(),loadCustomers(),loadOrdersAndItems(),loadExpenses(),loadProviders(),loadZones(),loadConfig()]); }

let realtimeStarted = false;
function watch(table, loader){
  sb.channel("rt-"+table).on("postgres_changes", {event:"*", schema:"public", table}, ()=>{ loader().then(render).catch(e=>console.error(e)); }).subscribe();
}
function initRealtime(){
  if(realtimeStarted) return; realtimeStarted = true;
  watch("products", loadProducts); watch("ingredients", loadInventory); watch("ingredient_movements", loadInventory); watch("product_ingredients", loadProductIngredients); watch("customers", loadCustomers);
  watch("orders", loadOrdersAndItems); watch("order_items", loadOrdersAndItems);
  watch("expenses", loadExpenses); watch("providers", loadProviders);
  watch("delivery_zones", loadZones); watch("config", loadConfig);
}

/* ---------- estado ---------- */
let state = { user:null, route:"loading", modal:null, orderCart:[], orderCustomer:null, orderCustomerSearch:"", quickCustomerOpen:false, orderZone:"", orderDiscount:0, orderNotes:"", filterStatus:"", search:"", orderDateFilter:"", financialPeriod:"day", inventorySearch:"", inventoryLowOnly:false };

async function initApp(){
  try{ await loadAll(); initRealtime(); render(); }
  catch(e){ toast(friendlyError(e), true); render(); }
}

/* ---------- RENDER ---------- */
function render(){
  const root=document.getElementById("root");
  if(state.route==="loading"){ root.innerHTML = `<div id="login"><div class="login-box c" style="text-align:center">Cargando…</div></div>`; return; }
  root.innerHTML = state.route==="login" ? loginView() : shellView();
  wireLogin(); wireShell();
  if(state.modal) openModal(state.modal);
}

function loginView(){
  return `<div id="login"><div class="login-box">
    ${logoHtml(56)}<p>Panel de administración</p>
    <div class="field"><label>Correo</label><input id="lu" type="email" placeholder="admin@cochi.com"></div>
    <div class="field"><label>Contraseña</label><input id="lp" type="password" placeholder="••••••"></div>
    <button class="btn-primary" id="lbtn" style="width:100%">Iniciar sesión</button>
    <div class="login-err" id="lerr"></div>
  </div></div>`;
}
function wireLogin(){
  if(state.route!=="login") return;
  const btn=document.getElementById("lbtn");
  const doLogin=async ()=>{
    const email=document.getElementById("lu").value.trim(), password=document.getElementById("lp").value;
    document.getElementById("lerr").textContent="";
    if(!email||!password){ document.getElementById("lerr").textContent="Ingresa tu correo y contraseña"; return; }
    btn.disabled=true; btn.textContent="Ingresando...";
    const {error} = await sb.auth.signInWithPassword({email,password});
    btn.disabled=false; btn.textContent="Iniciar sesión";
    if(error) document.getElementById("lerr").textContent = friendlyError(error);
  };
  btn.onclick=doLogin;
  document.getElementById("lp").addEventListener("keydown",e=>{ if(e.key==="Enter") doLogin(); });
}

const NAV = [["dashboard","📊 Dashboard"],["ordenes","🧾 Órdenes"],["productos","🍗 Platillos"],["inventario","📦 Inventario"],["clientes","👤 Clientes"],["gastos","💸 Gastos"],["proveedores","🏭 Proveedores"],["config","⚙️ Configuración"]];

function shellView(){
  const views = { dashboard:dashboardView, ordenes:ordenesView, productos:productosView, inventario:inventarioView, clientes:clientesView, gastos:gastosView, proveedores:proveedoresView, config:configView };
  const body = (views[state.route]||dashboardView)();
  return `<div id="shell">
    <div id="sidebar">
      ${logoHtml(36)}<div class="tag">Administración</div>
      ${NAV.map(([k,l])=>`<button class="nav-item ${state.route===k?'active':''}" data-nav="${k}">${l}</button>`).join("")}
      <button class="btn-ghost" id="logout">Cerrar sesión</button>
    </div>
    <main>${body}</main>
    <div id="mobile-nav">${NAV.map(([k,l])=>{ const sp=l.indexOf(" "); const icon=l.slice(0,sp), label=l.slice(sp+1); return `<button class="${state.route===k?'active':''}" data-nav="${k}"><span style="font-size:18px">${icon}</span><span style="font-size:9px">${label}</span></button>`; }).join("")}</div>
  </div>`;
}
function wireShell(){
  document.querySelectorAll("[data-nav]").forEach(b=>b.onclick=()=>{
    state.route=b.dataset.nav;
    state.modal=null;
    state.search="";
    state.filterStatus="";
    state.inventorySearch="";
    state.inventoryLowOnly=false;
    render();
  });
  const lo=document.getElementById("logout");
  if(lo) lo.onclick=()=>sb.auth.signOut();
}

function statusLabel(s){
  return {
    pendiente:"Pendiente",
    preparacion:"En preparación",
    lista:"Lista",
    delivery:"En delivery",
    completada:"Completada",
    cancelada:"Cancelada"
  }[s] || s;
}

/* ---------- FILTRO FINANCIERO ---------- */
function shiftDateStr(dateStr, days){
  const d=new Date(dateStr+"T12:00:00");
  d.setDate(d.getDate()+days);
  return d.toLocaleDateString("en-CA",{timeZone:TZ});
}
function financialRange(mode){
  const today=todayCaracas();
  if(mode==="month"){
    const start=today.slice(0,7)+"-01";
    return {start,end:today,label:"Este mes"};
  }
  if(mode==="weekend"){
    const d=new Date(today+"T12:00:00");
    const day=d.getDay();
    const saturday=shiftDateStr(today,day===0?-1:6-day);
    const sunday=shiftDateStr(saturday,1);
    return {start:saturday,end:sunday,label:"Fin de semana"};
  }
  return {start:today,end:today,label:"Hoy"};
}
function inFinancialRange(dateValue,range){
  const d=typeof dateValue==="string" && /^\d{4}-\d{2}-\d{2}$/.test(dateValue) ? dateValue : dateCaracas(dateValue);
  return d>=range.start && d<=range.end;
}
function financialSummary(mode){
  const range=financialRange(mode);
  const sales=cache.orders.filter(o=>o.status!=="cancelada" && inFinancialRange(o.order_date,range)).reduce((s,o)=>s+Number(o.total||0),0);
  const expenses=cache.expenses.filter(e=>inFinancialRange(e.expense_date,range)).reduce((s,e)=>s+Number(e.amount||0),0);
  return {range,sales,expenses,balance:sales-expenses};
}

/* ---------- DASHBOARD ---------- */
function dashboardView(){
  const orders=cache.orders;
  const period=financialSummary(state.financialPeriod||"day");
  const todays=orders.filter(o=>dateCaracas(o.order_date)===todayCaracas() && o.status!=="cancelada");
  const ventasHoy=todays.reduce((s,o)=>s+Number(o.total||0),0);
  const gastosHoy=cache.expenses.filter(e=>e.expense_date===todayCaracas()).reduce((s,e)=>s+Number(e.amount||0),0);
  const pendientes=orders.filter(o=>["pendiente","preparacion","lista","delivery"].includes(o.status)).length;
  const completadasHoy=todays.filter(o=>o.status==="completada").length;
  const ticketPromedio=todays.length?ventasHoy/todays.length:0;
  const clientes=cache.customers.length;
  const sales={};
  (cache.orderItemsAll||[]).forEach(it=>{ if(it.orders && it.orders.status!=="cancelada") sales[it.product_name]=(sales[it.product_name]||0)+Number(it.quantity||0); });
  const ranked=Object.entries(sales).sort((a,b)=>b[1]-a[1]);
  const top=ranked.slice(0,5);
  const maxQty=ranked.length?ranked[0][1]:1;
  const bar=(name,qty)=>`<div class="summary-line"><span>${escapeHtml(name)}</span><span style="display:flex;align-items:center;gap:8px"><span style="background:var(--accent);height:6px;width:${Math.max(6,Math.round((qty/maxQty)*100))}px;border-radius:3px;display:inline-block"></span>${qty}</span></div>`;
  const latestOrders=orders.slice(0,5);
  const mode=state.financialPeriod||"day";
  return `<div class="topbar"><h2>Dashboard</h2><div style="display:flex;gap:8px;flex-wrap:wrap"><select id="financialPeriod" title="Período financiero"><option value="day" ${mode==="day"?"selected":""}>Día</option><option value="weekend" ${mode==="weekend"?"selected":""}>Fin de semana</option><option value="month" ${mode==="month"?"selected":""}>Mes</option></select><button class="btn-primary" id="quickExpense">+ Añadir gasto</button></div></div>
  <div class="panel" style="padding:12px 16px;margin-bottom:16px"><b>Ingresos y gastos · ${period.range.label}</b><div style="font-size:12px;color:var(--dim);margin-top:3px">${period.range.start===period.range.end?period.range.start:period.range.start+" → "+period.range.end}</div></div>
  <div class="cards">
    <div class="card"><div class="label">Ingresos del período</div><div class="val">${fmt$(period.sales)}</div><div class="sub">${fmtBs(period.sales)}</div></div>
    <div class="card"><div class="label">Gastos del período</div><div class="val">${fmt$(period.expenses)}</div><div class="sub">${fmtBs(period.expenses)}</div></div>
    <div class="card"><div class="label">Ganancia estimada</div><div class="val">${fmt$(period.balance)}</div><div class="sub">${fmtBs(period.balance)}</div></div>
    <div class="card"><div class="label">Órdenes de hoy</div><div class="val">${todays.length}</div><div class="sub">${completadasHoy} completadas</div></div>
    <div class="card"><div class="label">Ticket promedio</div><div class="val">${fmt$(ticketPromedio)}</div><div class="sub">por orden</div></div>
    <div class="card"><div class="label">Órdenes pendientes</div><div class="val">${pendientes}</div><div class="sub">en todo el sistema</div></div>
    <div class="card"><div class="label">Clientes registrados</div><div class="val">${clientes}</div></div>
  </div>
  <div class="row2" style="margin-bottom:24px"><div class="panel" style="padding:18px"><div style="color:var(--dim);font-size:14px;margin-bottom:8px">Productos más vendidos</div>${top.map(([n,q])=>bar(n,q)).join("")||'<div class="empty" style="padding:16px">Aún no hay ventas registradas</div>'}</div><div class="panel" style="padding:18px"><div style="color:var(--dim);font-size:14px;margin-bottom:8px">Últimas órdenes</div>${latestOrders.map(o=>`<div class="summary-line"><span>#${o.order_number} — ${o.customers?escapeHtml(o.customers.name):"—"}</span><span>${fmt$(o.total)} · <span class="badge b-${o.status}">${statusLabel(o.status)}</span></span></div>`).join("")||'<div class="empty" style="padding:16px">Aún no hay órdenes</div>'}</div></div>
  <div class="panel" style="padding:18px"><div style="color:var(--dim);font-size:14px;margin-bottom:8px">Resumen del período</div><div class="summary-line"><span>Ingresos</span><span>${fmt$(period.sales)}</span></div><div class="summary-line"><span>Gastos</span><span>${fmt$(period.expenses)}</span></div><div class="summary-line total"><span>Ganancia estimada</span><span>${fmt$(period.balance)}</span></div></div>`;
}

/* ---------- PRODUCTOS ---------- */
function productosView(){
  const items = cache.products.filter(p=>!state.search || p.name.toLowerCase().includes(state.search.toLowerCase()));
  return `<div class="topbar"><h2>Platillos</h2><button class="btn-primary" id="newProd">+ Nuevo platillo</button></div>
  <div class="toolbar"><input id="pSearch" placeholder="Buscar platillo..." value="${escapeHtml(state.search)}"></div>
  <div class="panel"><table><thead><tr><th>Nombre</th><th>Categoría</th><th>Venta</th><th>Costo estimado</th><th>Margen</th><th>Receta</th><th>Estado</th><th></th></tr></thead><tbody>
  ${items.map(p=>{ const c=recipeCost(p.id); const margin=Number(p.price||0)-c; const pct=Number(p.price||0)>0 ? (margin/Number(p.price))*100 : 0; const rec=productRecipe(p.id).length; return `<tr><td><b>${escapeHtml(p.name)}</b></td><td>${escapeHtml(p.category||"—")}</td><td>${fmt$(p.price)} <span style="color:var(--dim)">/ ${fmtBs(p.price)}</span></td><td>${rec?fmt$(c):"—"}</td><td>${rec?fmt$(margin)+` <span style="color:var(--dim)">(${pct.toFixed(1)}%)</span>`:"—"}</td><td>${rec?rec+" ingred.":"Sin receta"}</td><td><span class="badge ${p.available?'b-completada':'b-cancelada'}">${p.available?'Disponible':'No disponible'}</span></td><td style="text-align:right"><button class="btn-ghost btn-sm" data-edit-prod="${p.id}">Editar</button> <button class="btn-danger btn-sm" data-del-prod="${p.id}">Eliminar</button></td></tr>`;}).join("") || '<tr><td colspan="8" class="empty">No hay platillos</td></tr>'}
  </tbody></table></div>`;
}
function recipeCost(productId){
  return (cache.productIngredients||[]).filter(r=>r.product_id===productId).reduce((sum,r)=>{
    const q=Number(r.quantity||0);
    const c=Number(r.ingredients?.cost||0);
    const waste=Math.min(99.99,Math.max(0,Number(r.ingredients?.merma_percent||0)));
    return sum + (waste>=100 ? 0 : (q*c/(1-waste/100)));
  },0);
}
function productRecipe(productId){ return (cache.productIngredients||[]).filter(r=>r.product_id===productId); }
function productFormHtml(p){
  p = p || {id:"",name:"",category:"",price:"",stock:"",available:true};
  const recipe=productRecipe(p.id);
  const cost=recipeCost(p.id);
  return `<h3>${p.id?"Editar platillo":"Nuevo platillo"}</h3>
    <div class="field"><label>Nombre</label><input id="f-name" value="${escapeHtml(p.name||"")}"></div>
    <div class="row2">
      <div class="field"><label>Categoría</label><input id="f-cat" value="${escapeHtml(p.category||"")}" placeholder="Pollos, Hamburguesas..."></div>
      <div class="field"><label>Precio de venta (USD)</label><input id="f-price" type="number" step="0.01" value="${p.price??""}"></div>
    </div>
    <div class="field"><label>Stock propio del platillo (opcional / legado)</label><input id="f-stock" type="number" step="1" value="${p.stock??""}"></div>
    <label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="f-avail" style="width:auto" ${p.available?"checked":""}> Disponible</label>
    ${p.id ? `
      <div class="panel" style="padding:14px;margin-top:16px">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px">
          <div><b>Receta / ingredientes</b><div style="font-size:12px;color:var(--dim)">La cantidad debe usar la misma unidad del inventario.</div></div>
          <div style="text-align:right"><div style="font-size:12px;color:var(--dim)">Costo estimado</div><b style="font-size:18px">${fmt$(cost)}</b></div>
        </div>
        ${recipe.length ? recipe.map(r=>`<div class="summary-line" style="gap:8px"><span>${escapeHtml(r.ingredients?.name||"Ingrediente")}</span><span>${Number(r.quantity||0).toFixed(3)} ${escapeHtml(r.ingredients?.unit||"")} · ${fmt$(Number(r.quantity||0)*Number(r.ingredients?.cost||0)/(1-Math.min(99.99,Math.max(0,Number(r.ingredients?.merma_percent||0)))/100))} <button class="btn-danger btn-sm" data-del-recipe="${r.id}">Quitar</button></span></div>`).join("") : '<div class="empty" style="padding:14px">Este platillo todavía no tiene ingredientes.</div>'}
        <div class="row2" style="margin-top:12px">
          <div class="field"><label>Ingrediente</label><select id="ri-item"><option value="">Selecciona...</option>${cache.inventory.filter(i=>i.active!==false).map(i=>`<option value="${i.id}">${escapeHtml(i.name)} — ${escapeHtml(i.unit)} · ${fmt$(i.cost)}/unidad</option>`).join("")}</select></div>
          <div class="field"><label>Cantidad por platillo</label><input id="ri-qty" type="number" step="0.001" min="0.001" placeholder="Ej: 0.300"></div>
        </div>
        <button class="btn-ghost btn-sm" id="addRecipeIngredient">+ Agregar ingrediente</button>
      </div>` : `
      <div class="panel" style="padding:12px;margin-top:14px;color:var(--dim);font-size:13px">Guarda el platillo primero. Luego podrás agregarle sus ingredientes y el sistema calculará automáticamente su costo.</div>`}
    <div class="modal-actions"><button class="btn-ghost" id="cancel">Cancelar</button><button class="btn-primary" id="save">Guardar</button></div>`;
}

/* ---------- INVENTARIO ---------- */
function inventarioView(){
  let items=(cache.inventory||[]);
  if(state.inventorySearch){ const q=state.inventorySearch.toLowerCase().trim(); items=items.filter(i=>(i.name||"").toLowerCase().includes(q)); }
  if(state.inventoryLowOnly) items=items.filter(i=>i.active!==false && ((Number(i.stock||0) <= Number(i.min_stock||0) && Number(i.min_stock||0)>0) || Number(i.stock||0)<=0));
  const low=(cache.inventory||[]).filter(i=>i.active!==false && ((Number(i.stock||0) <= Number(i.min_stock||0) && Number(i.min_stock||0)>0) || Number(i.stock||0)<=0));
  const value=items.reduce((s,i)=>s+Number(i.stock||0)*Number(i.cost||0),0);
  return `<div class="topbar"><h2>Inventario</h2><button class="btn-primary" id="newInventory">+ Nuevo ingrediente</button></div>
  <div class="cards" style="margin-bottom:16px"><div class="card"><div class="label">Ingredientes activos</div><div class="val">${(cache.inventory||[]).filter(i=>i.active!==false).length}</div></div><div class="card"><div class="label">Stock bajo</div><div class="val" style="color:${low.length?'var(--red)':'var(--green)'}">${low.length}</div></div><div class="card"><div class="label">Valor mostrado</div><div class="val">${fmt$(value)}</div></div></div>
  <div class="toolbar"><input id="inventorySearch" placeholder="Buscar ingrediente..." value="${escapeHtml(state.inventorySearch||"")}" style="flex:1;min-width:220px"><label style="display:flex;align-items:center;gap:8px;margin:0"><input id="inventoryLowOnly" type="checkbox" style="width:auto" ${state.inventoryLowOnly?'checked':''}> Solo stock bajo</label></div>
  <div class="panel"><table><thead><tr><th>Ingrediente</th><th>Stock</th><th>Mínimo</th><th>Costo / ${"unidad"}</th><th>Merma</th><th>Valor</th><th>Estado</th><th></th></tr></thead><tbody>
  ${items.map(i=>{const lowi=((Number(i.stock||0) <= Number(i.min_stock||0) && Number(i.min_stock||0)>0) || Number(i.stock||0)<=0); return `<tr><td><b>${escapeHtml(i.name)}</b><div style="font-size:11px;color:var(--dim)">${escapeHtml(i.unit)}</div></td><td>${Number(i.stock||0).toFixed(3)}</td><td>${Number(i.min_stock||0).toFixed(3)}</td><td>${fmt$(i.cost)}</td><td>${Number(i.merma_percent||0).toFixed(1)}%</td><td>${fmt$(Number(i.stock||0)*Number(i.cost||0))}</td><td><span class="badge ${lowi?'b-cancelada':'b-completada'}">${lowi?'Reponer':'OK'}</span> <span class="badge ${i.active!==false?'b-completada':'b-cancelada'}">${i.active!==false?'Activo':'Inactivo'}</span></td><td style="text-align:right;white-space:nowrap"><button class="btn-ghost btn-sm" data-edit-inv="${i.id}">Editar</button> <button class="btn-ghost btn-sm" data-add-stock="${i.id}">+ Stock</button> <button class="btn-ghost btn-sm" data-waste-stock="${i.id}">Merma</button></td></tr>`;}).join("") || '<tr><td colspan="8" class="empty">No hay ingredientes registrados.</td></tr>'}
  </tbody></table></div>`;
}
function inventoryFormHtml(i){
  i=i||{id:"",name:"",unit:"kg",stock:0,min_stock:0,cost:0,merma_percent:0,active:true};
  return `<h3>${i.id?"Editar ingrediente":"Nuevo ingrediente"}</h3>
  <div class="field"><label>Nombre del ingrediente</label><input id="inv-name" value="${escapeHtml(i.name||"")}" placeholder="Ej: Costilla de cerdo"></div>
  <div class="row2"><div class="field"><label>Unidad base</label><select id="inv-unit">${["kg","g","l","ml","unidad","paquete","caja"].map(u=>`<option value="${u}" ${i.unit===u?'selected':''}>${u}</option>`).join("")}</select></div><div class="field"><label>Costo por unidad (USD)</label><input id="inv-cost" type="number" step="0.0001" min="0" value="${i.cost??0}"></div></div>
  <div class="row2"><div class="field"><label>Cantidad actual</label><input id="inv-stock" type="number" step="0.001" min="0" value="${i.stock??0}"></div><div class="field"><label>Cantidad mínima</label><input id="inv-min" type="number" step="0.001" min="0" value="${i.min_stock??0}"></div></div>
  <div class="row2"><div class="field"><label>Merma estimada (%)</label><input id="inv-waste" type="number" step="0.1" min="0" max="99.99" value="${i.merma_percent??0}"></div><div class="field"><label>Estado</label><select id="inv-active"><option value="true" ${i.active!==false?'selected':''}>Activo</option><option value="false" ${i.active===false?'selected':''}>Inactivo</option></select></div></div>
  <div style="font-size:12px;color:var(--dim);line-height:1.5">La merma se usa para calcular el costo real del platillo. Ejemplo: 30% de merma significa que para obtener 1 kg útil se considera un consumo de aproximadamente 1,43 kg de inventario.</div>
  <div class="modal-actions"><button class="btn-ghost" id="cancel">Cancelar</button><button class="btn-primary" id="save">Guardar</button></div>`;
}
function inventoryMovementHtml(i,type){
  return `<h3>${type==="waste"?"Registrar merma":"Agregar stock"}</h3><div style="margin-bottom:12px;color:var(--dim)">${escapeHtml(i.name)} · ${escapeHtml(i.unit)} · stock actual ${Number(i.stock||0).toFixed(3)}</div><div class="field"><label>${type==="waste"?"Cantidad que mermó":"Cantidad recibida"}</label><input id="inv-move-qty" type="number" step="0.001" min="0.001" placeholder="Ej: 2.5"></div><div class="field"><label>Nota</label><textarea id="inv-move-note" rows="2" placeholder="Ej: producto dañado, compra semanal..."></textarea></div><div class="modal-actions"><button class="btn-ghost" id="cancel">Cancelar</button><button class="btn-primary" id="save">${type==="waste"?"Registrar merma":"Agregar stock"}</button></div>`;
}

/* ---------- CLIENTES ---------- */
function clientesView(){
  const items = cache.customers.filter(c=>!state.search || c.name.toLowerCase().includes(state.search.toLowerCase()) || (c.phone||"").includes(state.search));
  return `<div class="topbar"><h2>Clientes</h2><button class="btn-primary" id="newCust">+ Nuevo cliente</button></div>
  <div class="toolbar"><input id="pSearch" placeholder="Buscar por nombre o teléfono..." value="${state.search}"></div>
  <div class="panel"><table><thead><tr><th>Nombre</th><th>Teléfono</th><th>Dirección</th><th>Órdenes</th><th></th></tr></thead><tbody>
  ${items.map(c=>{ const n=cache.orders.filter(o=>o.customer_id===c.id).length;
    return `<tr><td>${c.name}</td><td>${c.phone||"—"}</td><td>${c.address||"—"}</td><td>${n}</td>
    <td style="text-align:right"><button class="btn-ghost btn-sm" data-edit-cust="${c.id}">Editar</button> <button class="btn-danger btn-sm" data-del-cust="${c.id}">Eliminar</button></td></tr>`;}).join("") || '<tr><td colspan="5" class="empty">No hay clientes</td></tr>'}
  </tbody></table></div>`;
}
function customerFormHtml(c){
  c = c || {id:"",name:"",phone:"",address:"",address_2:"",notes:""};
  return `<h3>${c.id?"Editar cliente":"Nuevo cliente"}</h3>
  <div class="field"><label>Nombre</label><input id="f-name" value="${c.name}"></div>
  <div class="field"><label>Teléfono</label><input id="f-phone" value="${c.phone||""}"></div>
  <div class="field"><label>Dirección principal</label><input id="f-addr" value="${c.address||""}"></div>
  <div class="field"><label>Segunda dirección (opcional)</label><input id="f-addr2" value="${c.address_2||""}"></div>
  <div class="field"><label>Notas</label><textarea id="f-notes" rows="2">${c.notes||""}</textarea></div>
  <div class="modal-actions"><button class="btn-ghost" id="cancel">Cancelar</button><button class="btn-primary" id="save">Guardar</button></div>`;
}

/* ---------- PROVEEDORES ---------- */
function proveedoresView(){
  const items = cache.providers.filter(p=>!state.search || p.name.toLowerCase().includes(state.search.toLowerCase()));
  return `<div class="topbar"><h2>Proveedores</h2><button class="btn-primary" id="newProv">+ Nuevo proveedor</button></div>
  <div class="toolbar"><input id="pSearch" placeholder="Buscar proveedor..." value="${state.search}"></div>
  <div class="panel"><table><thead><tr><th>Nombre</th><th>Teléfono</th><th>Contacto</th><th></th></tr></thead><tbody>
  ${items.map(p=>`<tr><td>${p.name}</td><td>${p.phone||"—"}</td><td>${p.contact||"—"}</td>
    <td style="text-align:right"><button class="btn-ghost btn-sm" data-edit-prov="${p.id}">Editar</button> <button class="btn-danger btn-sm" data-del-prov="${p.id}">Eliminar</button></td></tr>`).join("") || '<tr><td colspan="4" class="empty">No hay proveedores</td></tr>'}
  </tbody></table></div>`;
}
function providerFormHtml(p){
  p = p || {id:"",name:"",phone:"",contact:"",notes:""};
  return `<h3>${p.id?"Editar proveedor":"Nuevo proveedor"}</h3>
  <div class="field"><label>Nombre</label><input id="f-name" value="${p.name}"></div>
  <div class="row2"><div class="field"><label>Teléfono</label><input id="f-phone" value="${p.phone||""}"></div><div class="field"><label>Persona de contacto</label><input id="f-contact" value="${p.contact||""}"></div></div>
  <div class="field"><label>Notas</label><textarea id="f-notes" rows="2">${p.notes||""}</textarea></div>
  <div class="modal-actions"><button class="btn-ghost" id="cancel">Cancelar</button><button class="btn-primary" id="save">Guardar</button></div>`;
}

/* ---------- GASTOS ---------- */
const EXP_CATS = ["Ingredientes","Delivery","Servicios","Publicidad","Personal","Equipos","Mantenimiento","Empaques","Otros"];
function gastosView(){
  let items=cache.expenses.filter(e=>!state.search || (e.description||"").toLowerCase().includes(state.search.toLowerCase()) || (e.providers?.name||"").toLowerCase().includes(state.search.toLowerCase()));
  const period=financialSummary(state.financialPeriod||"day");
  items=items.filter(e=>inFinancialRange(e.expense_date,period.range));
  return `<div class="topbar"><h2>Ingresos y gastos</h2><div style="display:flex;gap:8px;flex-wrap:wrap"><select id="financialPeriod"><option value="day" ${state.financialPeriod==="day"?"selected":""}>Día</option><option value="weekend" ${state.financialPeriod==="weekend"?"selected":""}>Fin de semana</option><option value="month" ${state.financialPeriod==="month"?"selected":""}>Mes</option></select><button class="btn-primary" id="newExp">+ Nuevo gasto</button></div></div>
  <div class="cards" style="margin-bottom:16px"><div class="card"><div class="label">Ingresos</div><div class="val">${fmt$(period.sales)}</div></div><div class="card"><div class="label">Gastos</div><div class="val">${fmt$(period.expenses)}</div></div><div class="card"><div class="label">Balance</div><div class="val">${fmt$(period.balance)}</div></div></div>
  <div class="toolbar"><input id="pSearch" placeholder="Buscar por descripción o proveedor..." value="${escapeHtml(state.search)}"></div>
  <div class="panel"><table><thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Proveedor</th><th>Monto Bs</th><th>Tasa</th><th>USD</th><th></th></tr></thead><tbody>${items.map(e=>`<tr><td>${e.expense_date}</td><td>${escapeHtml(e.category)}</td><td>${escapeHtml(e.description)}</td><td>${e.providers?escapeHtml(e.providers.name):"—"}</td><td>Bs. ${Number(e.amount_bs||0).toLocaleString("es-VE",{minimumFractionDigits:2})}</td><td>${Number(e.exchange_rate||0).toLocaleString("es-VE",{minimumFractionDigits:2})}</td><td>${fmt$(e.amount)}</td><td style="text-align:right"><button class="btn-ghost btn-sm" data-edit-exp="${e.id}">Editar</button> <button class="btn-danger btn-sm" data-del-exp="${e.id}">Eliminar</button></td></tr>`).join("")||'<tr><td colspan="8" class="empty">No hay gastos en este período</td></tr>'}</tbody></table></div>`;
}
function expenseFormHtml(e){
  e = e || {id:"",expense_date:todayCaracas(),category:EXP_CATS[0],description:"",provider_id:"",amount:"",amount_bs:"",exchange_rate:cache.config.exchange_rate,notes:""};
  return `<h3>${e.id?"Editar gasto":"Nuevo gasto"}</h3>
  <div class="row2">
    <div class="field"><label>Fecha</label><input id="f-date" type="date" value="${e.expense_date}"></div>
    <div class="field"><label>Categoría</label><select id="f-cat">${EXP_CATS.map(c=>`<option ${e.category===c?"selected":""}>${c}</option>`).join("")}</select></div>
  </div>
  <div class="field"><label>¿En qué se gastó?</label><input id="f-desc" value="${e.description}" placeholder="Ej: compra de pollo, gas, empaques..."></div>
  <div class="row2">
  <div class="field"><label>Proveedor (opcional)</label><select id="f-provider"><option value="">Ninguno</option>${cache.providers.map(p=>`<option value="${p.id}" ${e.provider_id===p.id?"selected":""}>${p.name}</option>`).join("")}</select></div>
  <div class="field">
    <label>Monto gastado (Bs)</label>
    <input id="f-amount-bs" type="number" step="0.01" min="0.01" value="${e.amount_bs ?? ""}" placeholder="Ej: 8570">
  </div>
</div>

<div class="row2">
  <div class="field">
    <label>Tasa del momento (Bs/$)</label>
    <input id="f-rate" type="number" step="0.01" min="0.01" value="${e.exchange_rate ?? cache.config.exchange_rate}" placeholder="Ej: 857">
  </div>

  <div class="field">
    <label>Equivalente en USD</label>
    <input id="f-amount" type="number" step="0.01" value="${e.amount ? Number(e.amount).toFixed(2) : ""}" readonly style="opacity:.7">
  </div>
</div>
  <div class="field"><label>Notas</label><textarea id="f-notes" rows="2">${e.notes||""}</textarea></div>
  <div class="modal-actions"><button class="btn-ghost" id="cancel">Cancelar</button><button class="btn-primary" id="save">Guardar</button></div>`;
}

/* ---------- ORDENES ---------- */
function ordenesView(){

  let items = cache.orders;

  /* ---------- FILTRO DE ESTADO ---------- */

  if(state.filterStatus){
    items = items.filter(o =>
      o.status === state.filterStatus
    );
  }

  /* ---------- BÚSQUEDA ---------- */

  if(state.search){

    const search = state.search.toLowerCase().trim();

    items = items.filter(o => {

      const nombre = (
        o.customers?.name || ""
      ).toLowerCase();

      const telefono = (
        o.customers?.phone || ""
      ).toLowerCase();

      const numero = (
        "" + (o.order_number || "")
      ).toLowerCase();

      return (
        nombre.includes(search) ||
        telefono.includes(search) ||
        numero.includes(search)
      );

    });
  }

  /* ---------- FILTRO DE FECHA ---------- */

  const selectedDate =
    state.orderDateFilter || "";

  if(selectedDate){

    items = items.filter(o =>
      dateCaracas(o.order_date) === selectedDate
    );

  }

  /* ---------- RESUMEN ---------- */

  const totalVentas = items
    .filter(o => o.status !== "cancelada")
    .reduce(
      (s,o) => s + Number(o.total || 0),
      0
    );

  const totalOrdenes = items.length;

  const ordenesCompletadas = items.filter(
    o => o.status === "completada"
  ).length;

  const ordenesPendientes = items.filter(
    o =>
      ["pendiente","preparacion","lista","delivery"]
      .includes(o.status)
  ).length;

  return `

    <div class="topbar">

      <h2>Órdenes</h2>

      <button
        class="btn-primary"
        id="newOrder">
        + Nueva orden
      </button>

    </div>


    <!-- ============================= -->
    <!-- FILTROS -->
    <!-- ============================= -->

    <div
      class="toolbar"
      style="
        display:flex;
        gap:10px;
        flex-wrap:wrap;
      "
    >

      <input
        id="pSearch"
        placeholder="Buscar cliente, teléfono o # orden..."
        value="${escapeHtml(state.search || "")}"
        style="flex:1;min-width:220px"
      >


      <input
        id="orderDateFilter"
        type="date"
        value="${selectedDate}"
        title="Filtrar por fecha"
      >


      <select
        id="fStatus"
      >

        <option value="">
          Todos los estados
        </option>

        ${
          [
            "pendiente",
            "preparacion",
            "lista",
            "delivery",
            "completada",
            "cancelada"
          ]
          .map(s => `
            <option
              value="${s}"
              ${
                state.filterStatus === s
                  ? "selected"
                  : ""
              }
            >
              ${statusLabel(s)}
            </option>
          `)
          .join("")
        }

      </select>


      ${
        (state.search ||
         state.filterStatus ||
         selectedDate)

        ? `
          <button
            class="btn-ghost"
            id="clearOrderFilters"
          >
            Limpiar filtros
          </button>
        `
        : ""
      }

    </div>


    <!-- ============================= -->
    <!-- RESUMEN -->
    <!-- ============================= -->

    <div class="cards">

      <div class="card">

        <div class="label">
          Órdenes encontradas
        </div>

        <div class="val">
          ${totalOrdenes}
        </div>

      </div>


      <div class="card">

        <div class="label">
          Ventas
        </div>

        <div class="val">
          ${fmt$(totalVentas)}
        </div>

        <div class="sub">
          ${fmtBs(totalVentas)}
        </div>

      </div>


      <div class="card">

        <div class="label">
          Completadas
        </div>

        <div class="val">
          ${ordenesCompletadas}
        </div>

      </div>


      <div class="card">

        <div class="label">
          Pendientes
        </div>

        <div class="val">
          ${ordenesPendientes}
        </div>

      </div>

    </div>


    <!-- ============================= -->
    <!-- TABLA -->
    <!-- ============================= -->

    <div class="panel">

      <table>

        <thead>

          <tr>

            <th>#</th>

            <th>Cliente</th>

            <th>Teléfono</th>

            <th>Fecha</th>

            <th>Total</th>

            <th>Pago</th>

            <th>Estado</th>

            <th>Nota</th>

            <th></th>

          </tr>

        </thead>


        <tbody>

          ${
            items.map(o => `

              <tr>

                <!-- NÚMERO -->

                <td>
                  <b>
                    #${o.order_number}
                  </b>
                </td>


                <!-- CLIENTE -->

                <td>

                  ${
                    o.customers
                      ? escapeHtml(
                          o.customers.name
                        )
                      : "—"
                  }

                </td>


                <!-- TELÉFONO -->

                <td>

                  ${
                    o.customers?.phone
                      ? escapeHtml(
                          o.customers.phone
                        )
                      : "—"
                  }

                </td>


                <!-- FECHA -->

                <td>

                  ${fmtDate(o.order_date)}

                  <div
                    style="
                      color:var(--dim);
                      font-size:11px;
                      margin-top:2px;
                    "
                  >
                    ${fmtTime(o.order_date)}
                  </div>

                </td>


                <!-- TOTAL -->

                <td>

                  <b>
                    ${fmt$(o.total)}
                  </b>

                  <div
                    style="
                      color:var(--dim);
                      font-size:11px;
                      margin-top:2px;
                    "
                  >
                    ${fmtBs(o.total)}
                  </div>

                </td>


                <!-- PAGO -->

                <td>

                  ${
                    o.payment_method || "—"
                  }

                </td>


                <!-- ESTADO -->

                <td>

                  <select
                    data-status="${o.id}"
                    style="
                      width:auto;
                      padding:4px 8px;
                      font-size:12px;
                    "
                  >

                    ${
                      [
                        "pendiente",
                        "preparacion",
                        "lista",
                        "delivery",
                        "completada",
                        "cancelada"
                      ]
                      .map(s => `

                        <option
                          value="${s}"
                          ${
                            o.status === s
                              ? "selected"
                              : ""
                          }
                        >
                          ${statusLabel(s)}
                        </option>

                      `)
                      .join("")
                    }

                  </select>

                </td>


                <!-- NOTA -->

                <td>

                  ${
                    o.notes &&
                    o.notes.trim()

                    ? `
                      <span
                        title="${escapeHtml(
                          o.notes
                        )}"
                        style="
                          cursor:help;
                          font-size:16px;
                        "
                      >
                        📝
                      </span>
                    `

                    : `
                      <span
                        style="
                          color:var(--dim);
                        "
                      >
                        —
                      </span>
                    `
                  }

                </td>


                <!-- ACCIONES -->

                <td
                  style="
                    text-align:right;
                    white-space:nowrap;
                  "
                >

                  <button
                    class="btn-ghost btn-sm"
                    data-ticket="${o.id}"
                  >
                    Ticket
                  </button>

                </td>

              </tr>

            `).join("")

            ||

            `
              <tr>

                <td
                  colspan="9"
                  class="empty"
                >
                  No se encontraron órdenes
                </td>

              </tr>
            `
          }

        </tbody>

      </table>

    </div>

  `;
}

function orderBuilderHtml(){
  const term = (state.orderProdSearch||"").toLowerCase();
  const products = cache.products.filter(p=>p.available && (!term || p.name.toLowerCase().includes(term)));
  const customers = cache.customers;
  const zones = cache.zones.filter(z=>z.active!==false);

  const subtotal = state.orderCart.reduce((s,l)=>s+l.price*l.qty,0);
  const zone = zones.find(z=>z.id===state.orderZone) || {cost:0};
  const discount = state.orderDiscount||0;
  const total = subtotal + Number(zone.cost) - discount;

  const search = (state.orderCustomerSearch||"").toLowerCase().trim();

  let customerResults = customers.filter(c=>{
    const name = (c.name||"").toLowerCase();
    const phone = (c.phone||"").toLowerCase();
    const address = (c.address||"").toLowerCase();
    if(c.id===state.orderCustomer) return false;
    return !search || name.includes(search) || phone.includes(search) || address.includes(search);
  }).slice(0,8);

  const selectedCustomer = customers.find(c=>c.id===state.orderCustomer);

  return `<h3>Nueva orden</h3>

  <div class="ob-grid">
   <div>

    <div class="field">
      <label>Cliente</label>
      <input id="ob-cust-search" type="text" placeholder="🔎 Buscar cliente por nombre, teléfono o dirección..." value="${escapeHtml(state.orderCustomerSearch||"")}" autocomplete="off">
      <input type="hidden" id="ob-cust" value="${state.orderCustomer||""}">
      ${selectedCustomer ? `<div class="panel" style="margin-top:8px;padding:10px;border:1px solid var(--accent)"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><div><div style="font-weight:600">✓ ${escapeHtml(selectedCustomer.name)}</div><div style="font-size:12px;color:var(--dim)">${escapeHtml(selectedCustomer.phone||"Sin teléfono")}</div>${selectedCustomer.address?`<div style="font-size:12px;color:var(--dim);margin-top:3px">${escapeHtml(selectedCustomer.address)}</div>`:""}</div><button type="button" class="btn-ghost btn-sm" id="clearOrderCust">✕</button></div></div>`:""}
      <div id="orderCustomerResults" class="panel" style="margin-top:8px;padding:6px 12px;max-height:220px;overflow-y:auto">${customerResults.length?customerResults.map(c=>`<div class="prod-pick" data-select-order-cust="${c.id}" style="cursor:pointer"><span><b>${escapeHtml(c.name)}</b><span style="color:var(--dim);font-size:12px"> · ${escapeHtml(c.phone||"Sin teléfono")}</span>${c.address?`<div style="color:var(--dim);font-size:11px;margin-top:2px">${escapeHtml(c.address)}</div>`:""}</span><span style="color:var(--accent);font-weight:700;font-size:18px">›</span></div>`).join(""):`<div class="empty" style="padding:12px">No encontramos ese cliente.</div>`}</div>
      <button type="button" class="btn-ghost btn-sm" id="quickNewCustomer" style="margin-top:7px">+ Crear cliente rápidamente</button>
      ${state.quickCustomerOpen?`<div class="panel" style="margin-top:10px;padding:12px"><div style="font-weight:600;margin-bottom:10px">Nuevo cliente</div><div class="field"><label>Nombre</label><input id="qc-name" placeholder="Nombre del cliente"></div><div class="field"><label>Teléfono</label><input id="qc-phone" placeholder="0414-1234567"></div><div class="field"><label>Dirección</label><input id="qc-address" placeholder="Dirección de entrega"></div><div style="display:flex;gap:8px;margin-top:10px"><button type="button" class="btn-ghost btn-sm" id="cancelQuickCustomer">Cancelar</button><button type="button" class="btn-primary btn-sm" id="saveQuickCustomer">Guardar cliente</button></div></div>`:""}
    </div>

    <div class="field">
      <label>Productos</label>

      <input
        id="ob-prod-search"
        type="text"
        placeholder="🔎 Buscar platillo..."
        value="${escapeHtml(state.orderProdSearch||"")}"
        autocomplete="off"
        style="margin-bottom:8px"
      >

      <div class="panel" style="max-height:220px;overflow-y:auto;padding:6px 12px">
        ${products.map(p=>{ const inCart=state.orderCart.find(l=>l.productId===p.id); const rc=recipeCost(p.id); return `
          <div class="prod-pick" data-add="${p.id}" style="cursor:pointer">
            <span>
              ${escapeHtml(p.name)}
              <span style="color:var(--dim)">
                · ${fmt$(p.price)}
                ${p.stock!==null&&p.stock!==undefined ? ` · stock: ${p.stock}` : ""}${rc>0 ? ` · costo: ${fmt$(rc)}` : ""}
              </span>
              ${inCart ? `<b style="color:var(--accent)"> · ${inCart.qty} en carrito</b>` : ""}
            </span>

            <span style="color:var(--accent);font-weight:700;font-size:18px">+</span>
          </div>
        `; }).join("") || '<div class="empty">No hay platillos que coincidan</div>'}
      </div>
    </div>

    <div class="row2">

      <div class="field">
        <label>Zona de delivery</label>

        <select id="ob-zone">
          <option value="">Sin delivery</option>

          ${zones.map(z=>`
            <option
              value="${z.id}"
              ${state.orderZone===z.id?"selected":""}
            >
              ${escapeHtml(z.name)} — ${fmt$(z.cost)}
            </option>
          `).join("")}
        </select>
      </div>

      <div class="field">
        <label>Método de pago</label>

        <select id="ob-pay">
          ${["Efectivo","Pago móvil","Transferencia","Zelle","Divisas","Otro"]
            .map(m=>`<option>${m}</option>`).join("")}
        </select>
      </div>

    </div>

    <div class="field">
      <label>Descuento (USD, opcional)</label>
      <input
        id="ob-disc"
        type="number"
        step="0.01"
        value="${discount||""}"
      >
    </div>

    <div class="field">
      <label>Notas</label>
      <textarea
        id="ob-notes"
        rows="2"
      >${escapeHtml(state.orderNotes||"")}</textarea>
    </div>

   </div>

   <div>

    <div class="panel" style="padding:14px">

      <div style="color:var(--dim);font-size:13px;margin-bottom:8px">
        Carrito
      </div>

      ${state.orderCart.map((l,i)=>`
        <div class="cart-line">
          <span>${escapeHtml(l.name)}</span>

          <span class="qty-ctrl">
            <button data-dec="${i}">−</button>
            ${l.qty}
            <button data-inc="${i}">+</button>
            ${fmt$(l.price*l.qty)}
          </span>
        </div>
      `).join("") || `
        <div style="color:var(--dim);font-size:13px">
          Agrega productos del panel izquierdo
        </div>
      `}

      <div style="margin-top:12px">

        <div class="summary-line">
          <span>Subtotal</span>
          <span>${fmt$(subtotal)}</span>
        </div>

        <div class="summary-line">
          <span>Delivery</span>
          <span>${fmt$(zone.cost)}</span>
        </div>

        <div class="summary-line">
          <span>Descuento</span>
          <span>-${fmt$(discount)}</span>
        </div>

        <div class="summary-line total">
          <span>Total</span>
          <span>
            ${fmt$(total)}
            <span style="color:var(--dim);font-weight:400;font-size:13px">
              / ${fmtBs(total)}
            </span>
          </span>
        </div>

      </div>
    </div>

    <div class="modal-actions">
      <button class="btn-ghost" id="cancel">
        Cancelar
      </button>

      <button class="btn-primary" id="save-order">
        Guardar orden
      </button>
    </div>

   </div>
  </div>`;
}

/* ---------- CONFIG ---------- */
function configView(){
  const c = cache.config;
  return `<div class="topbar"><h2>Configuración</h2></div>
  <div class="panel" style="padding:20px;margin-bottom:18px">
    <div style="color:var(--dim);font-size:14px;margin-bottom:12px">Restaurante</div>
    <div class="row2"><div class="field"><label>Nombre</label><input id="c-name" value="${c.name||""}"></div><div class="field"><label>Teléfono</label><input id="c-phone" value="${c.phone||""}"></div></div>
    <div class="field"><label>Dirección</label><input id="c-addr" value="${c.address||""}"></div>
  </div>
  <div class="panel" style="padding:20px;margin-bottom:18px">
    <div style="color:var(--dim);font-size:14px;margin-bottom:12px">Moneda</div>
    <div class="field" style="max-width:220px"><label>Tasa (1 USD = ? Bs)</label><input id="c-rate" type="number" step="0.01" value="${c.exchange_rate}"></div>
    <div style="font-size:12px;color:var(--dim)">Las órdenes ya creadas guardan su propia tasa y no cambian.</div>
  </div>
  <div class="panel" style="padding:20px;margin-bottom:18px">
    <div style="color:var(--dim);font-size:14px;margin-bottom:12px">Apariencia</div>
    <div class="field"><label>Logo (pega el enlace de una imagen ya subida a internet — opcional)</label><input id="c-logo" value="${c.logo_url||""}" placeholder="https://..."></div>
    <div class="row2">
      <div class="field"><label>Color de fondo</label><input id="c-bg" type="color" value="${c.color_bg||'#1c1a17'}" style="padding:4px;height:42px"></div>
      <div class="field"><label>Color principal (botones)</label><input id="c-accent" type="color" value="${c.color_accent||'#e8a33d'}" style="padding:4px;height:42px"></div>
    </div>
  </div>
  <button class="btn-primary" id="saveConfig" style="margin-bottom:18px">Guardar configuración</button>
  <div class="panel" style="padding:20px">
    <div style="color:var(--dim);font-size:14px;margin-bottom:12px">Zonas de delivery</div>
    <div id="zonesList">${cache.zones.map(z=>`<div class="row2" style="margin-bottom:8px">
      <input data-zn="${z.id}" value="${z.name}">
      <div style="display:flex;gap:8px"><input data-zc="${z.id}" type="number" step="0.01" value="${z.cost}">
      <button class="btn-ghost btn-sm" data-save-zone="${z.id}">Guardar</button>
      <button class="btn-danger btn-sm" data-del-zone="${z.id}">Eliminar</button></div>
    </div>`).join("") || '<div class="empty">No hay zonas configuradas</div>'}</div>
    <button class="btn-ghost btn-sm" id="addZone">+ Agregar zona</button>
  </div>`;
}

/* ---------- MODALS ---------- */
function openModal(name){
  const wrap=document.createElement("div"); wrap.className="overlay"; wrap.id="overlay";
  const box=document.createElement("div"); box.className="modal";
  if(name==="prod") { box.style.maxWidth="760px"; box.innerHTML = productFormHtml(state.editingProd); }
  if(name==="cust") box.innerHTML = customerFormHtml(state.editingCust);
  if(name==="exp") box.innerHTML = expenseFormHtml(state.editingExp);
  if(name==="prov") box.innerHTML = providerFormHtml(state.editingProv);
  if(name==="inventory") box.innerHTML = inventoryFormHtml(state.editingInventory);
  if(name==="inventoryMove") box.innerHTML = inventoryMovementHtml(state.inventoryMoveItem,state.inventoryMoveType);
  if(name==="order"){ box.style.maxWidth="820px"; box.innerHTML = orderBuilderHtml(); }
  wrap.appendChild(box); document.body.appendChild(wrap);
  wrap.onclick = e=>{ if(e.target===wrap){ closeModal(); } };
  wireModal(name);
}
function closeModal(){ state.modal=null; const o=document.getElementById("overlay"); if(o) o.remove(); }

function busySave(btn, fn){
  return async ()=>{
    btn.disabled=true; const old=btn.textContent; btn.textContent="Guardando...";
    try{ await fn(); }
    catch(e){
      btn.disabled=false; btn.textContent=old;
      if(e && e.message==="__validation") return; // el mensaje específico ya se mostró
      toast(friendlyError(e), true);
    }
  };
}

function wireModal(name){
  const cancel=document.getElementById("cancel"); if(cancel) cancel.onclick=closeModal;
  const saveBtn=document.getElementById("save");
  if(name==="prod"){
    saveBtn.onclick = busySave(saveBtn, async ()=>{
      const stockRaw=document.getElementById("f-stock").value;
      const val={name:document.getElementById("f-name").value.trim(), category:document.getElementById("f-cat").value.trim(), price:parseFloat(document.getElementById("f-price").value)||0, stock:stockRaw===""?null:parseInt(stockRaw)||0, available:document.getElementById("f-avail").checked};
      if(!val.name){ toast("El nombre es obligatorio", true); throw new Error("__validation"); }
      if(val.price<0){ toast("El precio no puede ser negativo", true); throw new Error("__validation"); }
      if(state.editingProd){
        await Api.update("products", state.editingProd.id, val);
        await loadProducts();
        state.editingProd=cache.products.find(x=>x.id===state.editingProd.id);
        refreshProductModal();
        toast("Platillo guardado");
      }else{
        const created=await Api.insert("products", val);
        await loadProducts();
        state.editingProd=created;
        refreshProductModal();
        toast("Platillo creado. Ahora puedes agregar sus ingredientes.");
      }
    });
    const addIng=document.getElementById("addRecipeIngredient");
    if(addIng) addIng.onclick=async ()=>{
      const itemId=document.getElementById("ri-item").value;
      const qty=parseFloat(document.getElementById("ri-qty").value)||0;
      if(!itemId || qty<=0){ toast("Selecciona un ingrediente y coloca una cantidad válida", true); return; }
      try{
        const existing=cache.productIngredients.find(r=>r.product_id===state.editingProd.id && r.ingredient_id===itemId);
        if(existing) await Api.update("product_ingredients", existing.id, {quantity:qty});
        else await Api.insert("product_ingredients", {product_id:state.editingProd.id,ingredient_id:itemId,quantity:qty});
        await loadProductIngredients(); refreshProductModal(); toast("Ingrediente agregado a la receta");
      }catch(err){ toast(friendlyError(err), true); }
    };
  }
  if(name==="inventory"){
    const saveBtn=document.getElementById("save");
    if(saveBtn) saveBtn.onclick = busySave(saveBtn, async ()=>{
      const namev=document.getElementById("inv-name").value.trim();
      const unit=document.getElementById("inv-unit").value;
      const stock=parseFloat(document.getElementById("inv-stock").value)||0;
      const minStock=parseFloat(document.getElementById("inv-min").value)||0;
      const cost=parseFloat(document.getElementById("inv-cost").value)||0;
      const waste=parseFloat(document.getElementById("inv-waste").value)||0;
      const active=document.getElementById("inv-active").value==="true";
      if(!namev){ toast("El nombre es obligatorio", true); throw new Error("__validation"); }
      if(stock<0 || minStock<0 || cost<0 || waste<0 || waste>=100){ toast("Revisa stock, mínimo, costo y merma", true); throw new Error("__validation"); }
      const {error}=await sb.rpc("save_ingredient",{p_id:state.editingInventory?.id||null,p_name:namev,p_unit:unit,p_stock:stock,p_min_stock:minStock,p_cost:cost,p_merma_percent:waste,p_active:active});
      if(error) throw error;
      await loadInventory(); closeModal(); render(); toast("Ingrediente guardado");
    });
  }
  if(name==="inventoryMove"){
    const saveBtn=document.getElementById("save");
    if(saveBtn) saveBtn.onclick = busySave(saveBtn, async ()=>{
      const qty=parseFloat(document.getElementById("inv-move-qty").value)||0;
      const note=document.getElementById("inv-move-note").value.trim();
      if(qty<=0){ toast("Coloca una cantidad válida", true); throw new Error("__validation"); }
      const current=Number(state.inventoryMoveItem.stock||0);
      const delta=state.inventoryMoveType==="waste" ? -qty : qty;
      const next=current+delta;
      if(next<0){ toast("La merma no puede superar el stock actual", true); throw new Error("__validation"); }
      const {error}=await sb.rpc("adjust_ingredient",{p_ingredient_id:state.inventoryMoveItem.id,p_quantity_delta:delta,p_movement_type:state.inventoryMoveType==="waste"?"merma":"entrada",p_notes:note});
      if(error) throw error;
      await loadInventory(); closeModal(); render(); toast(state.inventoryMoveType==="waste"?"Merma registrada":"Stock agregado");
    });
  }
  if(name==="cust"){
    saveBtn.onclick = busySave(saveBtn, async ()=>{
      const val={name:document.getElementById("f-name").value.trim(), phone:document.getElementById("f-phone").value.trim(), address:document.getElementById("f-addr").value.trim(), address_2:document.getElementById("f-addr2").value.trim(), notes:document.getElementById("f-notes").value.trim()};
      if(!val.name){ toast("El nombre es obligatorio", true); throw new Error("__validation"); }
      if(state.editingCust) await Api.update("customers", state.editingCust.id, val); else await Api.insert("customers", val);
      await loadCustomers(); state.editingCust=null; closeModal(); render(); toast("Cliente guardado");
    });
  }
  if(name==="prov"){
    saveBtn.onclick = busySave(saveBtn, async ()=>{
      const val={name:document.getElementById("f-name").value.trim(), phone:document.getElementById("f-phone").value.trim(), contact:document.getElementById("f-contact").value.trim(), notes:document.getElementById("f-notes").value.trim()};
      if(!val.name){ toast("El nombre es obligatorio", true); throw new Error("__validation"); }
      if(state.editingProv) await Api.update("providers", state.editingProv.id, val); else await Api.insert("providers", val);
      await loadProviders(); state.editingProv=null; closeModal(); render(); toast("Proveedor guardado");
    });
  }
  if(name==="exp"){
    saveBtn.onclick = busySave(saveBtn, async ()=>{
      const provId=document.getElementById("f-provider").value;
const amountBs=parseFloat(document.getElementById("f-amount-bs").value)||0;
const exchangeRate=parseFloat(document.getElementById("f-rate").value)||0;
const amountUsd=exchangeRate>0 ? amountBs/exchangeRate : 0;

const val={
  expense_date:document.getElementById("f-date").value||todayCaracas(),
  category:document.getElementById("f-cat").value,
  description:document.getElementById("f-desc").value.trim(),
  provider_id:provId||null,
  amount:Number(amountUsd.toFixed(2)),
  amount_bs:Number(amountBs.toFixed(2)),
  exchange_rate:Number(exchangeRate.toFixed(4)),
  notes:document.getElementById("f-notes").value.trim()
};      if(!val.description){ toast("Describe en qué se gastó", true); throw new Error("__validation"); }
if(val.amount_bs<=0){
  toast("El monto en bolívares debe ser mayor a 0", true);
  throw new Error("__validation");
}

if(val.exchange_rate<=0){
  toast("La tasa debe ser mayor a 0", true);
  throw new Error("__validation");
}      if(state.editingExp) await Api.update("expenses", state.editingExp.id, val); else await Api.insert("expenses", val);
      await loadExpenses(); state.editingExp=null; closeModal(); render(); toast("Gasto guardado");
    });
  }
  if(name==="order"){
    document.getElementById("ob-zone").onchange=e=>{ state.orderZone=e.target.value; refreshOrderModal(); };
    document.getElementById("ob-disc").oninput=e=>{ state.orderDiscount=parseFloat(e.target.value)||0; };
    document.getElementById("ob-notes").oninput=e=>{ state.orderNotes=e.target.value; };
    const psEl=document.getElementById("ob-prod-search");
    if(psEl) psEl.oninput=e=>{
      state.orderProdSearch=e.target.value; const pos=e.target.selectionStart;
      refreshOrderModal();
      const el=document.getElementById("ob-prod-search"); if(el){ el.focus(); el.selectionStart=el.selectionEnd=pos; }
    };
    document.querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>{
      const p=cache.products.find(x=>x.id===b.dataset.add);
      const line=state.orderCart.find(l=>l.productId===p.id);
      if(line) line.qty++; else state.orderCart.push({productId:p.id,name:p.name,price:Number(p.price),qty:1});
      refreshOrderModal();
    });
    document.querySelectorAll("[data-dec]").forEach(b=>b.onclick=()=>{
      const i=parseInt(b.dataset.dec);
      state.orderCart[i].qty -= 1;
      if(state.orderCart[i].qty<=0) state.orderCart.splice(i,1);
      refreshOrderModal();
    });
    document.querySelectorAll("[data-inc]").forEach(b=>b.onclick=()=>{
      const i=parseInt(b.dataset.inc);
      state.orderCart[i].qty += 1;
      refreshOrderModal();
    });
    document.getElementById("save-order").onclick=saveOrder;
  }
}
function refreshProductModal(){ const box=document.querySelector(".modal"); if(box){ box.innerHTML=productFormHtml(state.editingProd); wireModal("prod"); } }
function refreshOrderModal(){ const box=document.querySelector(".modal"); box.innerHTML = orderBuilderHtml(); wireModal("order"); }

async function saveOrder(){
  const custId=document.getElementById("ob-cust").value;
  if(!custId){ toast("Selecciona un cliente", true); return; }
  if(state.orderCart.length===0){ toast("Agrega al menos un producto", true); return; }
  const btn=document.getElementById("save-order"); btn.disabled=true; btn.textContent="Guardando...";
  const zone=cache.zones.find(z=>z.id===state.orderZone);
  const payment=document.getElementById("ob-pay").value;
  const notes=document.getElementById("ob-notes").value;
  const discount=state.orderDiscount||0;
  try{
    const {data,error} = await sb.rpc("create_order",{
      p_customer_id:custId,
      p_items: state.orderCart.map(l=>({product_id:l.productId, quantity:l.qty})),
      p_delivery_zone_id: state.orderZone||null,
      p_discount: discount,
      p_payment_method: payment,
      p_notes: notes,
      p_exchange_rate: cache.config.exchange_rate
    });
    if(error) throw error;
    const created = Array.isArray(data)?data[0]:data;
    const cust=cache.customers.find(c=>c.id===custId);
    const subtotal=state.orderCart.reduce((s,l)=>s+l.price*l.qty,0);
    const ticketOrder = {
      number:created.order_number, date:fmtDate(new Date().toISOString()), time:fmtTime(new Date().toISOString()),
      customerName:cust?cust.name:"", customerPhone:cust?cust.phone:"", customerAddr:cust?cust.address:"",
      items:state.orderCart.slice(), subtotal, delivery: zone?Number(zone.cost):0, discount,
      total: subtotal+(zone?Number(zone.cost):0)-discount, payment, rate: cache.config.exchange_rate, notes
    };
    await Promise.all([loadOrdersAndItems(), loadProducts()]);
    state.orderCart=[]; state.orderCustomer=null; state.orderZone=""; state.orderDiscount=0; state.orderNotes="";
    closeModal(); render();
    showTicketPreview(ticketOrder);
    toast("Orden creada");
  }catch(e){ toast(friendlyError(e), true); btn.disabled=false; btn.textContent="Guardar orden"; }
}

/* ---------- TICKET ---------- */
function ticketHtml(o){
  const c=cache.config;
  const bs=n=>Math.round(n*o.rate).toLocaleString("es-VE");
  const hasNotes = o.notes && o.notes.trim();
  const notesBlock = hasNotes ? `
    <div class="c"><b>⚠️ NOTA PARA COCINA</b></div>
    <div style="white-space:pre-wrap;font-weight:bold;text-align:center;margin:4px 0">${escapeHtml(o.notes.trim())}</div><hr>` : "";
  return `<div class="c"><b>${c.name}</b><br>${c.phone||""}<br>${c.address||""}</div><hr>
    Orden #${o.number}<br>${o.date} ${o.time||""}<br>Cliente: ${o.customerName}<br>Tel: ${o.customerPhone||""}<br>${o.customerAddr?("Dir: "+o.customerAddr+"<br>"):""}<hr>
    ${o.items.map(l=>`<div class="row"><span>${l.qty}x ${l.name}</span><span>$${(l.price*l.qty).toFixed(2)}</span></div>`).join("")}<hr>${notesBlock}
    <div class="row"><span>Subtotal</span><span>$${o.subtotal.toFixed(2)}</span></div>
    <div class="row"><span>Delivery</span><span>$${o.delivery.toFixed(2)}</span></div>
    <div class="row"><span>Descuento</span><span>-$${o.discount.toFixed(2)}</span></div>
    <div class="row"><b>TOTAL</b><b>$${o.total.toFixed(2)}</b></div>
    <div class="row"><span></span><span>Bs. ${bs(o.total)}</span></div><hr>
    Pago: ${o.payment}<br>Tasa: 1$ = ${o.rate} Bs<hr>
    <div class="c">¡Gracias por tu compra!</div>`;
}
function doPrint(o){ document.getElementById("ticket").innerHTML = ticketHtml(o); setTimeout(()=>window.print(),80); }
function showTicketPreview(o){
  const wrap=document.createElement("div"); wrap.className="overlay"; wrap.id="overlay";
  const box=document.createElement("div"); box.className="modal"; box.style.maxWidth="320px";
  box.innerHTML = `<h3>Ticket de la orden #${o.number}</h3>
    <div class="ticket-preview" style="background:#fff;color:#000;padding:12px;border-radius:6px;font-family:monospace;font-size:12px">${ticketHtml(o)}</div>
    <div class="modal-actions"><button class="btn-ghost" id="cancel">Cerrar</button><button class="btn-primary" id="doPrint">🖨️ Imprimir (58mm)</button></div>`;
  wrap.appendChild(box); document.body.appendChild(wrap);
  wrap.onclick=e=>{ if(e.target===wrap){ wrap.remove(); } };
  document.getElementById("cancel").onclick=()=>wrap.remove();
  document.getElementById("doPrint").onclick=()=>doPrint(o);
}
async function openTicketForOrder(o){
  try{
    const {data,error}=await sb.from("order_items").select("*").eq("order_id",o.id);
    if(error) throw error;
    const items = data.map(it=>({name:it.product_name, price:Number(it.price), qty:it.quantity}));
    showTicketPreview({ number:o.order_number, date:fmtDate(o.order_date), time:fmtTime(o.order_date),
      customerName:o.customers?o.customers.name:"", customerPhone:o.customers?o.customers.phone:"", customerAddr:o.customers?o.customers.address:"",
      items, subtotal:Number(o.subtotal), delivery:Number(o.delivery_cost), discount:Number(o.discount), total:Number(o.total), payment:o.payment_method, rate:Number(o.exchange_rate), notes:o.notes });
  }catch(e){ toast(friendlyError(e), true); }
}

function refreshOrderCustomerResults(){
  const results=document.getElementById("orderCustomerResults");
  if(!results) return;
  const search=(state.orderCustomerSearch||"").toLowerCase().trim();
  const customers=cache.customers.filter(c=>{
    if(c.id===state.orderCustomer) return false;
    if(!search) return true;
    return (c.name||"").toLowerCase().includes(search) || (c.phone||"").toLowerCase().includes(search) || (c.address||"").toLowerCase().includes(search);
  }).slice(0,20);
  results.innerHTML=customers.length?customers.map(c=>`<div class="prod-pick" data-select-order-cust="${c.id}" style="cursor:pointer"><span><b>${escapeHtml(c.name)}</b><span style="color:var(--dim);font-size:12px"> · ${escapeHtml(c.phone||"Sin teléfono")}</span>${c.address?`<div style="color:var(--dim);font-size:11px;margin-top:2px">${escapeHtml(c.address)}</div>`:""}</span><span style="color:var(--accent);font-weight:700;font-size:18px">›</span></div>`).join(""):`<div class="empty" style="padding:12px">No encontramos ese cliente.</div>`;
}

/* ---------- EVENTOS GLOBALES ---------- */
document.addEventListener("click", async e=>{
  const t=e.target;
    /* ---------- CLIENTE RÁPIDO EN NUEVA ORDEN ---------- */

  if(t.closest("#quickNewCustomer")){
    state.quickCustomerOpen=true;
    refreshOrderModal();

    setTimeout(()=>{
      const el=document.getElementById("qc-name");
      if(el) el.focus();
    },50);

    return;
  }

  if(t.closest("#cancelQuickCustomer")){
    state.quickCustomerOpen=false;
    refreshOrderModal();
    return;
  }

  if(t.closest("#clearOrderCust")){
    state.orderCustomer=null;
    state.orderCustomerSearch="";
    refreshOrderModal();
    return;
  }

  if(t.dataset.selectOrderCust){
    const c=cache.customers.find(x=>x.id===t.dataset.selectOrderCust);

    if(c){
      state.orderCustomer=c.id;
      state.orderCustomerSearch=c.name;
      state.quickCustomerOpen=false;
      refreshOrderModal();
    }

    return;
  }

  if(t.id==="saveQuickCustomer"){
    const name=document.getElementById("qc-name").value.trim();
    const phone=document.getElementById("qc-phone").value.trim();
    const address=document.getElementById("qc-address").value.trim();

    if(!name){
      toast("El nombre del cliente es obligatorio", true);
      return;
    }

    t.disabled=true;
    t.textContent="Guardando...";

    try{
      const created=await Api.insert("customers",{
        name,
        phone,
        address,
        address_2:"",
        notes:""
      });

      await loadCustomers();

      state.orderCustomer=created.id;
      state.orderCustomerSearch=created.name;
      state.quickCustomerOpen=false;

      refreshOrderModal();

      toast("Cliente creado y seleccionado");
    }catch(err){
      toast(friendlyError(err), true);
      t.disabled=false;
      t.textContent="Guardar cliente";
    }

    return;
  }
    if(t.id==="clearOrderFilters"){

    state.search="";
    state.filterStatus="";
    state.orderDateFilter="";

    render();

    return;

  }
  if(t.id==="newInventory"){ state.editingInventory=null; state.modal="inventory"; render(); return; }
  if(t.dataset.editInv){ state.editingInventory=cache.inventory.find(i=>i.id===t.dataset.editInv); state.modal="inventory"; render(); return; }
  if(t.dataset.addStock){ state.inventoryMoveItem=cache.inventory.find(i=>i.id===t.dataset.addStock); state.inventoryMoveType="stock"; state.modal="inventoryMove"; render(); return; }
  if(t.dataset.wasteStock){ state.inventoryMoveItem=cache.inventory.find(i=>i.id===t.dataset.wasteStock); state.inventoryMoveType="waste"; state.modal="inventoryMove"; render(); return; }
  if(t.dataset.delRecipe){ if(confirm("¿Quitar este ingrediente de la receta?")){ try{ await Api.remove("product_ingredients",t.dataset.delRecipe); await loadProductIngredients(); refreshProductModal(); }catch(err){ toast(friendlyError(err),true); } } return; }

  if(t.id==="newProd"){ state.editingProd=null; state.modal="prod"; render(); }
  if(t.dataset.editProd){ state.editingProd=cache.products.find(p=>p.id===t.dataset.editProd); state.modal="prod"; render(); }
  if(t.dataset.delProd){ if(confirm("¿Eliminar este producto?")){ try{ await Api.remove("products", t.dataset.delProd); await loadProducts(); render(); }catch(e){ toast(friendlyError(e), true); } } }

  if(t.id==="newCust"){ state.editingCust=null; state.modal="cust"; render(); }
  if(t.dataset.editCust){ state.editingCust=cache.customers.find(c=>c.id===t.dataset.editCust); state.modal="cust"; render(); }
  if(t.dataset.delCust){ if(confirm("¿Eliminar este cliente?")){ try{ await Api.remove("customers", t.dataset.delCust); await loadCustomers(); render(); }catch(e){ toast(friendlyError(e), true); } } }

  if(t.id==="newProv"){ state.editingProv=null; state.modal="prov"; render(); }
  if(t.dataset.editProv){ state.editingProv=cache.providers.find(p=>p.id===t.dataset.editProv); state.modal="prov"; render(); }
  if(t.dataset.delProv){ if(confirm("¿Eliminar este proveedor?")){ try{ await Api.remove("providers", t.dataset.delProv); await loadProviders(); render(); }catch(e){ toast(friendlyError(e), true); } } }

  if(t.id==="newExp"){ state.editingExp=null; state.modal="exp"; render(); }
  if(t.id==="quickExpense"){ state.editingExp=null; state.modal="exp"; render(); }
  if(t.dataset.editExp){ state.editingExp=cache.expenses.find(x=>x.id===t.dataset.editExp); state.modal="exp"; render(); }
  if(t.dataset.delExp){ if(confirm("¿Eliminar este gasto?")){ try{ await Api.remove("expenses", t.dataset.delExp); await loadExpenses(); render(); }catch(e){ toast(friendlyError(e), true); } } }

  if(t.id==="newOrder"){ state.orderCart=[]; state.orderCustomer=null; state.orderCustomerSearch=""; state.quickCustomerOpen=false; state.orderZone=""; state.orderDiscount=0; state.orderNotes=""; state.orderProdSearch=""; state.modal="order"; render(); }
  if(t.dataset.ticket){ const o=cache.orders.find(x=>x.id===t.dataset.ticket); if(o) openTicketForOrder(o); }

  if(t.id==="saveConfig"){
    const val={name:document.getElementById("c-name").value, phone:document.getElementById("c-phone").value, address:document.getElementById("c-addr").value, exchange_rate:parseFloat(document.getElementById("c-rate").value)||cache.config.exchange_rate, logo_url:document.getElementById("c-logo").value.trim(), color_bg:document.getElementById("c-bg").value, color_accent:document.getElementById("c-accent").value};
    try{ await Api.update("config",1,val); await loadConfig(); render(); toast("Configuración guardada"); }catch(err){ toast(friendlyError(err), true); }
  }
  if(t.id==="addZone"){ try{ await Api.insert("delivery_zones",{name:"Nueva zona",cost:0,active:true}); await loadZones(); render(); }catch(err){ toast(friendlyError(err), true); } }
  if(t.dataset.saveZone){
    const id=t.dataset.saveZone;
    const name=document.querySelector(`[data-zn="${id}"]`).value;
    const cost=parseFloat(document.querySelector(`[data-zc="${id}"]`).value)||0;
    try{ await Api.update("delivery_zones", id, {name,cost}); await loadZones(); render(); toast("Zona guardada"); }catch(err){ toast(friendlyError(err), true); }
  }
  if(t.dataset.delZone){ if(confirm("¿Eliminar esta zona?")){ try{ await Api.remove("delivery_zones", t.dataset.delZone); await loadZones(); render(); }catch(err){ toast(friendlyError(err), true); } } }
});

document.addEventListener("change", async e=>{
  if(e.target.id==="financialPeriod"){ state.financialPeriod=e.target.value; render(); return; }
  if(e.target.id==="inventoryLowOnly"){ state.inventoryLowOnly=e.target.checked; render(); return; }


  /* ---------- CAMBIO DE ESTADO ---------- */

  if(e.target.dataset.status){

    const id = e.target.dataset.status;
    const val = e.target.value;

    e.target.disabled = true;

    try{

      await Api.update(
        "orders",
        id,
        {status:val}
      );

      await loadOrdersAndItems();

      render();

      toast("Estado actualizado");

    }catch(err){

      toast(
        friendlyError(err),
        true
      );

    }

  }


  /* ---------- FILTRO DE ESTADO ---------- */

  if(e.target.id === "inventoryLowOnly"){ state.inventoryLowOnly=e.target.checked; render(); }

  if(e.target.id === "fStatus"){

    state.filterStatus =
      e.target.value;

    render();

  }


  /* ---------- FILTRO DE FECHA ---------- */

  if(e.target.id === "orderDateFilter"){

    state.orderDateFilter =
      e.target.value;

    render();

  }

});
document.addEventListener("input", e=>{

  if(e.target.id==="inventorySearch"){
    state.inventorySearch=e.target.value;
    const pos=e.target.selectionStart;
    render();
    const el=document.getElementById("inventorySearch");
    if(el){ el.focus(); el.selectionStart=el.selectionEnd=pos; }
  }

  if(e.target.id==="pSearch"){
    state.search=e.target.value;

    const pos=e.target.selectionStart;

    render();

    const el=document.getElementById("pSearch");

    if(el){
      el.focus();
      el.selectionStart=el.selectionEnd=pos;
    }
  }

  if(e.target.id==="ob-cust-search"){
    state.orderCustomerSearch=e.target.value;
    refreshOrderCustomerResults();
  }

  if(e.target.id==="f-amount-bs" || e.target.id==="f-rate"){
    const bs=parseFloat(document.getElementById("f-amount-bs")?.value)||0;
    const rate=parseFloat(document.getElementById("f-rate")?.value)||0;
    const usd=rate>0 ? bs/rate : 0;

    const usdInput=document.getElementById("f-amount");
    if(usdInput){
      usdInput.value=usd>0 ? usd.toFixed(2) : "";
    }
  }
});

/* ---------- ARRANQUE ---------- */
if(sb){
  render();
  sb.auth.onAuthStateChange((_event, session)=>{
    state.user = session ? session.user : null;
    if(state.user){
      if(state.route==="login" || state.route==="loading") state.route="dashboard";
      initApp();
    } else {
      state.route="login"; render();
    }
  });
} else {
  showFatalError();
}
