/* CONFIGURACIÓN INICIAL
   Edita este valor manualmente cuando quieras cambiar el saldo.
*/
let presupuestoActual = 50000; 

// KEYS DE EMAILJS (REEMPLÁZALAS CON LAS TUYAS)
const SERVICE_ID = 'service_896cvbo';   // Ej: service_x8ds9
const TEMPLATE_ID = 'template_s5dbw9i'; // Ej: template_34fd9

// Referencias
const displayTope = document.getElementById('tope-dinero');
const inputPrecioFinal = document.getElementById('precioFinalInput');
const form = document.getElementById('gameForm');
const btnEnviar = document.getElementById('btnEnviar');

// Formatear dinero
const formatoDinero = (valor) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(valor);
};

// Cargar presupuesto al inicio
document.addEventListener('DOMContentLoaded', () => {
    displayTope.innerText = formatoDinero(presupuestoActual);
});

// 1. CALCULAR DESCUENTO
function calcularDescuento() {
    const precioInput = document.getElementById('precioSteam').value;
    const resultadoDiv = document.getElementById('resultado');
    const alerta = document.getElementById('alerta-presupuesto');

    if (!precioInput || precioInput <= 0) {
        alert("Por favor ingresa un precio válido del juego.");
        return;
    }

    const precio = parseFloat(precioInput);
    const descuento = 0.30; 
    const precioFinal = Math.round(precio * (1 - descuento));

    resultadoDiv.style.display = 'block';
    document.getElementById('res-original').innerText = formatoDinero(precio);
    document.getElementById('res-final').innerText = formatoDinero(precioFinal);
    
    // Guardar en input oculto
    inputPrecioFinal.value = formatoDinero(precioFinal);

    // Validar presupuesto
    if (precioFinal > presupuestoActual) {
        alerta.style.display = 'block';
        btnEnviar.classList.remove('active'); 
        alert("Lo siento, el valor del juego supera mi tope actual.");
    } else {
        alerta.style.display = 'none';
        btnEnviar.classList.add('active');
    }
}

// 2. ENVIAR FORMULARIO CON EMAILJS
form.addEventListener('submit', function(event) {
    event.preventDefault(); // Evita que la página se recargue

    // Validación extra por seguridad
    if (!btnEnviar.classList.contains('active')) {
        alert("Primero debes calcular el descuento y verificar disponibilidad.");
        return;
    }

    // Cambiar texto del botón para feedback visual
    const textoOriginal = btnEnviar.innerText;
    btnEnviar.innerText = 'Enviando...';
    btnEnviar.disabled = true;

    // Enviar con EmailJS
    emailjs.sendForm(SERVICE_ID, TEMPLATE_ID, this)
        .then(() => {
            alert('¡Pedido enviado con éxito! Revisa tu correo (y spam) para la confirmación.');
            btnEnviar.innerText = textoOriginal;
            btnEnviar.disabled = false;
            form.reset(); // Limpiar formulario
            document.getElementById('resultado').style.display = 'none';
            btnEnviar.classList.remove('active');
        }, (error) => {
            alert('Hubo un error al enviar: ' + JSON.stringify(error));
            btnEnviar.innerText = textoOriginal;
            btnEnviar.disabled = false;
        });
});