// 1. IMPORTS
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, set, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ==============================================================
// ⚠️ IMPORTANTE: PEGA AQUÍ TU CONFIGURACIÓN DE FIREBASE QUE YA FUNCIONA
// (La que tiene tu API KEY correcta)
// ==============================================================
const firebaseConfig = {
    apiKey: "AIzaSyAVQm_MUEWQaf7NXzna2r4Sgbl5SeGNOyM", // <--- NO BORRES LA TUYA
    authDomain: "haitiandiscount.firebaseapp.com",
    databaseURL: "https://haitiandiscount-default-rtdb.firebaseio.com",
    projectId: "haitiandiscount",
    storageBucket: "haitiandiscount.firebasestorage.app",
    messagingSenderId: "521054591260",
    appId: "1:521054591260:web:a6b847b079d58b9e7942d9",
    measurementId: "G-EMVPQGPWTE"
};
// ==============================================================

// Inicializar Apps
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app); 
const saldoRef = ref(db, 'presupuesto');

// EMAILJS
const SERVICE_ID = 'service_jke4epd';    
const TEMPLATE_ID = 'template_0l9w69b'; 

// Variables
let presupuestoActual = 0; 
const displayTope = document.getElementById('tope-dinero');
const inputPrecioFinal = document.getElementById('precioFinalInput');
const form = document.getElementById('gameForm');
const btnEnviar = document.getElementById('btnEnviar');

// Formateador
const formatoDinero = (valor) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(valor);

// --- ACTUALIZACIÓN EN TIEMPO REAL ---
onValue(saldoRef, (snapshot) => {
    const data = snapshot.val();
    presupuestoActual = data || 0;
    displayTope.innerText = formatoDinero(presupuestoActual);
    displayTope.style.color = '#fff';
    setTimeout(() => displayTope.style.color = '#00ff88', 300);
});

// --- LÓGICA CLIENTE (CALCULAR) ---
window.calcularDescuento = function() {
    const precioInput = document.getElementById('precioSteam').value;
    if (!precioInput || precioInput <= 0) {
        Swal.fire('¡Atención!', 'Ingresa el precio del juego.', 'warning');
        return;
    }
    const precio = parseFloat(precioInput);
    const descuento = 0.30; 
    const precioFinal = Math.round(precio * (1 - descuento));

    document.getElementById('resultado').style.display = 'block';
    document.getElementById('res-original').innerText = formatoDinero(precio);
    document.getElementById('res-final').innerText = formatoDinero(precioFinal);
    inputPrecioFinal.value = formatoDinero(precioFinal);

    if (precioFinal > presupuestoActual) {
        document.getElementById('alerta-presupuesto').style.display = 'block';
        btnEnviar.classList.remove('active'); 
        Swal.fire('Sin cupo', `Solo quedan ${formatoDinero(presupuestoActual)}`, 'error');
    } else {
        document.getElementById('alerta-presupuesto').style.display = 'none';
        btnEnviar.classList.add('active');
    }
}

// --- LÓGICA CLIENTE (ENVIAR PEDIDO) ---
form.addEventListener('submit', function(event) {
    event.preventDefault(); 
    if (!btnEnviar.classList.contains('active')) return;

    const precioStr = document.getElementById('res-final').innerText;
    const costoJuego = parseInt(precioStr.replace(/\D/g, '')); 

    Swal.fire({ title: 'Procesando...', didOpen: () => Swal.showLoading() });

    runTransaction(saldoRef, (saldoActual) => {
        const actual = saldoActual || 0;
        if (actual >= costoJuego) return actual - costoJuego; 
        else return; 
    }).then((result) => {
        if (result.committed) {
            emailjs.sendForm(SERVICE_ID, TEMPLATE_ID, this).then(() => {
                Swal.fire('¡Éxito!', 'Pedido enviado.', 'success');
                form.reset();
                document.getElementById('resultado').style.display = 'none';
                btnEnviar.classList.remove('active');
            });
        } else {
            Swal.fire('Error', 'Se agotó el cupo mientras comprabas.', 'error');
        }
    }).catch((err) => {
        Swal.fire('Error', 'Error de conexión.', 'error');
    });
});

// ==============================================================
// NUEVA LÓGICA DE ADMIN (TODO CON VENTANAS)
// ==============================================================

document.getElementById('btn-login-admin').addEventListener('click', async (e) => {
    e.preventDefault(); // Evita que el link recargue la página

    // 1. VENTANA DE LOGIN
    const { value: formValues } = await Swal.fire({
        title: 'Acceso Administrador',
        html:
            '<input id="swal-email" class="swal2-input" placeholder="Correo electrónico">' +
            '<input id="swal-password" type="password" class="swal2-input" placeholder="Contraseña">',
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Ingresar',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            return [
                document.getElementById('swal-email').value,
                document.getElementById('swal-password').value
            ]
        }
    });

    if (formValues) {
        const [email, password] = formValues;

        // Mostramos "Cargando..."
        Swal.fire({ title: 'Verificando...', didOpen: () => Swal.showLoading() });

        signInWithEmailAndPassword(auth, email, password)
            .then(() => {
                // 2. LOGIN EXITOSO -> ABRIR VENTANA DE SALDO
                abrirGestorDeSaldo();
            })
            .catch((error) => {
                Swal.fire('Error', 'Datos incorrectos: ' + error.code, 'error');
            });
    }
});

// Función separada para gestionar el saldo una vez logueado
async function abrirGestorDeSaldo() {
    const { value: nuevoMonto } = await Swal.fire({
        title: 'Gestión de Caja',
        html: `Saldo actual disponible: <br> <h2 style="color:#00ff88">${formatoDinero(presupuestoActual)}</h2>`,
        input: 'number',
        inputLabel: 'Ingresa el nuevo monto tope:',
        inputValue: presupuestoActual, // Pone el valor actual por defecto
        showCancelButton: true,
        confirmButtonText: 'Actualizar Saldo'
    });

    if (nuevoMonto) {
        set(saldoRef, parseInt(nuevoMonto))
            .then(() => {
                Swal.fire({
                    icon: 'success',
                    title: 'Actualizado',
                    text: `Nuevo saldo: ${formatoDinero(nuevoMonto)}`
                });
            })
            .catch((error) => {
                Swal.fire('Error', 'No tienes permisos o falló la conexión', 'error');
            });
    }
}