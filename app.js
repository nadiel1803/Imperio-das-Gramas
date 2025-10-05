/**
 * app.js - Gerenciador Clientes / Produtos / Pedidos (com Firestore)
 * - Usa `window.initFirebase()` (definido em firebase.js) se o firebase estiver configurado
 * - NÃO usa Auth (assume DB aberto)
 * - Persistência local em localStorage como fallback / espelho
 *
 * Coloque este arquivo junto com index.html e firebase.js
 */

/////////////////////// CONFIG ///////////////////////
const PIN_CODE = "4901"; // editar se quiser
const LS_KEYS = {
  products: "gp_products_v1",
  clients: "gp_clients_v1",
  orders: "gp_orders_v1",
};

/////////////////////// ESTADO ///////////////////////
let products = [];
let clients = [];
let orders = [];
let selectedDate = null;
let formDirty = false;

// firebaseApi (populado por window.initFirebase())
let firebaseApi = null;
let firebaseUnsubs = { products: null, clients: null, orders: null };

/////////////////////// UTIL ///////////////////////
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function uid(prefix = "") { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
function moneyFormat(n){ return Number(n || 0).toFixed(2); }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function escapeHtml(s){ return String(s||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m])); }

/////////////////////// PERSISTÊNCIA LOCAL ///////////////////////
function loadAllLocal(){
  try{ products = JSON.parse(localStorage.getItem(LS_KEYS.products) || "[]"); } catch(e){ products = []; }
  try{ clients = JSON.parse(localStorage.getItem(LS_KEYS.clients) || "[]"); } catch(e){ clients = []; }
  try{ orders = JSON.parse(localStorage.getItem(LS_KEYS.orders) || "[]"); } catch(e){ orders = []; }
}
function saveAllLocal(){
  localStorage.setItem(LS_KEYS.products, JSON.stringify(products));
  localStorage.setItem(LS_KEYS.clients, JSON.stringify(clients));
  localStorage.setItem(LS_KEYS.orders, JSON.stringify(orders));
}

/////////////////////// DOM REFS ///////////////////////
const els = {
  pinModal: $("#pinModal"),
  pinInput: $("#pinInput"),
  pinSubmit: $("#pinSubmit"),
  pinError: $("#pinError"),

  openAddOrderBtn: $("#openAddOrderBtn"),
  openProductsBtn: $("#openProductsBtn"),
  openClientsBtn: $("#openClientsBtn"),
  sortDirection: $("#sortDirection"),
  ordersSearch: $("#ordersSearch"),

  ordersList: $("#ordersList"),
  ordersDayLabel: $("#ordersDayLabel"),
  orderCardTemplate: $("#orderCardTemplate"),

  gotoTodayBtn: $("#gotoTodayBtn"),
  prevDayBtn: $("#prevDayBtn"),
  nextDayBtn: $("#nextDayBtn"),
  calendar: $("#calendar"),
  currentDayLabel: $("#currentDayLabel"),

  orderModalBackdrop: $("#orderModalBackdrop"),
  orderForm: $("#orderForm"),
  orderDate: $("#orderDate"),
  orderTime: $("#orderTime"),
  orderClient: $("#orderClient"),
  addClientQuickBtn: $("#addClientQuickBtn"),
  orderItemsContainer: $("#orderItemsContainer"),
  openProductsFromOrderBtn: $("#openProductsFromOrderBtn"),
  addCustomItemBtn: $("#addCustomItemBtn"),
  paymentMethod: $("#paymentMethod"),
  orderTotal: $("#orderTotal"),
  orderPaid: $("#orderPaid"),
  orderId: $("#orderId"),
  saveOrderBtn: $("#saveOrderBtn"),
  cancelOrderBtn: $("#cancelOrderBtn"),
  deleteOrderBtn: $("#deleteOrderBtn"),

  productsModalBackdrop: $("#productsModalBackdrop"),
  productForm: $("#productForm"),
  productName: $("#productName"),
  productPrice: $("#productPrice"),
  productId: $("#productId"),
  productsList: $("#productsList"),
  cancelProductBtn: $("#cancelProductBtn"),

  clientsModalBackdrop: $("#clientsModalBackdrop"),
  clientForm: $("#clientForm"),
  clientName: $("#clientName"),
  clientPhone: $("#clientPhone"),
  clientId: $("#clientId"),
  clientsList: $("#clientsList"),
  cancelClientBtn: $("#cancelClientBtn"),

  showClientsListBtn: $("#showClientsListBtn"),
  showProductsListBtn: $("#showProductsListBtn"),

  emptyState: $("#emptyState"),
};

/////////////////////// INICIALIZAÇÃO ///////////////////////
function init(){
  loadAllLocal();
  bindAuth();   // PIN
  bindUI();
  renderCalendar();
  renderClientsOptions();
  renderProductsListUI();
  renderClientsListUI();
  renderOrdersList();
  selectedDate = todayISO();
  setSelectedDate(selectedDate);
  window.addEventListener("beforeunload", (e)=>{ if (formDirty){ e.preventDefault(); e.returnValue = ""; }});
}
window.addEventListener("load", init);

/////////////////////// AUTH (PIN) ///////////////////////
function bindAuth(){
  showPin(true);
  els.pinSubmit.addEventListener("click", tryPin);
  els.pinInput.addEventListener("keydown", ev => { if(ev.key === "Enter") tryPin(); });
  setTimeout(()=>els.pinInput.focus(), 300);
}
function showPin(show = true){
  if (show){ els.pinModal.setAttribute("aria-hidden","false"); els.pinModal.style.display = "flex"; }
  else { els.pinModal.setAttribute("aria-hidden","true"); els.pinModal.style.display = "none"; }
}

async function tryPin(){
  const v = (els.pinInput.value || "").trim();
  if (v === PIN_CODE){
    showPin(false);
    els.pinInput.value = "";
    els.pinError.hidden = true;

    // tenta inicializar firebase se disponível (window.initFirebase definida em firebase.js)
    if (window.initFirebase && typeof window.initFirebase === "function") {
      try {
        firebaseApi = await window.initFirebase(); // initFirebase já faz throw se config vazio
        console.log("Firebase inicializado via firebase.js — integrando listeners...");
        attachFirebaseListeners();
        // tenta sincronizar local -> remote se collections remotas vazias
        tryLocalToRemoteSync();
      } catch(err) {
        // se falhar, continua com localStorage sem quebrar
        console.warn("initFirebase falhou (seguindo com localStorage):", err);
        firebaseApi = null;
      }
    } else {
      console.log("firebase.js não encontrado ou initFirebase não disponível — usando localStorage.");
    }

  } else {
    els.pinError.hidden = false;
    els.pinError.textContent = "PIN incorreto — tenta de novo.";
    els.pinInput.value = ""; els.pinInput.focus();
  }
}

/////////////////////// FIRESTORE LISTENERS ///////////////////////
function attachFirebaseListeners(){
  if (!firebaseApi) return;

  // unsub anterior
  if (firebaseUnsubs.products) firebaseUnsubs.products();
  if (firebaseUnsubs.clients) firebaseUnsubs.clients();
  if (firebaseUnsubs.orders) firebaseUnsubs.orders();

  // products
  firebaseUnsubs.products = firebaseApi.onCollectionSnapshot("products", (err, docs) => {
    if (err){ console.warn("products snapshot error", err); return; }
    products = docs.map(d => ({ id: d.id, name: d.name, price: Number(d.price || 0) }));
    saveAllLocal();
    renderProductsListUI();
    renderClientsOptions();
    renderOrderItemsUI();
  });

  // clients
  firebaseUnsubs.clients = firebaseApi.onCollectionSnapshot("clients", (err, docs) => {
    if (err){ console.warn("clients snapshot error", err); return; }
    clients = docs.map(d => ({ id: d.id, name: d.name, phone: d.phone || "" }));
    saveAllLocal();
    renderClientsListUI();
    renderClientsOptions();
    renderOrdersList();
  });

  // orders
  firebaseUnsubs.orders = firebaseApi.onCollectionSnapshot("orders", (err, docs) => {
    if (err){ console.warn("orders snapshot error", err); return; }
    orders = docs.map(d => ({
      id: d.id,
      date: d.date || todayISO(),
      time: d.time || "",
      clientId: d.clientId || "",
      items: d.items || [],
      total: Number(d.total || 0),
      paid: !!d.paid
    }));
    saveAllLocal();
    renderOrdersList();
  });
}

/////////////////////// SYNC LOCAL -> REMOTE (ONE-TIME IF REMOTE EMPTY) ///////////////////////
async function tryLocalToRemoteSync(){
  if (!firebaseApi) return;
  try {
    const remoteProds = await firebaseApi.getAll("products");
    const remoteClients = await firebaseApi.getAll("clients");
    const remoteOrders = await firebaseApi.getAll("orders");

    // products
    if ((!remoteProds || remoteProds.length === 0) && products && products.length > 0) {
      for (const p of products) {
        // remove id local (server generates id)
        const payload = { name: p.name, price: Number(p.price || 0) };
        try { await firebaseApi.add("products", payload); } catch(e){ console.warn("sync product fail", e); }
      }
    }

    // clients
    if ((!remoteClients || remoteClients.length === 0) && clients && clients.length > 0) {
      for (const c of clients) {
        const payload = { name: c.name, phone: c.phone || "" };
        try { await firebaseApi.add("clients", payload); } catch(e){ console.warn("sync client fail", e); }
      }
    }

    // orders
    if ((!remoteOrders || remoteOrders.length === 0) && orders && orders.length > 0) {
      for (const o of orders) {
        const payload = {
          date: o.date || todayISO(),
          time: o.time || "",
          clientId: o.clientId || "",
          items: o.items || [],
          total: Number(o.total || 0),
          paid: !!o.paid,
          createdAt: new Date().toISOString()
        };
        try { await firebaseApi.add("orders", payload); } catch(e){ console.warn("sync order fail", e); }
      }
    }

  } catch(e){ console.warn("tryLocalToRemoteSync error", e); }
}

/////////////////////// UI BINDINGS ///////////////////////
function bindUI(){
  els.openAddOrderBtn.addEventListener("click", () => openOrderModalForCreate());
  els.openProductsBtn.addEventListener("click", () => toggleModal(els.productsModalBackdrop, true));
  els.openClientsBtn.addEventListener("click", () => toggleModal(els.clientsModalBackdrop, true));

  els.gotoTodayBtn.addEventListener("click", () => setSelectedDate(todayISO()));
  els.prevDayBtn.addEventListener("click", () => changeSelectedDate(-1));
  els.nextDayBtn.addEventListener("click", () => changeSelectedDate(1));

  els.sortDirection && els.sortDirection.addEventListener("change", renderOrdersList);
  els.ordersSearch && els.ordersSearch.addEventListener("input", renderOrdersList);

  els.openProductsFromOrderBtn.addEventListener("click", () => toggleModal(els.productsModalBackdrop, true));
  els.addCustomItemBtn.addEventListener("click", addCustomItemToOrderUI);
  els.addClientQuickBtn.addEventListener("click", () => toggleModal(els.clientsModalBackdrop, true));
  els.cancelOrderBtn.addEventListener("click", () => closeOrderModalWithCheck());
  els.orderForm.addEventListener("input", () => { formDirty = true; });
  els.orderForm.addEventListener("submit", (e) => { e.preventDefault(); saveOrderFromForm(); });

  els.productForm.addEventListener("submit", (e)=>{ e.preventDefault(); saveProductFromForm(); });
  els.cancelProductBtn.addEventListener("click", ()=> closeProductsModal());

  els.clientForm.addEventListener("submit", (e)=>{ e.preventDefault(); saveClientFromForm(); });
  els.cancelClientBtn.addEventListener("click", ()=> closeClientsModal());

  els.showClientsListBtn && els.showClientsListBtn.addEventListener("click", ()=> { toggleModal(els.clientsModalBackdrop, true); });
  els.showProductsListBtn && els.showProductsListBtn.addEventListener("click", ()=> { toggleModal(els.productsModalBackdrop, true); });
}

/////////////////////// MODAIS ///////////////////////
function toggleModal(modalEl, show = true){
  if (!modalEl) return;
  if (show){ modalEl.hidden = false; modalEl.style.display = "flex"; }
  else { modalEl.hidden = true; modalEl.style.display = "none"; }
}
function closeOrderModalWithCheck(){
  if (formDirty){
    if (!confirm("Existem alterações não salvas. Tem certeza que quer fechar?")) return;
  }
  closeOrderModal();
}
function closeOrderModal(){
  toggleModal(els.orderModalBackdrop, false);
  resetOrderForm();
  formDirty = false;
  els.deleteOrderBtn.hidden = true;
}
function resetOrderForm(){
  els.orderForm.reset();
  els.orderItemsContainer.innerHTML = "";
  els.orderTotal.value = "0.00";
  els.orderId.value = "";
}

/////////////////////// RENDER UI ///////////////////////
function renderProductsListUI(){
  els.productsList.innerHTML = "";
  if (!products.length){
    els.productsList.innerHTML = `<div class="list-item">Nenhum produto cadastrado.</div>`;
    return;
  }
  products.forEach(p=>{
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
      <div>
        <div style="font-weight:600">${escapeHtml(p.name)}</div>
        <div style="font-size:0.85rem;color:var(--muted)">R$ ${moneyFormat(p.price)}</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn ghost edit-product" data-id="${p.id}">Editar</button>
        <button class="btn ghost delete-product" data-id="${p.id}">Excluir</button>
      </div>
    `;
    els.productsList.appendChild(div);
  });
  Array.from(els.productsList.querySelectorAll(".edit-product")).forEach(b => b.addEventListener("click", ev=>{
    openProductForEdit(ev.currentTarget.dataset.id);
  }));
  Array.from(els.productsList.querySelectorAll(".delete-product")).forEach(b => b.addEventListener("click", ev=>{
    const id = ev.currentTarget.dataset.id;
    if (!confirm("Excluir produto? Pedidos existentes manterão os dados antigos.")) return;
    // delete locally
    products = products.filter(x => x.id !== id);
    saveAllLocal();
    // delete remotely
    if (firebaseApi) firebaseApi.delete("products", id).catch(e => console.warn("firebase delete product", e));
    renderProductsListUI();
    renderOrderItemsUI();
    renderOrdersList();
  }));
}

function renderClientsListUI(){
  els.clientsList.innerHTML = "";
  if (!clients.length){
    els.clientsList.innerHTML = `<div class="list-item">Nenhum cliente cadastrado.</div>`;
    return;
  }
  clients.forEach(c=>{
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
      <div>
        <div style="font-weight:600">${escapeHtml(c.name)}</div>
        <div style="font-size:0.85rem;color:var(--muted)">${escapeHtml(c.phone)}</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn ghost edit-client" data-id="${c.id}">Editar</button>
        <button class="btn ghost delete-client" data-id="${c.id}">Excluir</button>
      </div>
    `;
    els.clientsList.appendChild(div);
  });
  Array.from(els.clientsList.querySelectorAll(".edit-client")).forEach(b => b.addEventListener("click", ev=>{
    openClientForEdit(ev.currentTarget.dataset.id);
  }));
  Array.from(els.clientsList.querySelectorAll(".delete-client")).forEach(b => b.addEventListener("click", ev=>{
    const id = ev.currentTarget.dataset.id;
    if (!confirm("Excluir cliente? Pedidos existentes manterão os dados antigos.")) return;
    clients = clients.filter(x => x.id !== id);
    saveAllLocal();
    if (firebaseApi) firebaseApi.delete("clients", id).catch(e=>console.warn("firebase delete client", e));
    renderClientsListUI();
    renderClientsOptions();
    renderOrdersList();
  }));
}

function renderClientsOptions(){
  // dropdown no modal de pedido
  if (!els.orderClient) return;
  els.orderClient.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "-- selecionar cliente --";
  els.orderClient.appendChild(placeholder);
  clients.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = `${c.name}${c.phone ? " — " + c.phone : ""}`;
    els.orderClient.appendChild(opt);
  });
}

function renderOrdersList(){
  els.ordersList.innerHTML = "";
  const q = (els.ordersSearch && els.ordersSearch.value || "").toLowerCase().trim();
  const sortDir = (els.sortDirection && els.sortDirection.value) || "desc";

  let filtered = orders.slice();

  // filtrar por data selecionada
  if (selectedDate) filtered = filtered.filter(o => (o.date || todayISO()) === selectedDate);

  // busca livre (cliente nome, telefone, itens)
  if (q){
    filtered = filtered.filter(o => {
      const client = clients.find(c=>c.id === o.clientId) || {};
      const clientName = (client.name||"").toLowerCase();
      const clientPhone = (client.phone||"").toLowerCase();
      const itemsText = (o.items||[]).map(it => (it.name||"")).join(" ").toLowerCase();
      return clientName.includes(q) || clientPhone.includes(q) || itemsText.includes(q) || String(o.total||"").includes(q);
    });
  }

  // ordenar
  filtered.sort((a,b)=>{
    const ka = `${a.date} ${a.time||""}`;
    const kb = `${b.date} ${b.time||""}`;
    if (sortDir === "asc") return ka.localeCompare(kb);
    return kb.localeCompare(ka);
  });

  if (!filtered.length){
    els.emptyState.hidden = false;
    return;
  } else {
    els.emptyState.hidden = true;
  }

  filtered.forEach(o=>{
    const template = document.importNode(document.getElementById("orderCardTemplate").content, true);
    const article = template.querySelector(".order-card");
    article.dataset.orderId = o.id;
    template.querySelector(".order-time").textContent = `${o.time || "--:--"}`;
    const client = clients.find(c=>c.id === o.clientId) || { name: "Cliente não encontrado", phone: "" };
    template.querySelector(".order-client").textContent = client.name || "—";
    template.querySelector(".order-items-count").textContent = `${(o.items||[]).length} itens`;
    template.querySelector(".order-phone").textContent = client.phone || "";
    template.querySelector(".order-value").textContent = moneyFormat(o.total || 0);

    const editBtn = template.querySelector(".edit-order-btn");
    const delBtn = template.querySelector(".delete-order-btn");
    editBtn.addEventListener("click", ()=> openOrderForEdit(o.id));
    delBtn.addEventListener("click", ()=> {
      if (!confirm("Excluir pedido?")) return;
      // delete local
      orders = orders.filter(x => x.id !== o.id);
      saveAllLocal();
      // delete remote
      if (firebaseApi) firebaseApi.delete("orders", o.id).catch(e=>console.warn("firebase delete order", e));
      renderOrdersList();
    });

    els.ordersList.appendChild(template);
  });
}

/////////////////////// CALENDÁRIO SIMPLES ///////////////////////
function renderCalendar(){
  if (!els.calendar) return;
  els.calendar.innerHTML = `<div style="font-size:0.95rem;color:var(--muted)">Seleciona o dia acima — use os botões</div>`;
}
function setSelectedDate(d){
  selectedDate = d;
  if (els.ordersDayLabel) els.ordersDayLabel.textContent = d;
  renderOrdersList();
}
function changeSelectedDate(days){
  const dt = new Date(selectedDate || todayISO());
  dt.setDate(dt.getDate() + days);
  setSelectedDate(dt.toISOString().slice(0,10));
}

/////////////////////// PEDIDOS: UI DO FORM ///////////////////////
function openOrderModalForCreate(){
  resetOrderForm();
  els.orderDate.value = selectedDate || todayISO();
  toggleModal(els.orderModalBackdrop, true);
  els.deleteOrderBtn.hidden = true;
}
function openOrderForEdit(orderId){
  const o = orders.find(x=>x.id === orderId);
  if (!o) return alert("Pedido não encontrado.");
  toggleModal(els.orderModalBackdrop, true);
  els.orderId.value = o.id;
  els.orderDate.value = o.date || todayISO();
  els.orderTime.value = o.time || "";
  els.orderClient.value = o.clientId || "";
  els.paymentMethod.value = o.paymentMethod || "dinheiro";
  els.orderPaid.checked = !!o.paid;
  els.orderItemsContainer.innerHTML = "";
  (o.items||[]).forEach(it => addItemRowToOrderUI(it));
  calculateOrderTotal();
  els.deleteOrderBtn.hidden = false;
  // bind delete button
  els.deleteOrderBtn.onclick = () => {
    if (!confirm("Excluir pedido?")) return;
    // local
    orders = orders.filter(x=>x.id !== o.id);
    saveAllLocal();
    // remote
    if (firebaseApi) firebaseApi.delete("orders", o.id).catch(e=>console.warn("firebase delete order", e));
    closeOrderModal();
    renderOrdersList();
  };
}

function addCustomItemToOrderUI(){
  const custom = { id: uid("item_"), name: "Item personalizado", qty: 1, price: 0 };
  addItemRowToOrderUI(custom, true);
}
function addItemRowToOrderUI(item, focusPrice=false){
  const row = document.createElement("div");
  row.className = "order-item-row";
  row.style.display = "flex";
  row.style.gap = "8px";
  row.style.alignItems = "center";
  row.style.marginBottom = "8px";

  const name = document.createElement("input");
  name.value = item.name || "";
  name.placeholder = "Nome do item";
  name.style.flex = "1";

  const qty = document.createElement("input");
  qty.type = "number";
  qty.value = item.qty || 1;
  qty.style.width = "80px";

  const price = document.createElement("input");
  price.type = "number";
  price.step = "0.01";
  price.value = moneyFormat(item.price || 0);
  price.style.width = "110px";

  const remove = document.createElement("button");
  remove.className = "btn ghost small";
  remove.type = "button";
  remove.textContent = "Remover";

  remove.addEventListener("click", ()=> {
    row.remove();
    calculateOrderTotal();
  });

  [name, qty, price].forEach(inp => inp.addEventListener("input", ()=> calculateOrderTotal()));

  row.appendChild(name); row.appendChild(qty); row.appendChild(price); row.appendChild(remove);
  els.orderItemsContainer.appendChild(row);
  if (focusPrice) price.focus();
}

function calculateOrderTotal(){
  const rows = Array.from(els.orderItemsContainer.children || []);
  let total = 0;
  const items = [];
  rows.forEach(r => {
    const inputs = r.querySelectorAll("input");
    const nm = inputs[0].value || "";
    const q = Number(inputs[1].value || 0);
    const p = Number(inputs[2].value || 0);
    total += q * p;
    items.push({ id: uid("item_"), name: nm, qty: q, price: p });
  });
  els.orderTotal.value = moneyFormat(total);
  return { total, items };
}

/////////////////////// SALVAR / EDITAR PEDIDO ///////////////////////
async function saveOrderFromForm(){
  const date = els.orderDate.value || todayISO();
  const time = els.orderTime.value || "";
  const clientId = els.orderClient.value || "";
  const paymentMethod = els.paymentMethod.value || "dinheiro";
  const paid = !!els.orderPaid.checked;
  const orderId = els.orderId.value || uid("order_");

  const calc = calculateOrderTotal();
  const total = Number(calc.total || 0);
  const items = calc.items;

  const payload = { date, time, clientId, paymentMethod, paid, total, items, updatedAt: new Date().toISOString() };

  // grava local
  const idx = orders.findIndex(o => o.id === orderId);
  if (idx >= 0) {
    orders[idx] = { id: orderId, ...payload };
  } else {
    orders.push({ id: orderId, ...payload });
  }
  saveAllLocal();

  // grava remoto (Firestore) se disponível
  try {
    if (firebaseApi) {
      // se o doc já existe no remote com mesmo id, fazemos set; caso contrário, usamos set (overwrite)
      await firebaseApi.set("orders", orderId, { ...payload, createdAt: new Date().toISOString() });
    }
  } catch(e) {
    console.warn("firebase save order failed:", e);
  }

  closeOrderModal();
  renderOrdersList();
  formDirty = false;
}

/////////////////////// PRODUTOS CRUD ///////////////////////
function openProductForEdit(id){
  const p = products.find(x => x.id === id); if(!p) return;
  els.productName.value = p.name; els.productPrice.value = p.price; els.productId.value = p.id;
  toggleModal(els.productsModalBackdrop, true);
}
function closeProductsModal(){ toggleModal(els.productsModalBackdrop, false); els.productForm.reset(); els.productId.value = ""; }

async function saveProductFromForm(){
  const name = (els.productName.value || "").trim();
  const price = Number(els.productPrice.value || 0);
  // if (!name) return alert("Preencha um nome válido.");
  const id = els.productId.value || uid("prod_");
  const obj = { id, name, price };

  const idx = products.findIndex(p => p.id === id);
  if (idx >= 0) products[idx] = obj; else products.push(obj);
  saveAllLocal();

  // remoto
  try {
    if (firebaseApi) {
      await firebaseApi.set("products", id, { name, price });
    }
  } catch(e){ console.warn("firebase save product failed", e); }

  renderProductsListUI();
  renderClientsOptions();
  toggleModal(els.productsModalBackdrop, false);
  els.productForm.reset();
  els.productId.value = "";
  renderOrderItemsUI();
}

/////////////////////// CLIENTES CRUD ///////////////////////
function openClientForEdit(id){
  const c = clients.find(x=>x.id === id); if(!c) return;
  els.clientName.value = c.name; els.clientPhone.value = c.phone; els.clientId.value = c.id;
  toggleModal(els.clientsModalBackdrop, true);
}
function closeClientsModal(){ toggleModal(els.clientsModalBackdrop, false); els.clientForm.reset(); els.clientId.value = ""; }

async function saveClientFromForm(){
  const name = (els.clientName.value || "").trim();
  const phone = (els.clientPhone.value || "").trim();
  if (!name) return alert("Preencha o nome do cliente.");
  const id = els.clientId.value || uid("cli_");
  const obj = { id, name, phone };

  const idx = clients.findIndex(c => c.id === id);
  if (idx >= 0) clients[idx] = obj; else clients.push(obj);
  saveAllLocal();

  // remoto
  try {
    if (firebaseApi) {
      await firebaseApi.set("clients", id, { name, phone });
    }
  } catch(e){ console.warn("firebase save client failed", e); }

  renderClientsListUI();
  renderClientsOptions();
  toggleModal(els.clientsModalBackdrop, false);
  els.clientForm.reset();
  els.clientId.value = "";
  renderOrdersList();
}

/////////////////////// OUTRAS HELPERS ///////////////////////
function renderOrderItemsUI(){
  // Atualiza UI caso algum produto tenha mudado (não implementa seleção avançada aqui)
  // Foi mantido placeholder pra futuras melhorias
}

/////////////////////// FINAL SETUP ///////////////////////
bindUI(); // liga listeners estáticos

// agora export (opcional)
window.APP = {
  reloadLocal: () => { loadAllLocal(); renderProductsListUI(); renderClientsListUI(); renderOrdersList(); },
  firebaseStatus: () => !!firebaseApi
};
