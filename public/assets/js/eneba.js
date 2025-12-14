/* ARCHIVO: public/assets/js/eneba.js */
import { initStorePage } from './storeLogic.js';
import { db, auth } from './config.js';
import { ref, set, get, remove, child, query, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// 1. Inicializamos la lógica base
initStorePage({
    platformName: 'Eneba',
    budgetRefString: 'presupuesto_eneba',
    statusRefString: 'estado_eneba'
});

// Variable global para almacenar el juego actual en pantalla
let currentEnebaData = null;

// 2. Lógica de Scraping y Wishlist para Eneba
document.addEventListener('DOMContentLoaded', () => {
    const btnBuscar = document.getElementById('btnBuscarEneba');
    const inputUrl = document.getElementById('enebaUrlInput');
    const inputNombre = document.getElementById('juego');
    const previewContainer = document.getElementById('previewContainer');
    const gameCoverImg = document.getElementById('gameCover');
    const bgDiv = document.getElementById('gamePreviewBg');

    if (btnBuscar && inputUrl) {
        btnBuscar.addEventListener('click', async () => {
            const url = inputUrl.value.trim();

            // --- PASO 1: LIMPIEZA TOTAL INMEDIATA ---
            // Ocultamos el contenedor anterior para evitar confusiones visuales
            if(previewContainer) previewContainer.style.display = 'none';
            // Reseteamos la variable de datos
            currentEnebaData = null;
            // Reseteamos visualmente el botón si existe
            const existingBtn = document.getElementById('btnWishlistToggle');
            if (existingBtn) existingBtn.classList.remove('active');
            // ----------------------------------------

            if (!url.includes('eneba.com')) {
                Swal.fire('Link inválido', 'Por favor ingresa un link válido de Eneba.', 'warning');
                return;
            }

            Swal.fire({
                title: 'Analizando Eneba...',
                text: 'Obteniendo imagen y título exacto',
                didOpen: () => Swal.showLoading()
            });

            try {
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
                const response = await fetch(proxyUrl);
                if (!response.ok) throw new Error('No se pudo acceder a la página');

                const htmlText = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlText, 'text/html');

                const metaImg = doc.querySelector('meta[property="og:image"]');
                const imgUrl = metaImg ? metaImg.content : null;

                const h1Element = doc.querySelector('h1');
                let rawTitle = h1Element ? h1Element.innerText : '';

                if (!rawTitle || rawTitle.length < 3) {
                    const metaTitle = doc.querySelector('meta[property="og:title"]');
                    rawTitle = metaTitle ? metaTitle.content : '';
                }

                let title = rawTitle
                    .replace(/^Comprar\s+/i, '')
                    .replace(/^Buy\s+/i, '')
                    .replace(/\s+más barato.*/i, '')
                    .replace(/\s+al mejor precio.*/i, '')
                    .replace(/\s+\|\s+Eneba.*/i, '')
                    .replace(/\s+-\s+Eneba.*/i, '')
                    .trim();

                Swal.close();

                if (title && inputNombre) {
                    inputNombre.value = title;
                    
                    // Generamos ID único para el NUEVO juego
                    const cleanUrl = url.split('?')[0]; // Quitamos los parámetros extra
                    const gameId = btoa(cleanUrl).replace(/[^a-zA-Z0-9]/g, '').slice(-50);

                    // Actualizamos datos globales
                    currentEnebaData = {
                        id: gameId, 
                        name: title,
                        image: imgUrl,
                        url: url
                    };

                    if (imgUrl && previewContainer && gameCoverImg) {
                        gameCoverImg.src = imgUrl;
                        if(bgDiv) {
                            bgDiv.style.backgroundImage = `url('${imgUrl}')`;
                            bgDiv.style.opacity = '1';
                        }

                        // --- GESTIÓN ROBUSTA DEL BOTÓN ---
                        let wishBtn = document.getElementById('btnWishlistToggle');
                        
                        // Si no existe, lo creamos
                        if (!wishBtn) {
                            wishBtn = document.createElement('button');
                            wishBtn.id = 'btnWishlistToggle';
                            wishBtn.className = 'wishlist-btn';
                            wishBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
                            previewContainer.appendChild(wishBtn);
                        }

                        // TRUCO PRO: Clonamos el botón para eliminar TODOS los listeners anteriores
                        // Esto evita que al hacer clic se ejecute la lógica del juego viejo
                        const newBtn = wishBtn.cloneNode(true);
                        wishBtn.parentNode.replaceChild(newBtn, wishBtn);
                        
                        // Ahora 'newBtn' es un elemento limpio. Le agregamos el listener nuevo.
                        newBtn.classList.remove('active'); // Aseguramos que empiece vacío
                        newBtn.addEventListener('click', toggleWishlist);
                        
                        // Verificamos en DB si ESTE juego específico ya está guardado
                        checkWishlistStatus(currentEnebaData.id, newBtn);

                        previewContainer.style.display = 'block';
                        gameCoverImg.style.opacity = 0;
                        setTimeout(() => gameCoverImg.style.opacity = 1, 100);
                    }

                    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
                    Toast.fire({ icon: 'success', title: 'Datos cargados' });

                } else {
                    throw new Error('No se encontraron metadatos');
                }

            } catch (error) {
                console.error(error);
                Swal.fire({
                    icon: 'error',
                    title: 'Ups...',
                    text: 'No pudimos leer los datos automáticamente. Por favor, llena el nombre manualmente.',
                });
                if(previewContainer) previewContainer.style.display = 'none';
            }
        });
    }

    async function toggleWishlist(e) {
        e.preventDefault();
        const user = auth.currentUser;
        
        // Validación 1: Usuario Logueado
        if (!user) {
            Swal.fire('Inicia Sesión', 'Debes iniciar sesión para guardar en favoritos.', 'info');
            return;
        }
        
        // Validación 2: Datos cargados correctamente
        if (!currentEnebaData || !currentEnebaData.id) {
            console.warn("No hay datos de juego cargados");
            return;
        }

        const btn = e.currentTarget; // Usamos el botón que disparó el evento
        const gameRef = child(ref(db), `usuarios/${user.uid}/wishlist/${currentEnebaData.id}`);

        // Deshabilitar botón momentáneamente para evitar doble clic
        btn.style.pointerEvents = 'none';

        try {
            if (btn.classList.contains('active')) {
                // ELIMINAR
                await remove(gameRef);
                btn.classList.remove('active');
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Eliminado de Deseados', showConfirmButton: false, timer: 1500 });
            } else {
                // AGREGAR
                await set(gameRef, {
                    nombre: currentEnebaData.name,
                    imagen: currentEnebaData.image,
                    url: currentEnebaData.url,
                    fecha_agregado: new Date().toISOString()
                });
                btn.classList.add('active');
                if(window.confetti) window.confetti({ particleCount: 30, spread: 40, origin: { y: 0.6 }, colors: ['#a855f7', '#ffffff'] });
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Añadido a Deseados', showConfirmButton: false, timer: 1500 });
            }
        } catch (err) {
            console.error(err);
            Swal.fire('Error', 'No se pudo actualizar la lista.', 'error');
        } finally {
            // Rehabilitar botón
            btn.style.pointerEvents = 'auto';
        }
    }

    async function checkWishlistStatus(gameId, btnElement) {
        const user = auth.currentUser;
        if (!user || !btnElement) return;

        try {
            const snapshot = await get(child(ref(db), `usuarios/${user.uid}/wishlist/${gameId}`));
            if (snapshot.exists()) {
                btnElement.classList.add('active'); 
            } else {
                btnElement.classList.remove('active'); 
            }
        } catch (e) { 
            console.error(e); 
        }
    }

    // --- LÓGICA DE REGALO / AUTO-COMPLETE ---
    const urlParams = new URLSearchParams(window.location.search);
    const autoLink = urlParams.get('auto');
    const giftTo = urlParams.get('gift_to');

    if (autoLink) {
        if (inputUrl && btnBuscar) {
            inputUrl.value = autoLink;
            if (giftTo) {
                const inputDetalles = document.getElementById('detalles');
                if(inputDetalles) inputDetalles.value = `Regalo para: ${giftTo} (Key Eneba)`;
                
                setTimeout(() => {
                    Swal.fire({
                        title: '🎁 Modo Regalo Activado',
                        text: `Estás cotizando una Key de Eneba para ${giftTo}.`,
                        icon: 'info',
                        confirmButtonText: 'Entendido',
                        confirmButtonColor: '#a855f7'
                    });
                }, 1000);
            }
            const seccionPedido = document.getElementById('pedido');
            if (seccionPedido) setTimeout(() => seccionPedido.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
            window.history.replaceState({}, document.title, window.location.pathname);
            setTimeout(() => btnBuscar.click(), 600);
        }
    }
    
    // Animación 3D
    if (previewContainer && document.getElementById('cardWrapper')) {
        const cardWrapper = document.getElementById('cardWrapper');
        previewContainer.addEventListener('mousemove', (e) => {
            const rect = previewContainer.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const maxRotation = 25; 
            let rotateY = ((mouseX - width / 2) / (width / 2)) * maxRotation;
            let rotateX = ((mouseY - height / 2) / (height / 2)) * -maxRotation;
            const bgX = (mouseX / width) * 100;
            const bgY = (mouseY / height) * 100;
            requestAnimationFrame(() => {
                cardWrapper.style.setProperty('--rotate-x', `${rotateX}deg`);
                cardWrapper.style.setProperty('--rotate-y', `${rotateY}deg`);
                cardWrapper.style.setProperty('--bg-x', `${bgX}%`);
                cardWrapper.style.setProperty('--bg-y', `${bgY}%`);
                cardWrapper.style.setProperty('--show-shine', '1');
            });
        });
        previewContainer.addEventListener('mouseleave', () => {
            requestAnimationFrame(() => {
                cardWrapper.style.setProperty('--rotate-x', '0deg');
                cardWrapper.style.setProperty('--rotate-y', '0deg');
                cardWrapper.style.setProperty('--show-shine', '0');
            });
        });
    }
});

// =========================================
// >>> NUEVA LÓGICA DE CARGA DE FEEDBACK <<<
// =========================================

async function loadFeedback() {
    const feedbackContainer = document.getElementById('feedback-container');
    
    // NUEVO: Consultamos el nodo público
    const feedbackQuery = query(
        ref(db, 'feedbacks_publicos'),
        orderByChild('fecha'),
        limitToLast(4) 
    );

    try {
        const snapshot = await get(feedbackQuery);
        if (snapshot.exists()) {
            let feedbackHTML = '';
            const feedbacks = [];
            
            snapshot.forEach((childSnapshot) => {
                feedbacks.push(childSnapshot.val());
            });

            // Revertimos para que el más nuevo salga primero
            feedbacks.reverse();

            feedbacks.forEach((feedback) => {
                const rating = feedback.rating || 5; 
                const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
                
                const dateString = feedback.fecha || '';
                const safeDateString = dateString ? dateString.split('T')[0] : '';
                
                const clientName = feedback.cliente || 'Cliente HaitianDiscount';
                
                feedbackHTML += `
                    <div class="feedback-card">
                        <div class="rating">${stars}</div>
                        <p class="feedback-text">"${feedback.comment}"</p>
                        <div class="client-info">
                            <span class="client-name">${clientName}</span>
                            <span class="client-date">${safeDateString}</span>
                        </div>
                    </div>
                `;
            });
            
            feedbackContainer.innerHTML = feedbackHTML;
            
        } else {
            feedbackContainer.innerHTML = '<p style="text-align: center; color: var(--text-light);">Aún no tenemos valoraciones de clientes. ¡Sé el primero!</p>';
        }
    } catch (error) {
        console.error("Error al cargar el feedback:", error);
        feedbackContainer.innerHTML = '<p style="text-align: center; color: var(--text-light);">Cargando opiniones...</p>';
    }
}

document.addEventListener('DOMContentLoaded', loadFeedback);