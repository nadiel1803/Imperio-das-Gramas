// Importa Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// CONFIG FIREBASE - substitua pelos seus dados do console Firebase
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJECT_ID.firebaseapp.com",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_PROJECT_ID.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* DOM */
const clienteForm = document.getElementById("clienteForm");
const produtoForm = document.getElementById("produtoForm");
const pedidoForm = document.getElementById("pedidoForm");

const clientesList = document.getElementById("clientesList");
const produtosList = document.getElementById("produtosList");
const pedidosList = document.getElementById("pedidosList");

const pedidoCliente = document.getElementById("pedidoCliente");
const pedidoProduto = document.getElementById("pedidoProduto");
const pedidoPago = document.getElementById("pedidoPago");

/* CLIENTES */
const clientesRef = collection(db, "clientes");

async function carregarClientes() {
  const snap = await getDocs(clientesRef);
  clientesList.innerHTML = "";
  pedidoCliente.innerHTML = '<option value="">Selecione um cliente</option>';
  snap.forEach((docu) => {
    const c = docu.data();
    clientesList.innerHTML += `<li>${c.nome} <button onclick="removerCliente('${docu.id}')">❌</button></li>`;
    pedidoCliente.innerHTML += `<option value="${c.nome}">${c.nome}</option>`;
  });
}

clienteForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("clienteNome").value;
  await addDoc(clientesRef, { nome });
  clienteForm.reset();
  carregarClientes();
});

window.removerCliente = async (id) => {
  await deleteDoc(doc(db, "clientes", id));
  carregarClientes();
};

/* PRODUTOS */
const produtosRef = collection(db, "produtos");

async function carregarProdutos() {
  const snap = await getDocs(produtosRef);
  produtosList.innerHTML = "";
  pedidoProduto.innerHTML = '<option value="">Selecione um produto</option>';
  snap.forEach((docu) => {
    const p = docu.data();
    produtosList.innerHTML += `<li>${p.nome} - R$${p.preco} <button onclick="removerProduto('${docu.id}')">❌</button></li>`;
    pedidoProduto.innerHTML += `<option value="${p.nome}">${p.nome}</option>`;
  });
}

produtoForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("produtoNome").value;
  const preco = document.getElementById("produtoPreco").value;
  await addDoc(produtosRef, { nome, preco });
  produtoForm.reset();
  carregarProdutos();
});

window.removerProduto = async (id) => {
  await deleteDoc(doc(db, "produtos", id));
  carregarProdutos();
};

/* PEDIDOS */
const pedidosRef = collection(db, "pedidos");

async function carregarPedidos() {
  const snap = await getDocs(pedidosRef);
  pedidosList.innerHTML = "";
  snap.forEach((docu) => {
    const p = docu.data();
    pedidosList.innerHTML += `<li>Cliente: ${p.cliente} | Produto: ${p.produto} | Pago: ${p.pago ? "✅" : "❌"}</li>`;
  });
}

pedidoForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const cliente = pedidoCliente.value;
  const produto = pedidoProduto.value;
  const pago = pedidoPago.checked;
  await addDoc(pedidosRef, { cliente, produto, pago });
  pedidoForm.reset();
  carregarPedidos();
});

/* Inicialização */
carregarClientes();
carregarProdutos();
carregarPedidos();
