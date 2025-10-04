/**************************************************
 * firebase.js - integração opcional (template)
 *
 * COMO USAR:
 * 1) Cole o SDK do Firebase no seu HTML (opcional) ou carregue via módulos.
 *    Exemplo snippet classic (script tags) — adicione no seu index.html
 *      <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
 *      <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>
 *
 * 2) Substitua o objeto firebaseConfig abaixo pelos valores do seu projeto Firebase.
 *
 * 3) Se quiser sincronizar automaticamente, implemente window.firebaseSync = function(data) { ... }
 *    Eu já deixei uma função exemplo que tenta escrever em Firestore (comentada). Use com cuidado.
 *
 * NOTA: o app funciona 100% com localStorage sem necessidade de Firebase.
 **************************************************/

// Coloque sua configuração aqui (exemplo vazio). Substitua pelos valores do console do Firebase.
const firebaseConfig = {
  apiKey: "AIzaSyC0g9Kxu-KbfFxGm1wpNR-KurnU_1arpAk",
  authDomain: "imperio-das-gramas.firebaseapp.com",
  projectId: "imperio-das-gramas",
  storageBucket: "imperio-das-gramas.firebasestorage.app",
  messagingSenderId: "750713878247",
  appId: "1:750713878247:web:0c623fa465fef44be35442",
};

// Inicializa Firebase somente se o config estiver preenchido (evita erros se não usar)
window.initFirebase = function() {
  try {
    if (!firebaseConfig || !firebaseConfig.apiKey) {
      console.warn("Firebase não configurado (firebaseConfig vazio). Ignorando inicialização.");
      return;
    }
    if (!window.firebase) {
      console.warn("SDK do Firebase não encontrado. Adicione os scripts do Firebase no index.html para usar.");
      return;
    }
    // Se estiver usando compat SDK
    if (!window._gp_firebase_initialized) {
      window.firebaseApp = firebase.initializeApp(firebaseConfig);
      window.firestore = firebase.firestore();
      window._gp_firebase_initialized = true;
      console.log("Firebase inicializado (compat).");
    }
  } catch (e) {
    console.error("Erro ao inicializar Firebase:", e);
  }
};

/* 
  Exemplo de função opcional para sincronizar dados para Firestore.
  ATENÇÃO: é só um exemplo. Não chame automaticamente se não quiser gravação remota.
  Se quiser ativar, descomente e ajuste a lógica conforme necessidade.
*/
window.firebaseSync = function(data) {
  // data = { products, clients, orders }
  // Só tenta se firestore existir
  if (!window.firestore) {
    // nada a fazer
    return;
  }
  try {
    // exemplo simples: grava documento único por usuário/instância com timestamp
    const docRef = window.firestore.collection("gerenciador_pedidos_backup").doc("instancia_default");
    const payload = {
      updatedAt: new Date(),
      products: data.products || [],
      clients: data.clients || [],
      orders: data.orders || []
    };
    // escreve sem overwriting de metadados
    docRef.set(payload, { merge: true }).then(() => {
      console.log("Backup salvo no Firestore (gerenciador_pedidos_backup/instancia_default).");
    }).catch(err => console.error("Erro ao salvar backup Firestore:", err));
  } catch (e) {
    console.error("firebaseSync erro:", e);
  }
};

/* Se preferir, você pode substituir window.firebaseSync por uma função que envie os dados via Realtime DB ou Cloud Functions. 
   Eu deixei essa implementação simples pra você já ter um ponto de partida.
*/
