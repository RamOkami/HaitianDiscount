import { ref, onValue, runTransaction, get, child, push, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
// IMPORTAMOS TODO DESDE CONFIG (INCLUYENDO FUNCIONES NUEVAS)
import { db, auth, initTheme, initImageZoom, comprimirImagen, configurarValidacionRut } from './config.js';
// Iniciar Tema y Zoom
initTheme();
initImageZoom();

const saldoRef = ref(db, 'presupuesto_steam');
const estadoRef = ref(db, 'estado_steam');

const SERVICE_ID = 'service_jke4epd';    
const TEMPLATE_ID = 'template_0l9w69b'; 

let presupuestoActual = 0; 
const displayTope = document.getElementById('tope-dinero');
const inputPrecioFinal = document.getElementById('precioFinalInput');
const form = document.getElementById('gameForm');
const btnEnviar = document.getElementById('btnEnviar');
const btnCalc = document.querySelector('.btn-calc'); 
const inputComprobante = document.getElementById('comprobanteInput');
const inputRut = document.getElementById('rut');

let rutEsValido = false;

if(btnCalc) { btnCalc.addEventListener('click', calcularDescuento); }

// USAMOS LA VALIDACIÓN IMPORTADA
if(inputRut) { 
    configurarValidacionRut(inputRut, (estado) => {
        rutEsValido = estado;
    });
}

const formatoDinero = (valor) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(valor);

onValue(saldoRef, (snapshot) => {
    const data = snapshot.val();
    presupuestoActual = data || 0;
    displayTope.innerText = formatoDinero(presupuestoActual);
});

let tiendaAbierta = true; 
onValue(estadoRef, (snapshot) => {
    const estado = snapshot.val(); 
    if (estado === 'cerrado') {
        tiendaAbierta = false;
        btnEnviar.disabled = true;
        btnEnviar.innerText = "CERRADO TEMPORALMENTE";
        if(btnCalc) btnCalc.disabled = true;
        Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: 'Tienda Steam en Pausa', showConfirmButton: false, timer: 3000 });
    } else {
        tiendaAbierta = true;
        btnEnviar.innerText = "Enviar Pedido";
        if(btnCalc) btnCalc.disabled = false;
    }
});

const btnBuscarSteam = document.getElementById('btnBuscarSteam');
const inputUrlSteam = document.getElementById('steamUrlInput');
const previewContainer = document.getElementById('previewContainer');
const gameCoverImg = document.getElementById('gameCover');

if(btnBuscarSteam && inputUrlSteam) {
    btnBuscarSteam.addEventListener('click', async () => {
        const url = inputUrlSteam.value;
        const regex = /app\/(\d+)/;
        const match = url.match(regex);
        if(previewContainer) previewContainer.style.display = 'none';

        if (!match) {
            Swal.fire('Link no válido', 'Usa un link de Steam válido.', 'warning');
            return;
        }

        const appId = match[1];
        Swal.fire({ title: 'Buscando...', didOpen: () => Swal.showLoading() });

        try {
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(`https://store.steampowered.com/api/appdetails?appids=${appId}&cc=cl`)}`;
            const response = await fetch(proxyUrl);
            const dataWrapper = await response.json();
            const steamData = JSON.parse(dataWrapper.contents);

            if (steamData[appId] && steamData[appId].success) {
                const gameInfo = steamData[appId].data;
                const inputJuego = document.getElementById('juego');
                if(inputJuego) inputJuego.value = gameInfo.name;

                if (gameInfo.header_image && previewContainer && gameCoverImg) {
                    gameCoverImg.src = gameInfo.header_image;
                    previewContainer.style.display = 'block';
                }

                const inputPrecio = document.getElementById('precioSteam');
                if (gameInfo.is_free) {
                    inputPrecio.value = 0;
                } else if (gameInfo.price_overview) {
                    let precio = gameInfo.price_overview.final / 100;
                    inputPrecio.value = precio;
                    Swal.close();
                    const toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
                    if(gameInfo.price_overview.discount_percent > 0) {
                        toast.fire({ icon: 'success', title: `¡Oferta detectada! (-${gameInfo.price_overview.discount_percent}%)` });
                    } else {
                        toast.fire({ icon: 'success', title: 'Datos cargados' });
                    }
                }
            } else {
                throw new Error('Juego no encontrado');
            }
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'No pudimos cargar los datos. Ingrésalos manualmente.', 'error');
        }
    });
}

const inputPrecio = document.getElementById('precioSteam');
if(inputPrecio) {
    inputPrecio.addEventListener('input', function() {
        if (this.value.startsWith('0') && this.value.length > 1) this.value = this.value.substring(1);
        if (this.value < 0) this.value = Math.abs(this.value);
    });
}

function calcularDescuento() {
    if (!tiendaAbierta) return;
    const precioInput = document.getElementById('precioSteam').value;
    const codigoInput = document.getElementById('codigoInvitado').value.trim().toUpperCase(); 
    const inputCodigoElem = document.getElementById('codigoInvitado'); 
    inputCodigoElem.classList.remove('vip-active');

    if (!precioInput || precioInput <= 0) {
        Swal.fire('Faltan datos', 'Ingresa el precio del juego.', 'warning');
        return;
    }
    const precio = parseFloat(precioInput);

    if (codigoInput === "") {
        const descuento = 0.30; 
        const precioFinal = Math.round(precio * (1 - descuento));
        mostrarResultadosUI(precio, precioFinal, false);
        return; 
    }
    Swal.fire({ title: 'Verificando...', didOpen: () => Swal.showLoading() });
    get(child(ref(db), `codigos_vip/${codigoInput}`)).then((snapshot) => {
        Swal.close();
        let descuento = 0.30;
        let esVip = false;
        if (snapshot.exists()) {
            descuento = snapshot.val(); 
            esVip = true;
            inputCodigoElem.classList.add('vip-active'); 
        } else {
            Swal.fire('Código inválido', 'Se aplicará dcto estándar.', 'info');
        }
        const precioFinal = Math.round(precio * (1 - descuento));
        mostrarResultadosUI(precio, precioFinal, esVip, descuento);
    }).catch(() => {
        Swal.close();
        Swal.fire('Error', 'No se pudo verificar código.', 'error');
    });
}

function mostrarResultadosUI(precioOriginal, precioFinal, esVip, descuentoValor = 0.30) {
    const resultadoDiv = document.getElementById('resultado');
    resultadoDiv.style.display = 'block'; 
    const msjComprobante = document.getElementById('mensaje-comprobante');
    if(msjComprobante) msjComprobante.style.display = 'none';

    document.getElementById('res-original').innerText = formatoDinero(precioOriginal);
    const ahorro = precioOriginal - precioFinal;
    document.getElementById('res-ahorro').innerText = formatoDinero(ahorro);

    const resFinalElem = document.getElementById('res-final');
    resFinalElem.innerText = formatoDinero(precioFinal);
    inputPrecioFinal.value = formatoDinero(precioFinal);

    if (esVip) {
        resFinalElem.classList.add('text-vip');
        Swal.fire({ icon: 'success', title: '¡Código VIP!', text: `Descuento: ${Math.round(descuentoValor * 100)}%`, timer: 1500, showConfirmButton: false });
    } else {
        resFinalElem.classList.remove('text-vip');
    }

    const alerta = document.getElementById('alerta-presupuesto');
    if (precioFinal > presupuestoActual) {
        alerta.classList.remove('hidden');
        btnEnviar.disabled = true;
    } else {
        alerta.classList.add('hidden');
        btnEnviar.disabled = false; 
    }
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        const emailInput = document.getElementById('email');
        if (emailInput && !emailInput.value) emailInput.value = user.email;

        const userRef = ref(db, 'usuarios/' + user.uid);
        get(userRef).then((snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                
                const nombreInput = document.getElementById('nombre');
                if (nombreInput && data.nombre) nombreInput.value = data.nombre;

                const rutInput = document.getElementById('rut');
                if (rutInput && data.rut) {
                    rutInput.value = data.rut;
                    rutInput.dispatchEvent(new Event('input')); 
                }

                const steamInput = document.getElementById('steam_user');
                if (steamInput && data.steam_user) steamInput.value = data.steam_user;
                
                const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
                Toast.fire({ icon: 'info', title: 'Datos cargados de tu perfil' });
            }
        });
    }
});

form.addEventListener('submit', async function(event) {
    event.preventDefault(); 
    if (!tiendaAbierta || btnEnviar.disabled) return;

    if (!rutEsValido) {
        Swal.fire('RUT Inválido', 'Por favor ingresa un RUT chileno válido.', 'error');
        inputRut.focus();
        return;
    }

    if (!inputComprobante.files || inputComprobante.files.length === 0) {
        Swal.fire('Falta el Comprobante', 'Por favor adjunta la captura de la transferencia.', 'warning');
        return;
    }

    const precioSteamStr = document.getElementById('res-original').innerText;
    const costoSteam = parseInt(precioSteamStr.replace(/\D/g, '')); 
    const precioClienteStr = document.getElementById('res-final').innerText;
    const costoCliente = parseInt(precioClienteStr.replace(/\D/g, ''));

    if (costoSteam <= 100 || costoCliente <= 0) {
        Swal.fire('Error de Datos', 'Los montos no son válidos. Recarga e intenta de nuevo.', 'error');
        return;
    }

    // 1. INICIAR ALERTA CON FEEDBACK
    Swal.fire({ 
        title: 'Procesando Pedido', 
        html: 'Iniciando sistema...', // Texto inicial
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading() 
    });

    // Función auxiliar para actualizar el texto de carga
    const updateStatus = (texto) => {
        if(Swal.getHtmlContainer()) Swal.getHtmlContainer().textContent = texto;
    };

    try {
        // PASO 1: IMAGEN
        updateStatus('1/4 Optimizando imagen...');
        const comprobanteBase64 = await comprimirImagen(inputComprobante.files[0]);

        // PASO 2: VERIFICACIÓN
        updateStatus('2/4 Verificando cupo disponible...');
        
        runTransaction(saldoRef, (saldoActual) => {
            const actual = saldoActual || 0;
            if (actual >= costoSteam) return actual - costoSteam; 
            else return; 
        }).then((result) => {
            if (result.committed) {
                // PASO 3: GUARDAR EN DB
                updateStatus('3/4 Guardando tu pedido...');
                const user = auth.currentUser; 

                const nuevaOrdenRef = push(ref(db, 'ordenes'));
                set(nuevaOrdenRef, {
                    fecha: new Date().toISOString(),
                    email: form.email.value,
                    rut: form.rut.value, 
                    juego: form.juego.value,
                    precio_pagado: costoCliente, 
                    precio_steam: costoSteam,
                    estado: 'pendiente',
                    plataforma: 'Steam',
                    comprobante_img: comprobanteBase64,
                    uid: user ? user.uid : null 
                });

                // PASO 4: ENVIAR CORREO
                updateStatus('4/4 Enviando confirmación...');
                emailjs.sendForm(SERVICE_ID, TEMPLATE_ID, form).then(() => {
                    Swal.fire('¡Pedido Recibido!', 'Hemos recibido tu comprobante y pedido.', 'success');
                    form.reset();
                    rutEsValido = false; 
                    inputRut.style.borderColor = "var(--border)";
                    inputRut.style.boxShadow = "none";
                    
                    if(previewContainer) previewContainer.style.display = 'none';
                    document.getElementById('resultado').style.display = 'none';
                    btnEnviar.disabled = true;
                });
            } else {
                Swal.fire('Lo sentimos', 'Cupo de Steam agotado en este instante.', 'error');
            }
        });
    } catch (err) {
        console.error(err);
        Swal.fire('Error', 'Ocurrió un error al procesar la solicitud.', 'error');
    }
});