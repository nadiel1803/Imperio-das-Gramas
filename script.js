// Import Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Config Firebase
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
const clientesTable = document.getElementById("clientesTable");
const produtosTable = document.getElementById("produtosTable");
const pedidosTable = document.getElementById("pedidosTable");

const pedidoCliente = document.getElementById("pedidoCliente");
const pedidoProduto = document.getElementById("pedidoProduto");
const pedidoPago = document.getElementById("pedidoPago");

/* CLIENTES */
const clientesRef = collection(db, "clientes");

async function carregarClientes() {
  const snap = await getDocs(clientesRef);
  clientesTable.innerHTML = "";
  pedidoCliente.innerHTML = '<option value="">Selecione um cliente</option>';
  snap.forEach((docu) => {
    const c = docu.data();
    clientesTable.innerHTML += `
      <tr>
        <td>${c.nome}</td>
        <td><button onclick="removerCliente('${docu.id}')">Excluir</button></td>
      </tr>`;
    pedidoCliente.innerHTML += `<option value="${c.nome}">${c.nome}</option>`;
  });
}

document.getElementById("clienteForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("clienteNome").value;
  await addDoc(clientesRef, { nome });
  e.target.reset();
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
  produtosTable.innerHTML = "";
  pedidoProduto.innerHTML = '<option value="">Selecione um produto</option>';
  snap.forEach((docu) => {
    const p = docu.data();
    produtosTable.innerHTML += `
      <tr>
        <td>${p.nome}</td>
        <td>R$${p.preco}</td>
        <td><button onclick="removerProduto('${docu.id}')">Excluir</button></td>
      </tr>`;
    pedidoProduto.innerHTML += `<option value="${p.nome}">${p.nome}</option>`;
  });
}

document.getElementById("produtoForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("produtoNome").value;
  const preco = document.getElementById("produtoPreco").value;
  await addDoc(produtosRef, { nome, preco });
  e.target.reset();
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
  pedidosTable.innerHTML = "";
  snap.forEach((docu) => {
    const p = docu.data();
    pedidosTable.innerHTML += `
      <tr>
        <td>${p.cliente}</td>
        <td>${p.produto}</td>
        <td>${p.pago ? "✅ Pago" : "❌ Pendente"}</td>
      </tr>`;
  });
}

document.getElementById("pedidoForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const cliente = pedidoCliente.value;
  const produto = pedidoProduto.value;
  const pago = pedidoPago.checked;
  await addDoc(pedidosRef, { cliente, produto, pago });
  e.target.reset();
  carregarPedidos();
});

/* Inicialização */
carregarClientes();
carregarProdutos();
carregarPedidos();
