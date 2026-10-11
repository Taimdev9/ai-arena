import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAVPt5MjOR6cFAYSbOwphsLZB_zK3JVJUc",
  authDomain: "lab-bot-4a7e4.firebaseapp.com",
  projectId: "lab-bot-4a7e4",
  storageBucket: "lab-bot-4a7e4.firebasestorage.app",
  messagingSenderId: "983038815926",
  appId: "1:983038815926:web:d4aba4fc574e7e359c4017",
  measurementId: "G-ZK2ZDSC92M"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let readyResolve;
const ready = new Promise(r => readyResolve = r);

signInAnonymously(auth).catch(err => {
  console.error("Auth error:", err);
  readyResolve(false);
});

onAuthStateChanged(auth, user => {
  currentUser = user;
  if (user) readyResolve(true);
});

async function cloudSave(data) {
  if (!currentUser) return false;
  try {
    await setDoc(doc(db, 'brains', currentUser.uid), {
      ...data,
      updatedAt: Date.now()
    });
    return true;
  } catch(e) {
    console.error("Cloud save error:", e);
    return false;
  }
}

async function cloudLoad() {
  if (!currentUser) return null;
  try {
    const snap = await getDoc(doc(db, 'brains', currentUser.uid));
    return snap.exists() ? snap.data() : null;
  } catch(e) {
    console.error("Cloud load error:", e);
    return null;
  }
}

window.Firebase = {
  ready,
  save: cloudSave,
  load: cloudLoad,
  getUser: () => currentUser
};