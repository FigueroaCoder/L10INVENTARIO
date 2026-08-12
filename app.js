import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { 
  getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where 
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

/* =====================
CONFIG
===================== */

const firebaseConfig = {
  apiKey: "AIzaSyAX-WKQe_AvWQzNswGC1QIMRzz3RTMZB2o",
  authDomain: "almacen-web-2026.firebaseapp.com",
  projectId: "almacen-web-2026",
  storageBucket: "almacen-web-2026.firebasestorage.app",
  messagingSenderId: "777489188342",
  appId: "1:777489188342:web:992bdeeeaa8bd89409f3d7"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

/* =====================
UTIL
===================== */

function getUser(){
  return window.currentUser?.email || "DESCONOCIDO";
}

function generateID(nombre){
  return nombre.substring(0,3).toUpperCase() + Math.floor(Math.random()*1000);
}

/* =====================
CACHE
===================== */

let cacheInventario = [];
let historialCache = [];


/* =====================
REGISTRAR ENTRADA (CORREGIDO)
===================== */

window.registerEntry = async function(){

  let nombre = document.getElementById("nombre").value.trim();
  let pn = document.getElementById("pn").value.trim() || "NO APLICA";
  let cantidad = parseInt(document.getElementById("cantidad").value);
  let ubicacion = document.getElementById("ubicacion").value;
  let comentarios = document.getElementById("comentarios").value || "NO APLICA";

  if(!nombre || isNaN(cantidad) || cantidad <= 0){
    alert("Datos inválidos");
    return;
  }

  try{

    const inventarioRef = collection(db, "inventario");
    const q = query(inventarioRef, where("nombre", "==", nombre));
    const snapshot = await getDocs(q);

    let idGenerado = generateID(nombre);

    if(!snapshot.empty){

      let docSnap = snapshot.docs[0];
      let data = docSnap.data();

      idGenerado = data.id;

      // 🔥 ACTUALIZACIÓN COMPLETA
      await updateDoc(doc(db,"inventario",docSnap.id),{
        cantidad: (data.cantidad || 0) + cantidad,

        // 👇 ESTO ES LO QUE TE FALTABA
        ubicacion: ubicacion || data.ubicacion,
        comentarios: comentarios || data.comentarios
      });

    } else {

      await addDoc(inventarioRef,{
        id: idGenerado,
        nombre,
        pn,
        cantidad,
        ubicacion,
        responsable: getUser(),
        comentarios
      });

    }

    // 🔥 HISTORIAL
    await addDoc(collection(db,"historial"),{
      fecha: new Date().toLocaleString(),
      accion: "ENTRADA",
      id: idGenerado,
      nombre,
      cantidad,
      responsable: getUser(),
      comentarios
    });

    alert("Entrada registrada");

    // 🔥 REFRESH LIMPIO
    cacheInventario = [];
    await window.showStock();

  }catch(e){
    console.error(e);
    alert("Error en entrada");
  }

};

/* =====================
INVENTARIO
===================== */

let cargandoStock = false; // 🔥 evita duplicados

window.showStock = async function(){

  if(cargandoStock) return; // 🚫 bloquea doble ejecución
  cargandoStock = true;

  const tabla = document.getElementById("tabla");
  if(!tabla){
    cargandoStock = false;
    return;
  }

  // 🔥 limpiar SIEMPRE antes de renderizar
  tabla.innerHTML = "";

  try{

    const snapshot = await getDocs(collection(db,"inventario"));

    cacheInventario = snapshot.docs.map(doc => ({
      idDoc: doc.id,
      ...doc.data()
    }));

    // 🔥 forma más eficiente (mejor que +=)
    let html = "";

    cacheInventario.forEach(p=>{
      html += `
<tr>
<td>${p.id || ""}</td>
<td>${p.nombre || ""}</td>
<td>${p.pn || ""}</td>
<td>${p.cantidad || 0}</td>
<td>${p.responsable || ""}</td>
<td>${p.ubicacion || ""}</td>
<td>${p.comentarios || ""}</td>
</tr>`;
    });

    tabla.innerHTML = html;

  }catch(e){
    console.error("Error cargando inventario:", e);
  }

  cargandoStock = false;
};
/* =====================
BUSCADOR INVENTARIO
===================== */

window.liveSearch = function(){

  const input = document.getElementById("valor").value.toLowerCase();
  const filas = document.querySelectorAll("#tabla tr");

  filas.forEach(fila => {
    const texto = fila.innerText.toLowerCase();
    fila.style.display = texto.includes(input) ? "" : "none";
  });

};

/* =====================
SALIDA
===================== */

window.registrarSalida = async function(){

  let nombre = document.getElementById("idProducto").value.trim();
  let cantidad = parseInt(document.getElementById("cantidadSalida").value);
  let comentarios = document.getElementById("comentariosSalida").value || "NO APLICA";

  if(!nombre || isNaN(cantidad) || cantidad <= 0){
    alert("Datos inválidos");
    return;
  }

  try{

    const q = query(collection(db,"inventario"), where("nombre","==",nombre));
    const snapshot = await getDocs(q);

    if(snapshot.empty){
      alert("No existe");
      return;
    }

    let docSnap = snapshot.docs[0];
    let data = docSnap.data();

    if(data.cantidad < cantidad){
      alert("Sin stock");
      return;
    }

    await updateDoc(doc(db,"inventario",docSnap.id),{
      cantidad: data.cantidad - cantidad
    });

    await addDoc(collection(db,"historial"),{
      fecha: new Date().toLocaleString(),
      accion: "SALIDA",
      id: data.id,
      nombre,
      cantidad,
      responsable: getUser(),
      comentarios
    });

    alert("Salida registrada");

    cacheInventario = [];
    window.showStock();

  }catch(e){
    console.error(e);
    alert("Error en salida");
  }

};

/* =====================
AUTOCOMPLETE SALIDA
===================== */

window.suggestProductsSalida = async function(){

  const input = document.getElementById("idProducto").value.toLowerCase();
  const contenedor = document.getElementById("sugerenciasSalida");

  contenedor.innerHTML = "";

  if(!input) return;

  if(cacheInventario.length === 0){
    const snapshot = await getDocs(collection(db,"inventario"));
    cacheInventario = snapshot.docs.map(doc => ({
      idDoc: doc.id,
      ...doc.data()
    }));
  }

  const filtrados = cacheInventario.filter(p =>
    p.nombre?.toLowerCase().includes(input) ||
    p.id?.toLowerCase().includes(input)
  );

  filtrados.slice(0,5).forEach(p => {

    const item = document.createElement("div");

    item.innerText = `${p.nombre} (${p.id})`;
    item.style.padding = "10px";
    item.style.cursor = "pointer";

    item.onclick = () => {
      document.getElementById("idProducto").value = p.nombre;
      document.getElementById("idAuto").value = p.id;
      document.getElementById("pnAuto").value = p.pn;
      contenedor.innerHTML = "";
    };

    contenedor.appendChild(item);
  });

};

/* =====================
HISTORIAL
===================== */

window.viewHistory = async function(){

  const tabla = document.getElementById("tablaHistorial");
  if(!tabla) return;

  const snapshot = await getDocs(collection(db,"historial"));

  historialCache = snapshot.docs.map(doc => doc.data());

  renderHistorial(historialCache);
};

/* =====================
RENDER HISTORIAL
===================== */

let renderizandoHistorial = false;

function renderHistorial(data){

  if(renderizandoHistorial) return; // 🚫 evita doble render
  renderizandoHistorial = true;

  const tabla = document.getElementById("tablaHistorial");
  if(!tabla){
    renderizandoHistorial = false;
    return;
  }

  // 🔥 limpiar siempre
  tabla.innerHTML = "";

  try{

    let html = "";

    data.forEach(d => {
      html += `
<tr>
<td>${d.fecha || ""}</td>
<td>${d.accion || ""}</td>
<td>${d.id || "-"}</td>
<td>${d.nombre || ""}</td>
<td>${d.cantidad || 0}</td>
<td>${d.responsable || ""}</td>
<td>${d.comentarios || ""}</td>
</tr>`;
    });

    tabla.innerHTML = html;

  }catch(e){
    console.error("Error renderizando historial:", e);
  }

  renderizandoHistorial = false;
}

/* =====================
BUSCAR + FILTRAR HISTORIAL
===================== */

window.filterHistory = function(){

  const texto = document.getElementById("valor").value.toLowerCase();
  const tipo = document.getElementById("tipoFiltro").value;

  const filtrado = historialCache.filter(item => {

    const matchTexto =
      item.nombre?.toLowerCase().includes(texto) ||
      item.id?.toLowerCase().includes(texto);

    const matchTipo =
      tipo === "todos" || item.accion === tipo;

    return matchTexto && matchTipo;
  });

  renderHistorial(filtrado);
};

/* =====================
EXPORTAR HISTORIAL
===================== */

window.exportHistory = function(){

  let csv = "Fecha,Movimiento,ID,Producto,Cantidad,Responsable,Comentarios\n";

  historialCache.forEach(d=>{
    csv += `${d.fecha},${d.accion},${d.id},${d.nombre},${d.cantidad},${d.responsable},${d.comentarios}\n`;
  });

  const blob = new Blob([csv], {type:"text/csv"});
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "historial.csv";
  a.click();
};

/* =====================
AUTOCOMPLETE ENTRADA (CORREGIDO)
===================== */

window.suggestProducts = async function(){

  const input = document.getElementById("nombre").value.toLowerCase();
  const contenedor = document.getElementById("sugerencias");

  contenedor.innerHTML = "";
  if(!input) return;

  // usar cache o cargar si está vacío
  if(!cacheInventario || cacheInventario.length === 0){
    const snapshot = await getDocs(collection(db,"inventario"));
    cacheInventario = snapshot.docs.map(doc => ({
      idDoc: doc.id,
      ...doc.data()
    }));
  }

  const filtrados = cacheInventario.filter(p =>
    (p.nombre && p.nombre.toLowerCase().includes(input)) ||
    (p.id && p.id.toLowerCase().includes(input))
  );

  filtrados.slice(0,5).forEach(p => {

    const item = document.createElement("div");
    item.className = "suggestion";
    item.innerText = `${p.nombre || "Sin nombre"} (${p.id || "Sin ID"})`;

    item.onclick = () => seleccionarProducto(p);

    contenedor.appendChild(item);
  });

};

/* =====================
SELECCIONAR PRODUCTO (FIX TOTAL)
===================== */

function seleccionarProducto(p){

  // 🔥 llenar datos principales
  document.getElementById("nombre").value = p.nombre || "";
  document.getElementById("pn").value = p.pn || "";

  // 🔥 LO QUE TE FALTABA
  document.getElementById("ubicacion").value = p.ubicacion || "";
  document.getElementById("comentarios").value = p.comentarios || "";

  // limpiar cantidad (nueva entrada)
  document.getElementById("cantidad").value = "";

  // 🔥 mostrar ID si existe
  if(document.getElementById("idAuto")){
    document.getElementById("idAuto").value = p.id || "";
  }

  // 🔒 bloquear solo estos
  document.getElementById("nombre").readOnly = true;
  document.getElementById("pn").readOnly = true;

  // ✏️ permitir edición SIEMPRE
  document.getElementById("ubicacion").disabled = false;
  document.getElementById("comentarios").readOnly = false;

  // limpiar sugerencias
  document.getElementById("sugerencias").innerHTML = "";
}


