/* ARCHIVO: public/assets/js/eneba.js */
import { initStorePage } from './storeLogic.js';
import { db, auth, fetchViaProxy } from './config.js';
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
            if(previewContainer) previewContainer.style.display = 'none';
            currentEnebaData = null;
            const existingBtn = document.getElementById('btnWishlistToggle');
            if (existingBtn) existingBtn.classList.remove('active');
            // ----------------------------------------

            if (!url.includes('eneba.com')) {
                Swal.fire('Link inválido', 'Por favor ingresa un link válido de Eneba.', 'warning');
                return;
            }

            Swal.fire({
                title: 'Analizando Eneba...',
                text: 'Obteniendo datos y requisitos...',
                didOpen: () => Swal.showLoading()
            });

            try {
                const response = await fetchViaProxy(url);
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

                    
                // --- NUEVO: EXTRAER REQUISITOS (SCRAPING EN ENEBA MEJORADO Y LIMPIO) ---
                let reqHtml = '';
                
                // 1. Buscamos SOLO etiquetas de título principales (h2 o h3)
                const headings = Array.from(doc.querySelectorAll('h2, h3'));
                const targetHeading = headings.find(el => {
                    const text = el.textContent.toLowerCase().trim();
                    return text === 'requisitos del sistema' || text === 'system requirements';
                });

                if (targetHeading) {
                    let reqContainer = targetHeading.parentElement;

                    if (reqContainer && reqContainer.innerText.length > 2000) {
                        if (targetHeading.nextElementSibling) {
                            reqContainer = targetHeading.nextElementSibling;
                        }
                    }

                    if (reqContainer) {
                        // --- MAGIA DE LIMPIEZA ---
                        const clone = reqContainer.cloneNode(true);
                        
                        // A) Eliminamos los títulos grandes y botones (Ej: Pestaña "WINDOWS")
                        clone.querySelectorAll('h2, h3, h4, button, ul[role="tablist"]').forEach(el => el.remove());
                        
                        // B) Eliminamos textos sueltos molestos (por si Eneba los pone en spans o divs)
                        clone.querySelectorAll('span, p, div').forEach(el => {
                            if (el.children.length === 0) { // Solo tocamos elementos que sean texto final
                                const t = el.textContent.trim().toLowerCase();
                                if (t === 'windows' || t === 'requisitos mínimos del sistema' || t === 'minimum system requirements') {
                                    el.remove();
                                }
                            }
                        });

                        reqHtml = `<div class="steam-req-content">${clone.innerHTML}</div>`;
                    }
                }
                // ----------------------------------------------------

                Swal.close();

                if (title && inputNombre) {
                    inputNombre.value = title;
                    
                    const cleanUrl = url.split('?')[0]; 
                    const gameId = btoa(cleanUrl).replace(/[^a-zA-Z0-9]/g, '').slice(-50);

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

                        // --- GESTIÓN DEL BOTÓN FAVORITOS (CORAZÓN) ---
                        let wishBtn = document.getElementById('btnWishlistToggle');
                        if (!wishBtn) {
                            wishBtn = document.createElement('button');
                            wishBtn.id = 'btnWishlistToggle';
                            wishBtn.className = 'wishlist-btn';
                            wishBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
                            previewContainer.appendChild(wishBtn);
                        }

                        const newBtn = wishBtn.cloneNode(true);
                        wishBtn.parentNode.replaceChild(newBtn, wishBtn);
                        
                        newBtn.classList.remove('active'); 
                        newBtn.addEventListener('click', toggleWishlist);
                        checkWishlistStatus(currentEnebaData.id, newBtn);

                        // --- NUEVO: GESTIÓN DEL BOTÓN REQUISITOS (PC) ---
                        let reqBtn = document.getElementById('btnReqToggle');
                        if (!reqBtn) {
                            reqBtn = document.createElement('button');
                            reqBtn.id = 'btnReqToggle';
                            reqBtn.className = 'req-btn'; 
                            reqBtn.title = 'Ver Requisitos del Sistema';
                            reqBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7l-2 3v1h8v-1l-2-3h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z"/></svg>';
                            previewContainer.appendChild(reqBtn);
                        }

                        // Si logramos extraer los requisitos de la página, mostramos el botón
                        if (reqHtml && reqHtml.length > 50) {
                            reqBtn.style.display = 'flex';
                            
                            const newReqBtn = reqBtn.cloneNode(true);
                            reqBtn.parentNode.replaceChild(newReqBtn, reqBtn);

                            newReqBtn.onclick = (e) => {
                                e.preventDefault();
                                window.Swal.fire({
                                    title: 'Requisitos del Sistema',
                                    html: reqHtml,
                                    width: '600px',
                                    confirmButtonText: 'Cerrar',
                                    confirmButtonColor: '#a855f7' // Morado estilo Eneba
                                });
                            };
                        } else {
                            // Si el juego en Eneba no tiene listados los requisitos, ocultamos el botón
                            reqBtn.style.display = 'none'; 
                        }

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
        
        if (!user) {
            Swal.fire('Inicia Sesión', 'Debes iniciar sesión para guardar en favoritos.', 'info');
            return;
        }
        
        if (!currentEnebaData || !currentEnebaData.id) {
            console.warn("No hay datos de juego cargados");
            return;
        }

        const btn = e.currentTarget; 
        const gameRef = child(ref(db), `usuarios/${user.uid}/wishlist/${currentEnebaData.id}`);

        btn.style.pointerEvents = 'none';

        try {
            if (btn.classList.contains('active')) {
                await remove(gameRef);
                btn.classList.remove('active');
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Eliminado de Deseados', showConfirmButton: false, timer: 1500 });
            } else {
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