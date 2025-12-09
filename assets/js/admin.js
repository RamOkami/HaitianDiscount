import { ref, onValue, set, update, remove, child, get, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
// IMPORTAMOS TODO DESDE CONFIG.JS
import { db, auth, provider, initTheme } from './config.js';

// INICIAR TEMA
initTheme();

// DOM Elements
const loginOverlay = document.getElementById('login-overlay');
const adminContent = document.getElementById('adminContent');
const vipList = document.getElementById('vipList');
const ordersList = document.getElementById('ordersList');
const loaderView = document.getElementById('loaderView');
const loginCard = document.getElementById('loginCard');

// 1. AUTH CON VERIFICACIÓN DE ROL EN DB
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const adminRef = ref(db, `admins/${user.uid}`);
        try {
            const snapshot = await get(adminRef);
            if (snapshot.exists() && snapshot.val() === true) {
                loginOverlay.style.display = 'none';
                adminContent.style.display = 'block';
                iniciarListeners(); 
            } else {
                throw new Error("No admin");
            }
        } catch (e) {
            Swal.fire({
                icon: 'error',
                title: 'Acceso Denegado',
                text: 'No tienes permisos de administrador.',
                allowOutsideClick: false
            }).then(() => {
                signOut(auth).then(() => window.location.href = "../index.html");
            });
        }
    } else {
        loginOverlay.style.display = 'flex';
        adminContent.style.display = 'none';
        loaderView.style.display = 'none'; 
        loginCard.style.display = 'block'; 
    }
});

document.getElementById('btnGoogleAdmin').addEventListener('click', () => {
    loginCard.style.display = 'none';
    loaderView.style.display = 'block';
    signInWithPopup(auth, provider).catch((error) => {
        loaderView.style.display = 'none';
        loginCard.style.display = 'block';
        Swal.fire('Error', error.message, 'error');
    });
});

document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    loginCard.style.display = 'none';
    loaderView.style.display = 'block';
    signInWithEmailAndPassword(auth, email, pass).catch(err => {
        loaderView.style.display = 'none';
        loginCard.style.display = 'block';
        Swal.fire('Error', 'Credenciales incorrectas', 'error');
    });
});

document.getElementById('btnLogout').addEventListener('click', () => {
    signOut(auth).then(() => window.location.reload());
});

// 2. DATA LISTENERS
function iniciarListeners() {
    
    // --- A. GESTIÓN STEAM ---
    const saldoSteamRef = ref(db, 'presupuesto_steam');
    const estadoSteamRef = ref(db, 'estado_steam');

    onValue(saldoSteamRef, (snap) => {
        const valor = snap.val() || 0;
        document.getElementById('budgetSteamDisplay').innerText = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(valor);
    });
    document.getElementById('btnUpdateBudgetSteam').addEventListener('click', () => {
        const inputVal = document.getElementById('newBudgetSteam').value;
        const nuevoMonto = parseInt(inputVal);
        if(inputVal !== "" && nuevoMonto >= 0) {
            set(saldoSteamRef, nuevoMonto).then(() => Swal.fire('Steam', 'Cupo actualizado', 'success'));
            document.getElementById('newBudgetSteam').value = '';
        }
    });

    let estadoActualSteam = '';
    onValue(estadoSteamRef, (snap) => {
        estadoActualSteam = snap.val() || 'abierto';
        document.getElementById('statusSteamDisplay').innerHTML = estadoActualSteam === 'abierto' 
            ? '<span class="status-badge status-open">ABIERTA ONLINE</span>' 
            : '<span class="status-badge status-closed">CERRADA TEMPORALMENTE</span>';
    });
    document.getElementById('btnToggleSteam').addEventListener('click', () => {
        const nuevo = estadoActualSteam === 'abierto' ? 'cerrado' : 'abierto';
        set(estadoSteamRef, nuevo);
    });

    // --- B. GESTIÓN ENEBA ---
    const saldoEnebaRef = ref(db, 'presupuesto_eneba');
    const estadoEnebaRef = ref(db, 'estado_eneba');

    onValue(saldoEnebaRef, (snap) => {
        const valor = snap.val() || 0;
        document.getElementById('budgetEnebaDisplay').innerText = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(valor);
    });
    document.getElementById('btnUpdateBudgetEneba').addEventListener('click', () => {
        const inputVal = document.getElementById('newBudgetEneba').value;
        const nuevoMonto = parseInt(inputVal);
        if(inputVal !== "" && nuevoMonto >= 0) {
            set(saldoEnebaRef, nuevoMonto).then(() => Swal.fire('Eneba', 'Cupo actualizado', 'success'));
            document.getElementById('newBudgetEneba').value = '';
        }
    });

    let estadoActualEneba = '';
    onValue(estadoEnebaRef, (snap) => {
        estadoActualEneba = snap.val() || 'abierto';
        document.getElementById('statusEnebaDisplay').innerHTML = estadoActualEneba === 'abierto' 
            ? '<span class="status-badge status-open">ABIERTA ONLINE</span>' 
            : '<span class="status-badge status-closed">CERRADA TEMPORALMENTE</span>';
    });
    document.getElementById('btnToggleEneba').addEventListener('click', () => {
        const nuevo = estadoActualEneba === 'abierto' ? 'cerrado' : 'abierto';
        set(estadoEnebaRef, nuevo);
    });

    // --- C. CÓDIGOS VIP ---
    const vipRef = ref(db, 'codigos_vip');
    onValue(vipRef, (snap) => {
        vipList.innerHTML = ''; 
        const codigos = snap.val();
        if(codigos) {
            Object.keys(codigos).forEach(key => {
                const descuento = codigos[key];
                vipList.innerHTML += `
                    <tr>
                        <td><strong>${key}</strong></td>
                        <td>${Math.round(descuento * 100)}%</td>
                        <td><button class="btn btn-danger btn-sm" onclick="borrarCodigo('${key}')">Eliminar</button></td>
                    </tr>`;
            });
        } else {
            vipList.innerHTML = '<tr><td colspan="3" style="text-align:center;">No hay códigos</td></tr>';
        }
    });

    document.getElementById('btnAddVip').addEventListener('click', () => {
        const code = document.getElementById('vipCodeName').value.trim().toUpperCase();
        const discount = parseFloat(document.getElementById('vipDiscount').value);
        if(code && discount > 0 && discount < 1) {
            set(child(vipRef, code), discount).then(() => {
                Swal.fire({ icon: 'success', title: 'Creado', text: `Código ${code}`, timer: 1500, showConfirmButton: false });
                document.getElementById('vipCodeName').value = '';
                document.getElementById('vipDiscount').value = '';
            });
        } else {
            Swal.fire('Error', 'Datos inválidos', 'warning');
        }
    });

    window.borrarCodigo = (key) => {
        Swal.fire({ title: '¿Eliminar?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí' }).then((r) => {
            if (r.isConfirmed) remove(child(vipRef, key));
        });
    };

    // --- D. HISTORIAL PEDIDOS CON FILTROS ---
    const ordenesRef = ref(db, 'ordenes');
    let todasLasOrdenes = []; 

    const searchInput = document.getElementById('searchInput');
    const filterStatus = document.getElementById('filterStatus');

    onValue(ordenesRef, (snap) => {
        const data = snap.val();
        todasLasOrdenes = []; 

        if (data) {
            todasLasOrdenes = Object.entries(data).map(([id, info]) => ({ id, ...info }))
                                    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        }
        renderizarTabla();
    });

    // --- RENDERIZADO AJUSTADO AL NUEVO FORMATO ---
    function renderizarTabla() {
        ordersList.innerHTML = '';
        const textoBusqueda = searchInput.value.toLowerCase();
        const estadoFiltro = filterStatus.value;

        const ordenesFiltradas = todasLasOrdenes.filter(orden => {
            const cumpleEstado = estadoFiltro === 'todos' || orden.estado === estadoFiltro;
            const email = (orden.email || '').toLowerCase();
            const rut = (orden.rut || '').toLowerCase();
            const juego = (orden.juego || '').toLowerCase();
            const cumpleBusqueda = email.includes(textoBusqueda) || rut.includes(textoBusqueda) || juego.includes(textoBusqueda);
            return cumpleEstado && cumpleBusqueda;
        });

        if (ordenesFiltradas.length === 0) {
            ordersList.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">No se encontraron pedidos.</td></tr>';
            return;
        }

        window.imagenesComprobantes = {}; 

        ordenesFiltradas.forEach(orden => {
            const id = orden.id;
            const fecha = new Date(orden.fecha).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit'});
            const monto = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(orden.precio_pagado);
            const estado = orden.estado || 'pendiente';
            const plat = orden.plataforma || 'Steam';
            const platStyle = plat === 'Eneba' ? 'color: #a855f7;' : 'color: #2563eb;';
            
            // Botón Comprobante (Sin Foto)
            let btnComprobante = '<span style="color:#ccc; font-size:0.7rem;">Sin foto</span>';
            if(orden.comprobante_img) {
                window.imagenesComprobantes[id] = orden.comprobante_img;
                // Botón más discreto debajo del precio
                btnComprobante = `<button class="btn btn-sm" style="background:transparent; border:1px solid #64748b; color:#64748b; padding:2px 6px; font-size:0.7rem; margin-top:4px;" onclick="verComprobante('${id}')">📷 Ver Foto</button>`;
            }

            const fila = `
                <tr>
                    <td style="font-size: 0.8rem; color: #64748b;">${fecha}</td>
                    
                    <td>
                        <div style="font-weight:600; font-size:0.9rem;">${orden.email}</div>
                        <div style="font-size:0.75rem; color:#64748b;">RUT: ${orden.rut || 'N/A'}</div>
                    </td>

                    <td>
                        <div style="${platStyle} font-weight: bold; font-size: 0.75rem; margin-bottom:2px;">${plat.toUpperCase()}</div>
                        <div style="font-weight:500; font-size:0.9rem;">${orden.juego}</div>
                    </td>
                    
                    <td>
                        <div style="font-weight:bold; font-size:0.95rem;">${monto}</div>
                        ${btnComprobante}
                    </td>
                    
                    <td>
                        <select onchange="cambiarEstado('${id}', this.value)" class="status-select status-${estado}">
                            <option value="pendiente" ${estado === 'pendiente' ? 'selected' : ''}>⏳ Pendiente</option>
                            <option value="completado" ${estado === 'completado' ? 'selected' : ''}>✅ Completado</option>
                            <option value="cancelado" ${estado === 'cancelado' ? 'selected' : ''}>🚫 Cancelado</option>
                        </select>
                    </td>

                    <td>
                        <button class="btn btn-danger btn-sm" onclick="borrarOrden('${id}')">X</button>
                    </td>
                </tr>
            `;
            ordersList.innerHTML += fila;
        });
    }

    searchInput.addEventListener('input', renderizarTabla);
    filterStatus.addEventListener('change', renderizarTabla);

    window.verComprobante = (id) => {
        const imgData = window.imagenesComprobantes[id];
        if(imgData) {
            Swal.fire({
                title: 'Comprobante',
                imageUrl: imgData,
                imageAlt: 'Comprobante de pago',
                showCloseButton: true,
                confirmButtonText: 'Cerrar'
            });
        }
    };

    // --- FUNCIÓN DE REEMBOLSO ---
    window.cambiarEstado = async (id, nuevoEstado) => {
        const ordenRef = ref(db, `ordenes/${id}`);
        
        try {
            const snapshot = await get(ordenRef);
            if (!snapshot.exists()) return;
            
            const orden = snapshot.val();
            const estadoAnterior = orden.estado;
            const costoOriginal = orden.precio_steam; 
            const plataforma = orden.plataforma;

            if (nuevoEstado === 'cancelado' && estadoAnterior !== 'cancelado') {
                
                let presupuestoRefStr = '';
                if (plataforma === 'Steam') presupuestoRefStr = 'presupuesto_steam';
                else if (plataforma === 'Eneba') presupuestoRefStr = 'presupuesto_eneba';

                if (presupuestoRefStr && costoOriginal > 0) {
                    const budgetRef = ref(db, presupuestoRefStr);
                    await runTransaction(budgetRef, (cupoActual) => {
                        return (cupoActual || 0) + costoOriginal;
                    });
                    
                    Swal.fire({
                        icon: 'info',
                        title: 'Cupo Reembolsado',
                        text: `Se han devuelto $${costoOriginal} al cupo de ${plataforma}.`,
                        timer: 2000,
                        showConfirmButton: false
                    });
                }
            }

            await update(ordenRef, { estado: nuevoEstado });
            
            const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
            Toast.fire({ icon: 'success', title: 'Estado actualizado' });

        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'No se pudo actualizar el estado', 'error');
        }
    };

    window.borrarOrden = (id) => {
        Swal.fire({ title: '¿Borrar?', text: "Se perderá el registro.", icon: 'warning', showCancelButton: true, confirmButtonText: 'Borrar' }).then((r) => {
            if (r.isConfirmed) remove(child(ordenesRef, id));
        });
    };
}

// --- LÓGICA DE PESTAÑAS (TABS) ---
document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // 1. Quitar clase active de todos
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            // 2. Activar el clickeado
            tab.classList.add('active');
            const targetId = tab.getAttribute('data-target');
            const targetContent = document.getElementById(targetId);
            if(targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
});