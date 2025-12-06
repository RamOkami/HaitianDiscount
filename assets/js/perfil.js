import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAVQm_MUEWQaf7NXzna2r4Sgbl5SeGNOyM",
    authDomain: "haitiandiscount.firebaseapp.com",
    databaseURL: "https://haitiandiscount-default-rtdb.firebaseio.com",
    projectId: "haitiandiscount",
    storageBucket: "haitiandiscount.firebasestorage.app",
    messagingSenderId: "521054591260",
    appId: "1:521054591260:web:a6b847b079d58b9e7942d9",
    measurementId: "G-EMVPQGPWTE"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const loginView = document.getElementById('loginView');
const userView = document.getElementById('userView');
const historyBody = document.getElementById('historyBody');
const noDataMsg = document.getElementById('noDataMsg');
const adminBtn = document.getElementById('adminBtn');

// *** LISTA DE ADMINISTRADORES ***
const ADMIN_UIDS = [
    'y7wKykEchQON3tS22mRhJURsHOv1', 
    'DEKH3yxMy6hCTkdbvwZl4dkFlnc2' 
];

// 1. Manejo de Sesión
document.getElementById('btnGoogleLogin').addEventListener('click', () => {
    signInWithPopup(auth, provider).catch(err => Swal.fire('Error', err.message, 'error'));
});

document.getElementById('btnLogout').addEventListener('click', () => {
    signOut(auth).then(() => window.location.reload());
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        // Usuario logueado
        loginView.classList.add('hidden');
        userView.classList.remove('hidden');
        
        document.getElementById('userName').innerText = `Hola, ${user.displayName}`;
        document.getElementById('userEmail').innerText = user.email;
        
        // --- LÓGICA DE VISIBILIDAD DEL BOTÓN ADMIN ---
        // Verificamos si el UID del usuario actual está en la lista de admins
        if (ADMIN_UIDS.includes(user.uid)) {
            adminBtn.classList.remove('hidden'); // Es admin: MOSTRAR botón
        } else {
            adminBtn.classList.add('hidden');    // No es admin: OCULTAR botón
        }

        cargarHistorial(user.uid);
    } else {
        // No hay usuario
        loginView.classList.remove('hidden');
        userView.classList.add('hidden');
    }
});

// 2. Cargar Datos
function cargarHistorial(uid) {
    const ordenesRef = query(ref(db, 'ordenes'), orderByChild('uid'), equalTo(uid));
    
    onValue(ordenesRef, (snapshot) => {
        historyBody.innerHTML = '';
        const data = snapshot.val();

        if (!data) {
            noDataMsg.style.display = 'block';
            return;
        }
        
        noDataMsg.style.display = 'none';
        
        const list = Object.values(data).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        list.forEach(orden => {
            const fecha = new Date(orden.fecha).toLocaleDateString('es-CL');
            const monto = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(orden.precio_pagado);
            const estado = orden.estado || 'pendiente';
            const plat = orden.plataforma || 'Steam';
            const platClass = plat === 'Eneba' ? 'platform-eneba' : 'platform-steam';

            const row = `
                <tr>
                    <td>${fecha}</td>
                    <td style="font-weight:600;">${orden.juego}</td>
                    <td class="${platClass}">${plat.toUpperCase()}</td>
                    <td>${monto}</td>
                    <td><span class="status-badge st-${estado}">${estado.toUpperCase()}</span></td>
                </tr>
            `;
            historyBody.innerHTML += row;
        });
    });
}

// Dark Mode
const btnTheme = document.getElementById('theme-toggle');
const body = document.body;
const iconSun = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM5.64,7.05a1,1,0,0,0,.7.29,1,1,0,0,0,.71-.29,1,1,0,0,0,0-1.41l-.71-.71A1,1,0,0,0,4.93,6.34Zm12,.29a1,1,0,0,0,.7-.29l.71-.71a1,1,0,1,0-1.41-1.41L17,5.64a1,1,0,0,0,0,1.41A1,1,0,0,0,17.66,7.34ZM21,11H20a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-9,8a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19ZM18.36,17A1,1,0,0,0,17,18.36l.71.71a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41ZM12,6.5A5.5,5.5,0,1,0,17.5,12,5.51,5.51,0,0,0,12,6.5Zm0,9A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z"/></svg>';
const iconMoon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z"/></svg>';

const currentTheme = localStorage.getItem('theme');
if (currentTheme === 'dark') {
    body.classList.add('dark-mode');
    btnTheme.innerHTML = iconSun;
} else {
    btnTheme.innerHTML = iconMoon;
}

btnTheme.addEventListener('click', () => {
    body.classList.toggle('dark-mode');
    if (body.classList.contains('dark-mode')) {
        localStorage.setItem('theme', 'dark');
        btnTheme.innerHTML = iconSun;
    } else {
        localStorage.setItem('theme', 'light');
        btnTheme.innerHTML = iconMoon;
    }
});