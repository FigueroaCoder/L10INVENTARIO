// js/auth-global.js
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAX-WKQe_AvWQzNswGC1QIMRzz3RTMZB2o",
  authDomain: "almacen-web-2026.firebaseapp.com",
  projectId: "almacen-web-2026",
  storageBucket: "almacen-web-2026.firebasestorage.app",
  messagingSenderId: "777489188342",
  appId: "1:777489188342:web:992bdeeeaa8bd89409f3d7",
  measurementId: "G-EX9YG2K41P"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// CONTROL DE SESIÓN SIN FLICKER
onAuthStateChanged(auth, async (user) => {

  // SIN SESIÓN
  if (!user) {
    window.location.replace("login.html");
    return;
  }

  // GLOBAL
  window.currentUser = user;

  // MOSTRAR USUARIO
  const span = document.getElementById("usuarioActivo");
  if (span) {
    span.innerText = "Usuario: " + user.email;
  }

  try {

    // OBTENER ROL DIRECTO (RÁPIDO)
    const userRef = doc(db, "usuarios", user.email);
    const userSnap = await getDoc(userRef);

    let rol = "user";

    if (userSnap.exists()) {
      rol = userSnap.data().role || "user";
    }

    window.currentRole = rol;

    // CONTROL DEL MENÚ ADMIN (SIN PARPADEO)
    const menu = document.getElementById("adminMenu");

    if (menu) {
      // SOLO mostrar si es admin
      if (rol === "admin") {
        menu.style.display = "block";
      }
      // NO hacer nada si no es admin (ya está oculto por CSS)
    }

    // BLOQUEAR ACCESO DIRECTO A /usuarios
    if (rol !== "admin" && window.location.pathname.includes("usuarios.html")) {
      window.location.replace("index.html");
    }

  } catch (e) {
    console.error("Error obteniendo rol:", e);
  }

});

// LOGOUT GLOBAL
window.logout = function () {
  signOut(auth)
    .then(() => {
      window.location.replace("login.html");
    })
    .catch((e) => {
      console.error("Error al cerrar sesión:", e);
      alert("Error al cerrar sesión");
    });
};