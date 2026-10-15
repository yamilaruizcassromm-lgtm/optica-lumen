import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY, MONEDA, LOCALE } from "./config.js";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (s) => document.querySelector(s);
const dinero = (n) => new Intl.NumberFormat(LOCALE, { style: "currency", currency: MONEDA }).format(n);
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let productos = [];
let filtro = "todos";
const carrito = new Map(); // producto_id -> cantidad

function dibujo(p) {
  const c = p.color || "#12263A";
  if (p.categoria === "contacto")
    return `<svg viewBox="0 0 200 120" role="img" aria-label="${esc(p.nombre)}"><circle cx="100" cy="60" r="40" fill="${c}" fill-opacity=".12" stroke="${c}" stroke-width="5"/><circle cx="100" cy="60" r="22" fill="none" stroke="${c}" stroke-width="3"/></svg>`;
  const relleno = p.categoria === "sol" ? `fill="${c}" fill-opacity=".8"` : `fill="#fff" fill-opacity=".6"`;
  return `<svg viewBox="0 0 200 120" role="img" aria-label="${esc(p.nombre)}"><g stroke="${c}" stroke-width="6" stroke-linecap="round"><rect x="14" y="34" width="74" height="54" rx="22" ${relleno}/><rect x="112" y="34" width="74" height="54" rx="22" ${relleno}/><path d="M88 52q12-10 24 0M14 48 4 40M186 48l10-8" fill="none"/></g></svg>`;
}

function pintarCatalogo() {
  const lista = productos.filter((p) => filtro === "todos" || p.categoria === filtro);
  $("#catalogo").innerHTML = lista.length
    ? lista.map((p) => `
      <article class="producto">
        <div class="foto">${p.imagen_url ? `<img src="${esc(p.imagen_url)}" alt="${esc(p.nombre)}" loading="lazy">` : dibujo(p)}</div>
        <div class="info">
          <span class="marca-p">${esc(p.marca)}</span>
          <h3>${esc(p.nombre)}</h3>
          <p>${esc(p.descripcion)}</p>
          <span class="precio">${dinero(p.precio)}</span>
          <button class="btn" data-add="${p.id}" ${p.stock < 1 ? "disabled" : ""}>${p.stock < 1 ? "Sin stock" : "Agregar al pedido"}</button>
        </div>
      </article>`).join("")
    : "<p>No hay productos en esta categoría todavía.</p>";
}

function totalCarrito() {
  let t = 0;
  carrito.forEach((q, id) => (t += q * productos.find((p) => p.id === id).precio));
  return t;
}

function pintarPedido() {
  $("#cuenta").textContent = [...carrito.values()].reduce((a, b) => a + b, 0);
  $("#lineas").innerHTML = carrito.size
    ? [...carrito].map(([id, q]) => {
        const p = productos.find((x) => x.id === id);
        return `<li><span class="nom">${esc(p.nombre)}<br>${dinero(p.precio)}</span>
          <button data-menos="${id}" aria-label="Quitar uno">−</button><span>${q}</span>
          <button data-mas="${id}" aria-label="Agregar uno">+</button></li>`;
      }).join("")
    : "<li>Tu pedido está vacío. Agrega lentes desde el catálogo.</li>";
  $("#total").textContent = dinero(totalCarrito());
  $("#datos button").disabled = carrito.size === 0;
}

function cambiar(id, delta) {
  const p = productos.find((x) => x.id === id);
  const q = (carrito.get(id) || 0) + delta;
  if (q <= 0) carrito.delete(id);
  else carrito.set(id, Math.min(q, p.stock));
  pintarPedido();
}

document.addEventListener("click", (e) => {
  const t = e.target;
  if (t.dataset.add) { cambiar(t.dataset.add, 1); $("#msg").textContent = ""; }
  if (t.dataset.mas) cambiar(t.dataset.mas, 1);
  if (t.dataset.menos) cambiar(t.dataset.menos, -1);
  if (t.dataset.f) {
    filtro = t.dataset.f;
    document.querySelectorAll("[data-f]").forEach((b) => b.setAttribute("aria-pressed", b === t));
    pintarCatalogo();
  }
});
$("#abrir-pedido").addEventListener("click", () => $("#pedido").showModal());

$("#datos").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const msg = $("#msg");
  msg.className = ""; msg.textContent = "Enviando pedido…";
  const id = crypto.randomUUID();
  const { error: e1 } = await db.from("pedidos").insert({
    id, cliente_nombre: f.get("nombre"), telefono: f.get("telefono"),
    email: f.get("email") || null, total: totalCarrito(),
  });
  const items = [...carrito].map(([pid, q]) => ({
    pedido_id: id, producto_id: pid, cantidad: q,
    precio_unitario: productos.find((p) => p.id === pid).precio,
  }));
  const { error: e2 } = e1 ? { error: e1 } : await db.from("pedido_items").insert(items);
  if (e2) { msg.className = "error"; msg.textContent = "No pudimos enviar el pedido. Revisa tu conexión e inténtalo otra vez."; return; }
  carrito.clear(); e.target.reset(); pintarPedido();
  msg.textContent = "Pedido enviado. Te llamaremos para confirmar el retiro.";
});

(async function iniciar() {
  const { data, error } = await db.from("productos").select("*").eq("activo", true).order("creado_en");
  if (error) { $("#catalogo").innerHTML = "<p>No pudimos cargar el catálogo. Inténtalo de nuevo en unos minutos.</p>"; return; }
  productos = data; pintarCatalogo(); pintarPedido();
})();