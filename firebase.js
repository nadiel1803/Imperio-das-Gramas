/**
 * firebase.js
 * - Inicializa Firebase Firestore (SDK modular via CDN)
 * - NÃO usa Auth (não há signInAnonymously)
 * - Expõe em window.firebaseApi a API:
 *    - onCollectionSnapshot(collectionName, callback) -> retorna unsubscribe()
 *    - add(collectionName, data) -> Promise(docRef)
 *    - set(collectionName, id, data) -> Promise()
 *    - update(collectionName, id, data) -> Promise()
 *    - delete(collectionName, id) -> Promise()
 *    - getAll(collectionName) -> Promise(arrayDocs)
 *
 * Substitua `firebaseConfig` com os dados do seu Firebase Console (Web app).
 */

const firebaseConfig = {
  apiKey: "AIzaSyC0g9Kxu-KbfFxGm1wpNR-KurnU_1arpAk",
  authDomain: "imperio-das-gramas.firebaseapp.com",
  projectId: "imperio-das-gramas",
  storageBucket: "imperio-das-gramas.firebasestorage.app",
  messagingSenderId: "750713878247",
  appId: "1:750713878247:web:0c623fa465fef44be35442",
};

(function () {
  if (window.firebaseApi) return; // já inicializado

  let firebaseApp = null;
  let db = null;
  const VERSION = "10.6.1"; // versão do SDK via CDN (pode ajustar)
  const BASE = `https://www.gstatic.com/firebasejs/${VERSION}`;

  async function initFirebase() {
    if (firebaseApp && db && window.firebaseApi) return window.firebaseApi;
    if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
      throw new Error("firebaseConfig vazio em firebase.js — cole seu config do Firebase Console");
    }

    // importa modular SDK via dynamic import
    const appMod = await import(`${BASE}/firebase-app.js`);
    const firestoreMod = await import(`${BASE}/firebase-firestore.js`);

    const { initializeApp } = appMod;
    const {
      getFirestore,
      collection,
      doc,
      addDoc,
      setDoc,
      updateDoc,
      deleteDoc,
      onSnapshot,
      getDocs
    } = firestoreMod;

    firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp);

    // Monta a API que o app espera
    window.firebaseApi = {
      _internal: { db },

      // recebe callback(snapshots) e retorna unsubscribe
      onCollectionSnapshot: (collectionName, cb) => {
        const colRef = collection(db, collectionName);
        const unsub = onSnapshot(colRef, snapshot => {
          // transforma snapshot em array simples
          const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          try { cb(null, docs); } catch (e) { console.error("firebaseApi callback error:", e); }
        }, err => {
          cb(err);
        });
        return unsub;
      },

      add: async (collectionName, data) => {
        const colRef = collection(db, collectionName);
        const docRef = await addDoc(colRef, data);
        return docRef;
      },

      set: async (collectionName, id, data) => {
        const docRef = doc(db, collectionName, id);
        await setDoc(docRef, data);
      },

      update: async (collectionName, id, data) => {
        const docRef = doc(db, collectionName, id);
        await updateDoc(docRef, data);
      },

      delete: async (collectionName, id) => {
        const docRef = doc(db, collectionName, id);
        await deleteDoc(docRef);
      },

      getAll: async (collectionName) => {
        const colRef = collection(db, collectionName);
        const snap = await getDocs(colRef);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    };

    return window.firebaseApi;
  }

  // expõe initFirebase globalmente
  window.initFirebase = initFirebase;
})();
