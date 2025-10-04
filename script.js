/*******************************
 * app.js
 * Gerenciador de Pedidos - principal
 * - PIN de acesso
 * - CRUD Produtos / Clientes / Pedidos
 * - Calendário interativo (filtra por data)
 * - Ordenação por horário (asc/desc)
 * - Proteção contra perda de dados (beforeunload + confirmações)
 *
 * ALTERE AQUI: PIN de 4 dígitos:
 *******************************/
const PIN_CODE = "4901"; // <<-- muda aqui pro PIN que quiser (4 dígitos)

/* ------------------------
   Keys do localStorage
   ------------------------ */
const LS_KEYS = {
  products: "gp_products_v1",
  clients: "gp_clients_v1",
  orders: "gp_orders_v1",
};

/* ------------------------
   Estado em memória
   ------------------------ */
let products = [];
let clients = [];
let orders = []; // cada order: { id, date (YYYY-MM-DD), time (HH:MM), items: [{id,name,price,qty}], clientId, clientName, clientPhone, paymentMethod, total, paid }
let selectedDate = todayISO();
let formDirty = false;

/* ------------------------
   Utilitários
   ------------------------ */
function uid(prefix = "") {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function moneyFormat(n) {
  return Number(n || 0).toFixed(2);
}
function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/* ------------------------
   Carregamento / Persistência
   ------------------------ */
function loadAll() {
  try {
    products = JSON.parse(localStorage.getItem(LS_KEYS.products) || "[]");
  } catch (e) { products = []; }

  try {
    clients = JSON.parse(localStorage.getItem(LS_KEYS.clients) || "[]");
  } catch (e) { clients = []; }

  try {
    orders = JSON.parse(localStorage.getItem(LS_KEYS.orders) || "[]");
  } catch (e) { orders = []; }
}

function saveAll() {
  localStorage.setItem(LS_KEYS.products, JSON.stringify(products));
  localStorage.setItem(LS_KEYS.clients, JSON.stringify(clients));
  localStorage.setItem(LS_KEYS.orders, JSON.stringify(orders));
  // optional: try to push to firebase if available
  if (window.firebaseSync && typeof window.firebaseSync === "function") {
    try { window.firebaseSync({ products, clients, orders }); } catch(e){ console.warn("Firebase sync failed:", e); }
  }
}

/* ------------------------
   DOM references
   ------------------------ */
const els = {
  pinModal: document.getElementById("pinModal"),
  pinInput: document.getElementById("pinInput"),
  pinSubmit: document.getElementById("pinSubmit"),
  pinError: document.getElementById("pinError"),

  openAddOrderBtn: document.getElementById("openAddOrderBtn"),
  openProductsBtn: document.getElementById("openProductsBtn"),
  openClientsBtn: document.getElementById("openClientsBtn"),
  sortDirection: document.getElementById("sortDirection"),
  ordersSearch: document.getElementById("ordersSearch"),

  ordersList: document.getElementById("ordersList"),
  ordersDayLabel: document.getElementById("ordersDayLabel"),
  ordersTitle: document.getElementById("ordersTitle"),
  orderCardTemplate: document.getElementById("orderCardTemplate"),

  gotoTodayBtn: document.getElementById("gotoTodayBtn"),
  prevDayBtn: document.getElementById("prevDayBtn"),
  nextDayBtn: document.getElementById("nextDayBtn"),
  calendar: document.getElementById("calendar"),
  currentDayLabel: document.getElementById("currentDayLabel"),

  orderModalBackdrop: document.getElementById("orderModalBackdrop"),
  orderForm: document.getElementById("orderForm"),
  orderDate: document.getElementById("orderDate"),
  orderTime: document.getElementById("orderTime"),
  orderClient: document.getElementById("orderClient"),
  addClientQuickBtn: document.getElementById("addClientQuickBtn"),
  orderItemsContainer: document.getElementById("orderItemsContainer"),
  openProductsFromOrderBtn: document.getElementById("openProductsFromOrderBtn"),
  addCustomItemBtn: document.getElementById("addCustomItemBtn"),
  paymentMethod: document.getElementById("paymentMethod"),
  orderTotal: document.getElementById("orderTotal"),
  orderPaid: document.getElementById("orderPaid"),
  orderId: document.getElementById("orderId"),
  saveOrderBtn: document.getElementById("saveOrderBtn"),
  cancelOrderBtn: document.getElementById("cancelOrderBtn"),
  deleteOrderBtn: document.getElementById("deleteOrderBtn"),

  productsModalBackdrop: document.getElementById("productsModalBackdrop"),
  productForm: document.getElementById("productForm"),
  productName: document.getElementById("productName"),
  productPrice: document.getElementById("productPrice"),
  productId: document.getElementById("productId"),
  productsList: document.getElementById("productsList"),
  cancelProductBtn: document.getElementById("cancelProductBtn"),

  clientsModalBackdrop: document.getElementById("clientsModalBackdrop"),
  clientForm: document.getElementById("clientForm"),
  clientName: document.getElementById("clientName"),
  clientPhone: document.getElementById("clientPhone"),
  clientId: document.getElementById("clientId"),
  clientsList: document.getElementById("clientsList"),
  cancelClientBtn: document.getElementById("cancelClientBtn"),

  emptyState: document.getElementById("emptyState"),
};

/* ------------------------
   Inicialização UI e eventos
   ------------------------ */
function init() {
  loadAll();
  bindAuth();
  bindUI();
  renderCalendar();
  renderClientsOptions();
  renderProductsListUI();
  renderClientsListUI();
  renderOrdersList();
  updateCurrentLabels();
  // always start showing today's date
  selectedDate = todayISO();
  setSelectedDate(selectedDate);
  // protect from accidental leave if form dirty
  window.addEventListener("beforeunload", (e) => {
    if (formDirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
}

/* ------------------------
   AUTH (PIN)
   ------------------------ */
function bindAuth() {
  // show PIN overlay
  showPin(true);
  els.pinSubmit.addEventListener("click", tryPin);
  els.pinInput.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") tryPin();
  });
  // focus
  setTimeout(()=>els.pinInput.focus(), 300);
}

function showPin(show = true) {
  if (show) {
    els.pinModal.setAttribute("aria-hidden", "false");
    els.pinModal.style.display = "flex";
  } else {
    els.pinModal.setAttribute("aria-hidden", "true");
    els.pinModal.style.display = "none";
  }
}

function tryPin() {
  const val = (els.pinInput.value || "").trim();
  if (val === PIN_CODE) {
    // success
    showPin(false);
    els.pinInput.value = "";
    els.pinError.hidden = true;
    // initialize firebase if exists
    if (window.initFirebase && typeof window.initFirebase === "function") {
      try { window.initFirebase(); } catch(e) { console.warn("initFirebase error", e); }
    }
  } else {
    els.pinError.hidden = false;
    els.pinError.textContent = "PIN incorreto — tenta de novo.";
    els.pinInput.value = "";
    els.pinInput.focus();
  }
}

/* ------------------------
   UI bind
   ------------------------ */
function bindUI() {
  els.openAddOrderBtn.addEventListener("click", () => openOrderModalForCreate());
  els.openProductsBtn.addEventListener("click", () => toggleModal(els.productsModalBackdrop, true));
  els.openClientsBtn.addEventListener("click", () => toggleModal(els.clientsModalBackdrop, true));

  els.gotoTodayBtn.addEventListener("click", () => setSelectedDate(todayISO()));
  els.prevDayBtn.addEventListener("click", () => changeSelectedDate(-1));
  els.nextDayBtn.addEventListener("click", () => changeSelectedDate(1));

  els.sortDirection.addEventListener("change", renderOrdersList);
  els.ordersSearch.addEventListener("input", renderOrdersList);

  // order modal events
  els.openProductsFromOrderBtn.addEventListener("click", () => toggleModal(els.productsModalBackdrop, true));
  els.addCustomItemBtn.addEventListener("click", addCustomItemToOrderUI);
  els.addClientQuickBtn.addEventListener("click", () => toggleModal(els.clientsModalBackdrop, true));
  els.cancelOrderBtn.addEventListener("click", () => closeOrderModalWithCheck());
  els.orderForm.addEventListener("input", () => { formDirty = true; });
  els.orderForm.addEventListener("submit", (e) => { e.preventDefault(); saveOrderFromForm(); });

  // product events
  els.productForm.addEventListener("submit", (e) => { e.preventDefault(); saveProductFromForm(); });
  els.cancelProductBtn.addEventListener("click", () => closeProductsModal());

  // client events
  els.clientForm.addEventListener("submit", (e) => { e.preventDefault(); saveClientFromForm(); });
  els.cancelClientBtn.addEventListener("click", () => closeClientsModal());
}

/* ------------------------
   MODAL helpers
   ------------------------ */
function toggleModal(modalEl, show = true) {
  if (!modalEl) return;
  if (show) {
    modalEl.hidden = false;
    modalEl.style.display = "flex";
  } else {
    modalEl.hidden = true;
    modalEl.style.display = "none";
  }
}

function closeOrderModalWithCheck() {
  if (formDirty) {
    if (!confirm("Existem alterações não salvas. Tem certeza que quer fechar?")) return;
  }
  closeOrderModal();
}

function closeOrderModal() {
  toggleModal(els.orderModalBackdrop, false);
  resetOrderForm();
  formDirty = false;
  els.deleteOrderBtn.hidden = true;
}

function resetOrderForm() {
  els.orderForm.reset();
  els.orderItemsContainer.innerHTML = "";
  els.orderTotal.value = "0.00";
  els.orderId.value = "";
}

/* ------------------------
   PRODUCTS CRUD (UI + storage)
   ------------------------ */
function renderProductsListUI() {
  els.productsList.innerHTML = "";
  if (!products.length) {
    els.productsList.innerHTML = `<div class="list-item">Nenhum produto cadastrado.</div>`;
    return;
  }
  products.forEach(p => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center">
        <div>
          <div style="font-weight:600">${escapeHtml(p.name)}</div>
          <div style="font-size:0.85rem;color:var(--muted)">R$ ${moneyFormat(p.price)}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn ghost edit-product" data-id="${p.id}">Editar</button>
        <button class="btn ghost delete-product" data-id="${p.id}">Excluir</button>
      </div>
    `;
    els.productsList.appendChild(div);
  });
  // bind edit/delete
  Array.from(els.productsList.querySelectorAll(".edit-product")).forEach(b => b.addEventListener("click", (ev) => {
    const id = ev.currentTarget.dataset.id;
    openProductForEdit(id);
  }));
  Array.from(els.productsList.querySelectorAll(".delete-product")).forEach(b => b.addEventListener("click", (ev) => {
    const id = ev.currentTarget.dataset.id;
    if (confirm("Excluir produto? Isso não removerá itens já salvos nos pedidos existentes.")) {
      products = products.filter(x => x.id !== id);
      saveAll(); renderProductsListUI(); renderOrderItemsUI(); renderOrdersList();
    }
  }));
}

function saveProductFromForm() {
  const name = (els.productName.value || "").trim();
  const price = Number(els.productPrice.value || 0);
  if (!name || price < 0) { alert("Preencha nome e preço válidos."); return; }
  const id = els.productId.value || uid("prod_");
  const existingIndex = products.findIndex(p => p.id === id);
  const obj = { id, name, price: Number(price) };
  if (existingIndex >= 0) products[existingIndex] = obj; else products.push(obj);
  saveAll();
  renderProductsListUI();
  renderClientsOptions();
  toggleModal(els.productsModalBackdrop, false);
  els.productForm.reset();
  els.productId.value = "";
  renderOrderItemsUI();
}

/* ------------------------
   CLIENTS CRUD (UI + storage)
   ------------------------ */
function renderClientsListUI() {
  els.clientsList.innerHTML = "";
  if (!clients.length) {
    els.clientsList.innerHTML = `<div class="list-item">Nenhum cliente cadastrado.</div>`;
    return;
  }
  clients.forEach(c => {
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
  Array.from(els.clientsList.querySelectorAll(".edit-client")).forEach(b => b.addEventListener("click", (ev) => {
    const id = ev.currentTarget.dataset.id;
    openClientForEdit(id);
  }));
  Array.from(els.clientsList.querySelectorAll(".delete-client")).forEach(b => b.addEventListener("click", (ev) => {
    const id = ev.currentTarget.dataset.id;
    if (!confirm("Excluir cliente? Pedidos existentes não terão o cliente removido automaticamente.")) return;
    clients = clients.filter(x => x.id !== id);
    saveAll();
    renderClientsListUI();
    renderClientsOptions();
    renderOrdersList();
  }));
}

function saveClientFromForm() {
  const name = (els.clientName.value || "").trim();
  const phone = (els.clientPhone.value || "").trim();
  if (!name) { alert("Nome do cliente é obrigatório."); return; }
  const id = els.clientId.value || uid("cli_");
  const existingIndex = clients.findIndex(c => c.id === id);
  const obj = { id, name, phone };
  if (existingIndex >= 0) clients[existingIndex] = obj; else clients.push(obj);
  saveAll();
  renderClientsListUI();
  renderClientsOptions();
  toggleModal(els.clientsModalBackdrop, false);
  els.clientForm.reset();
  els.clientId.value = "";
}

function openClientForEdit(id) {
  const c = clients.find(x => x.id === id);
  if (!c) return;
  els.clientName.value = c.name;
  els.clientPhone.value = c.phone;
  els.clientId.value = c.id;
  toggleModal(els.clientsModalBackdrop, true);
}

/* ------------------------
   Helpers UI: options and items rendering in order modal
   ------------------------ */
function renderClientsOptions() {
  // populate select used in order form
  els.orderClient.innerHTML = "";
  const emptyOpt = document.createElement("option");
  emptyOpt.value = "";
  emptyOpt.textContent = "-- selecione --";
  els.orderClient.appendChild(emptyOpt);
  clients.forEach(c => {
    const o = document.createElement("option");
    o.value = c.id;
    o.textContent = `${c.name} ${c.phone ? " — " + c.phone : ""}`;
    els.orderClient.appendChild(o);
  });
}

function renderOrderItemsUI() {
  // when opening/creating order, this will be called to fill items container with product list + qty controls
  // We'll just show a list of products with add buttons
  els.orderItemsContainer.innerHTML = "";
  if (!products.length) {
    const div = document.createElement("div");
    div.textContent = "Nenhum produto cadastrado. Adicione produtos no painel de produtos.";
    els.orderItemsContainer.appendChild(div);
    return;
  }
  products.forEach(p => {
    const row = document.createElement("div");
    row.className = "order-item-row";
    row.innerHTML = `
      <label style="display:flex;gap:8px;align-items:center">
        <input type="checkbox" class="order-item-ck" data-id="${p.id}">
        <div style="min-width:120px">
          <div style="font-weight:600">${escapeHtml(p.name)}</div>
          <div style="font-size:0.85rem;color:var(--muted)">R$ ${moneyFormat(p.price)}</div>
        </div>
        <input type="number" class="order-item-qty" data-id="${p.id}" value="1" min="1" style="width:70px;margin-left:auto">
      </label>
    `;
    els.orderItemsContainer.appendChild(row);
  });
  // bind events
  Array.from(els.orderItemsContainer.querySelectorAll(".order-item-ck")).forEach(ck => ck.addEventListener("change", onOrderItemsChange));
  Array.from(els.orderItemsContainer.querySelectorAll(".order-item-qty")).forEach(q => q.addEventListener("input", onOrderItemsChange));
}

function onOrderItemsChange() {
  calculateOrderTotalFromUI();
  formDirty = true;
}

function addCustomItemToOrderUI() {
  const name = prompt("Nome do item:");
  if (!name) return;
  const priceRaw = prompt("Preço do item (ex: 19.90):", "0.00");
  if (priceRaw === null) return;
  const price = parseFloat(priceRaw.replace(",", ".") || "0");
  if (isNaN(price)) { alert("Preço inválido."); return; }
  // create an item-row visually (not saved as product)
  const row = document.createElement("div");
  row.className = "order-custom-item";
  const localId = uid("citem_");
  row.innerHTML = `
    <label style="display:flex;gap:8px;align-items:center">
      <input type="checkbox" class="order-custom-item-ck" data-id="${localId}" checked>
      <div style="min-width:120px">
        <div style="font-weight:600">${escapeHtml(name)}</div>
        <div style="font-size:0.85rem;color:var(--muted)">R$ ${moneyFormat(price)}</div>
      </div>
      <input type="number" class="order-custom-item-qty" data-id="${localId}" value="1" min="1" style="width:70px;margin-left:auto">
      <input type="hidden" class="order-custom-item-price" data-id="${localId}" value="${price}">
      <input type="hidden" class="order-custom-item-name" data-id="${localId}" value="${escapeHtml(name)}">
      <button type="button" class="btn ghost remove-custom-item">Remover</button>
    </label>
  `;
  els.orderItemsContainer.appendChild(row);
  row.querySelector(".remove-custom-item").addEventListener("click", () => {
    row.remove();
    calculateOrderTotalFromUI();
  });
  Array.from(row.querySelectorAll("input")).forEach(i => i.addEventListener("input", () => { calculateOrderTotalFromUI(); formDirty = true; }));
  calculateOrderTotalFromUI();
}

/* ------------------------
   Order save / edit / delete
   ------------------------ */
function openOrderModalForCreate() {
  resetOrderForm();
  renderOrderItemsUI();
  els.orderDate.value = selectedDate;
  els.orderTime.value = currentTimeForNow();
  els.deleteOrderBtn.hidden = true;
  toggleModal(els.orderModalBackdrop, true);
  formDirty = false;
}

function openOrderModalForEdit(orderId) {
  const o = orders.find(x => x.id === orderId);
  if (!o) return alert("Pedido não encontrado");
  resetOrderForm();
  renderOrderItemsUI();
  // fill fields
  els.orderDate.value = o.date;
  els.orderTime.value = o.time;
  els.paymentMethod.value = o.paymentMethod || "dinheiro";
  els.orderPaid.checked = !!o.paid;
  els.orderId.value = o.id;
  // set client selection if client exists
  if (o.clientId && clients.find(c=>c.id===o.clientId)) {
    els.orderClient.value = o.clientId;
  } else {
    // if clientName text only, create a temporary option
    if (o.clientName) {
      const tempOption = document.createElement("option");
      tempOption.value = "";
      tempOption.textContent = `${o.clientName} ${o.clientPhone ? ' — ' + o.clientPhone : ''}`;
      tempOption.selected = true;
      els.orderClient.insertBefore(tempOption, els.orderClient.firstChild);
      els.orderClient.value = "";
    }
  }
  // check items - for product items, check corresponding checkbox and qty
  // wait a tick in case orderItemsContainer still rendering
  setTimeout(() => {
    // mark product items
    (o.items || []).forEach(it => {
      // product id?
      if (it.id && it.id.startsWith("prod_")) {
        const ck = els.orderItemsContainer.querySelector(`.order-item-ck[data-id="${it.id}"]`);
        const q = els.orderItemsContainer.querySelector(`.order-item-qty[data-id="${it.id}"]`);
        if (ck) ck.checked = true;
        if (q) q.value = it.qty || 1;
      } else {
        // custom items: add visually
        const row = document.createElement("div");
        row.className = "order-custom-item";
        const localId = uid("citem_");
        row.innerHTML = `
          <label style="display:flex;gap:8px;align-items:center">
            <input type="checkbox" class="order-custom-item-ck" data-id="${localId}" checked>
            <div style="min-width:120px">
              <div style="font-weight:600">${escapeHtml(it.name)}</div>
              <div style="font-size:0.85rem;color:var(--muted)">R$ ${moneyFormat(it.price)}</div>
            </div>
            <input type="number" class="order-custom-item-qty" data-id="${localId}" value="${it.qty||1}" min="1" style="width:70px;margin-left:auto">
            <input type="hidden" class="order-custom-item-price" data-id="${localId}" value="${it.price}">
            <input type="hidden" class="order-custom-item-name" data-id="${localId}" value="${escapeHtml(it.name)}">
            <button type="button" class="btn ghost remove-custom-item">Remover</button>
          </label>
        `;
        els.orderItemsContainer.appendChild(row);
        row.querySelector(".remove-custom-item").addEventListener("click", () => {
          row.remove();
          calculateOrderTotalFromUI();
        });
      }
    });
    calculateOrderTotalFromUI();
  }, 80);

  toggleModal(els.orderModalBackdrop, true);
  els.deleteOrderBtn.hidden = false;
  els.deleteOrderBtn.onclick = function() {
    if (!confirm("Excluir pedido? Essa ação não pode ser desfeita.")) return;
    orders = orders.filter(x => x.id !== o.id);
    saveAll();
    renderOrdersList();
    closeOrderModal();
  };
  formDirty = false;
}

/* Save order read from UI fields */
function saveOrderFromForm() {
  // read selected items
  const selectedItems = [];
  // product items
  Array.from(els.orderItemsContainer.querySelectorAll(".order-item-ck")).forEach(ck => {
    if (ck.checked) {
      const id = ck.dataset.id;
      const prod = products.find(p => p.id === id);
      if (prod) {
        const qtyInput = els.orderItemsContainer.querySelector(`.order-item-qty[data-id="${id}"]`);
        const qty = clamp(Number(qtyInput.value||1),1,9999);
        selectedItems.push({ id: prod.id, name: prod.name, price: Number(prod.price), qty });
      }
    }
  });
  // custom items
  Array.from(els.orderItemsContainer.querySelectorAll(".order-custom-item-ck")).forEach(ck => {
    if (ck.checked) {
      const id = ck.dataset.id;
      const qtyInput = els.orderItemsContainer.querySelector(`.order-custom-item-qty[data-id="${id}"]`);
      const priceInput = els.orderItemsContainer.querySelector(`.order-custom-item-price[data-id="${id}"]`);
      const nameInput = els.orderItemsContainer.querySelector(`.order-custom-item-name[data-id="${id}"]`);
      if (!priceInput || !nameInput) return;
      const qty = clamp(Number(qtyInput.value||1),1,9999);
      const price = Number(priceInput.value||0);
      const name = nameInput.value || "Item";
      selectedItems.push({ id: uid("cprod_"), name, price, qty });
    }
  });

  if (!selectedItems.length) { alert("Adicione pelo menos um item ao pedido."); return; }
  const date = els.orderDate.value;
  const time = els.orderTime.value;
  if (!date || !time) { alert("Preencha data e horário."); return; }

  const clientIdVal = els.orderClient.value;
  let clientName = "";
  let clientPhone = "";
  if (clientIdVal) {
    const c = clients.find(x => x.id === clientIdVal);
    if (c) { clientName = c.name; clientPhone = c.phone || ""; }
  } else {
    // try to read first option text (temp)
    const opt = els.orderClient.options[els.orderClient.selectedIndex];
    if (opt) {
      const txt = opt.textContent || "";
      clientName = txt.split("—")[0].trim();
    }
  }

  const total = selectedItems.reduce((s,it)=> s + (Number(it.price||0) * Number(it.qty||1)), 0);
  const paid = !!els.orderPaid.checked;
  const paymentMethod = els.paymentMethod.value || "dinheiro";
  const idFromForm = els.orderId.value;
  if (idFromForm) {
    // update existing
    const idx = orders.findIndex(x => x.id === idFromForm);
    if (idx >= 0) {
      orders[idx] = {
        ...orders[idx],
        date, time, items: selectedItems, clientId: clientIdVal, clientName, clientPhone, paymentMethod, total: Number(total), paid
      };
    }
  } else {
    const newOrder = {
      id: uid("ord_"),
      date, time, items: selectedItems, clientId: clientIdVal, clientName, clientPhone, paymentMethod, total: Number(total), paid
    };
    orders.push(newOrder);
  }

  saveAll();
  renderOrdersList();
  closeOrderModal();
}

/* ------------------------
   Orders list rendering & helpers
   ------------------------ */
function renderOrdersList() {
  const search = (els.ordersSearch.value || "").toLowerCase().trim();
  const sortDir = els.sortDirection.value || "desc";
  const list = orders.filter(o => o.date === selectedDate);
  // filter by search
  const filtered = list.filter(o => {
    if (!search) return true;
    const hay = `${o.clientName || ""} ${o.clientPhone||""} ${ (o.items||[]).map(i=>i.name).join(" ") }`.toLowerCase();
    return hay.includes(search);
  });
  // sort by time HH:MM
  filtered.sort((a,b) => {
    if (!a.time) return -1;
    if (!b.time) return 1;
    const ta = a.time.split(":").map(Number);
    const tb = b.time.split(":").map(Number);
    const va = ta[0]*60 + (ta[1]||0);
    const vb = tb[0]*60 + (tb[1]||0);
    return sortDir === "asc" ? va - vb : vb - va;
  });

  els.ordersList.innerHTML = "";
  if (!filtered.length) {
    els.emptyState.hidden = false;
    els.ordersList.innerHTML = "";
    return;
  } else {
    els.emptyState.hidden = true;
  }

  filtered.forEach(o => {
    const tpl = els.orderCardTemplate.content.cloneNode(true);
    const art = tpl.querySelector("article");
    art.dataset.orderId = o.id;
    tpl.querySelector(".order-time").textContent = o.time || "";
    tpl.querySelector(".order-client").textContent = o.clientName || "—";
    tpl.querySelector(".order-items-count").textContent = `${(o.items||[]).length} itens`;
    tpl.querySelector(".order-phone").textContent = o.clientPhone || "";
    tpl.querySelector(".order-value").textContent = moneyFormat(o.total || 0);
    // actions
    const editBtn = tpl.querySelector(".edit-order-btn");
    const delBtn = tpl.querySelector(".delete-order-btn");
    editBtn.addEventListener("click", () => openOrderModalForEdit(o.id));
    delBtn.addEventListener("click", () => {
      if (!confirm("Excluir pedido?")) return;
      orders = orders.filter(x => x.id !== o.id);
      saveAll();
      renderOrdersList();
    });
    els.ordersList.appendChild(tpl);
  });
}

/* ------------------------
   Calendar rendering (simple month view)
   ------------------------ */
function renderCalendar() {
  // render a simple month grid showing current month; clicking a day sets selectedDate.
  const base = new Date(selectedDate);
  const year = base.getFullYear();
  const month = base.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // header
  els.calendar.innerHTML = "";
  const head = document.createElement("div");
  head.style.display = "flex";
  head.style.justifyContent = "space-between";
  head.style.alignItems = "center";
  head.style.marginBottom = "8px";
  head.innerHTML = `<div style="font-weight:700">${firstDay.toLocaleString('pt-BR',{month:'long', year:'numeric'})}</div>
    <div style="display:flex;gap:6px">
      <button class="btn ghost" id="calPrevMonth">◀</button>
      <button class="btn ghost" id="calNextMonth">▶</button>
    </div>`;
  els.calendar.appendChild(head);

  // grid
  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(7,1fr)";
  grid.style.gap = "6px";

  // weekdays header
  const weekDays = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  weekDays.forEach(w => {
    const wdiv = document.createElement("div");
    wdiv.style.textAlign = "center";
    wdiv.style.fontSize = "0.85rem";
    wdiv.style.color = "var(--muted)";
    wdiv.textContent = w;
    grid.appendChild(wdiv);
  });

  // fill blanks
  for (let i=0;i<startWeekday;i++) {
    const cell = document.createElement("div");
    grid.appendChild(cell);
  }
  // days
  for (let d=1; d<=daysInMonth; d++) {
    const cell = document.createElement("button");
    cell.className = "cal-day";
    const iso = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    cell.dataset.iso = iso;
    cell.textContent = d;
    cell.style.padding = "8px";
    cell.style.borderRadius = "8px";
    cell.style.border = "none";
    cell.style.cursor = "pointer";
    // highlight selected
    if (iso === selectedDate) {
      cell.style.background = "rgba(0,193,106,0.16)";
      cell.style.fontWeight = "700";
    }
    // show if has orders: small dot
    const has = orders.some(o => o.date === iso);
    if (has) {
      const dot = document.createElement("div");
      dot.style.width = "6px";
      dot.style.height = "6px";
      dot.style.borderRadius = "50%";
      dot.style.background = "var(--accent)";
      dot.style.marginTop = "6px";
      dot.style.marginLeft = "auto";
      dot.style.marginRight = "auto";
      cell.appendChild(dot);
      cell.style.display = "flex";
      cell.style.flexDirection = "column";
      cell.style.alignItems = "center";
    }

    cell.addEventListener("click", () => setSelectedDate(iso));
    grid.appendChild(cell);
  }

  els.calendar.appendChild(grid);

  // navigation months
  document.getElementById("calPrevMonth").addEventListener("click", () => {
    const newMonth = new Date(year, month-1, 1);
    const iso = newMonth.toISOString().slice(0,10);
    selectedDate = iso; renderCalendar(); renderOrdersList(); updateCurrentLabels();
  });
  document.getElementById("calNextMonth").addEventListener("click", () => {
    const newMonth = new Date(year, month+1, 1);
    const iso = newMonth.toISOString().slice(0,10);
    selectedDate = iso; renderCalendar(); renderOrdersList(); updateCurrentLabels();
  });
}

/* change selected date by offset in days */
function changeSelectedDate(deltaDays) {
  const d = new Date(selectedDate);
  d.setDate(d.getDate() + deltaDays);
  selectedDate = d.toISOString().slice(0,10);
  setSelectedDate(selectedDate);
}

function setSelectedDate(iso) {
  selectedDate = iso;
  renderCalendar();
  renderOrdersList();
  updateCurrentLabels();
}

/* ------------------------
   Helpers: UI labels and time helpers
   ------------------------ */
function updateCurrentLabels() {
  els.ordersDayLabel.textContent = (new Date(selectedDate)).toLocaleDateString();
  els.currentDayLabel.textContent = `Mostrando: ${(new Date(selectedDate)).toLocaleDateString()}`;
}

function currentTimeForNow() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2,"0");
  const mm = String(d.getMinutes()).padStart(2,"0");
  return `${hh}:${mm}`;
}

/* ------------------------
   Order total calculation
   ------------------------ */
function calculateOrderTotalFromUI() {
  let total = 0;
  // product items
  Array.from(els.orderItemsContainer.querySelectorAll(".order-item-ck")).forEach(ck => {
    if (ck.checked) {
      const id = ck.dataset.id;
      const prod = products.find(p => p.id === id);
      if (prod) {
        const q = els.orderItemsContainer.querySelector(`.order-item-qty[data-id="${id}"]`);
        const qty = clamp(Number(q.value||1),1,9999);
        total += Number(prod.price) * qty;
      }
    }
  });
  // custom items
  Array.from(els.orderItemsContainer.querySelectorAll(".order-custom-item-ck")).forEach(ck => {
    if (ck.checked) {
      const id = ck.dataset.id;
      const p = els.orderItemsContainer.querySelector(`.order-custom-item-price[data-id="${id}"]`);
      const q = els.orderItemsContainer.querySelector(`.order-custom-item-qty[data-id="${id}"]`);
      if (!p) return;
      const price = Number(p.value || 0);
      const qty = clamp(Number(q.value||1),1,9999);
      total += price * qty;
    }
  });
  els.orderTotal.value = moneyFormat(total);
}

/* ------------------------
   Utility: escape HTML
   ------------------------ */
function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]; });
}

/* ------------------------
   Misc: open product for edit
   ------------------------ */
function openProductForEdit(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  els.productName.value = p.name;
  els.productPrice.value = moneyFormat(p.price);
  els.productId.value = p.id;
  toggleModal(els.productsModalBackdrop, true);
}

/* ------------------------
   Close modals helpers
   ------------------------ */
function closeProductsModal() {
  els.productForm.reset();
  els.productId.value = "";
  toggleModal(els.productsModalBackdrop, false);
}
function closeClientsModal() {
  els.clientForm.reset();
  els.clientId.value = "";
  toggleModal(els.clientsModalBackdrop, false);
}

/* ------------------------
   Small helper: render clients options again on demand
   ------------------------ */
function renderClientsOptions() {
  // already implemented earlier; re-run to refresh
  const sel = document.getElementById("orderClient");
  if (!sel) return;
  sel.innerHTML = "";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "-- selecione --";
  sel.appendChild(empty);
  clients.forEach(c => {
    const o = document.createElement("option");
    o.value = c.id;
    o.textContent = `${c.name}${c.phone ? " — " + c.phone : ""}`;
    sel.appendChild(o);
  });
}

/* ------------------------
   Init load
   ------------------------ */
document.addEventListener("DOMContentLoaded", () => {
  init();
});
