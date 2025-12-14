/* ARCHIVO: public/assets/js/shared_wishlist.js */
import { ref, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { db, initTheme } from './config.js'; 

document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. LÓGICA DE MODO OSCURO (Manual + Importada)
    try {
        initTheme();
    } catch (e) {
        console.log("Aplicando tema manualmente...");
    }
    
    const themeBtn = document.getElementById('theme-toggle');
    const body = document.body;
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') body.classList.add('dark-mode');
    
    if(themeBtn) {
        const newBtn = themeBtn.cloneNode(true);
        themeBtn.parentNode.replaceChild(newBtn, themeBtn);
        
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            body.classList.toggle('dark-mode');
            localStorage.setItem('theme', body.classList.contains('dark-mode') ? 'dark' : 'light');
        });
    }

    // 2. OBTENER UID DE LA URL
    const params = new URLSearchParams(window.location.search);
    const targetUid = params.get('u');
    
    if (!targetUid) {
        showError();
        return;
    }

    try {
        // 3. CONSULTAR DATOS
        const nombrePromise = get(ref(db, `usuarios/${targetUid}/nombre`));
        const photoPromise = get(ref(db, `usuarios/${targetUid}/photoURL`));
        const wishlistPromise = get(ref(db, `usuarios/${targetUid}/wishlist`));

        const [nombreSnap, photoSnap, wishlistSnap] = await Promise.all([
            nombrePromise, photoPromise, wishlistPromise
        ]);

        if (nombreSnap.exists() || wishlistSnap.exists()) {
            
            // --- HEADER ---
            const nombre = nombreSnap.exists() ? nombreSnap.val() : "Usuario";
            const avatarFallback = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
            const photo = photoSnap.exists() ? photoSnap.val() : avatarFallback;

            const nameElem = document.getElementById('friendName');
            const avatarElem = document.getElementById('friendAvatar');
            
            if(nameElem) nameElem.innerText = nombre;
            
            if(avatarElem) {
                avatarElem.src = photo;
                avatarElem.onerror = function() {
                    this.src = avatarFallback;
                };
            }

            // --- GRID ---
            const grid = document.getElementById('wishlistGrid');
            const loadingElem = document.getElementById('loading');
            
            if(loadingElem) loadingElem.style.display = 'none';

            if (wishlistSnap.exists()) {
                const wishlist = wishlistSnap.val();
                let cardsHtml = '';
                let itemsCount = 0; // Contador para saber si hay juegos de Eneba
                
                Object.entries(wishlist).forEach(([key, item]) => {
                    // Validar datos básicos
                    if (!item.nombre || !item.url) return;

                    const isEneba = item.url.includes('eneba');

                    // >>> FILTRO: SI NO ES ENEBA, SALTAR <<<
                    if (!isEneba) return;

                    itemsCount++; // Encontramos uno válido

                    // Datos visuales (Ya sabemos que es Eneba)
                    const platformLabel = 'ENEBA';
                    const platformColor = '#a855f7'; // Morado

                    // Link de regalo
                    const giftLink = `../eneba.html?auto=${encodeURIComponent(item.url)}&gift_to=${encodeURIComponent(nombre)}`;

                    // Imagen
                    const gameImg = item.imagen || "../assets/img/logo.png";

                    cardsHtml += `
                        <div class="wish-card">
                            <div class="wish-img-container">
                                <img src="${gameImg}" class="wish-img" alt="${item.nombre}" onerror="this.src='../assets/img/logo.png'">
                            </div>
                            <div class="wish-body">
                                <span class="wish-platform" style="color: ${platformColor}; opacity: 0.9;">
                                    ${platformLabel}
                                </span>
                                <div class="wish-title" title="${item.nombre}">${item.nombre}</div>
                                
                                <a href="${item.url}" target="_blank" style="font-size:0.85rem; color:var(--text-light); text-decoration: none; margin-bottom: 20px; display: inline-flex; align-items: center; gap: 5px;">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                    Ver original
                                </a>
                                
                                <a href="${giftLink}" class="btn-gift">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg>
                                    REGALAR KEY
                                </a>
                            </div>
                        </div>
                    `;
                });
                
                if (itemsCount > 0) {
                    if(grid) grid.innerHTML = cardsHtml;
                } else {
                    // Si tenía juegos pero ninguno era de Eneba
                    if(grid) grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-light); padding: 20px;">Este usuario aún no tiene juegos de Eneba en su lista.</p>';
                }
                
            } else {
                if(grid) grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-light); padding: 20px;">Este usuario aún no tiene deseos guardados.</p>';
            }

        } else {
            console.warn("Usuario no encontrado o sin datos públicos.");
            showError();
        }
    } catch (error) {
        console.error("Error cargando perfil público:", error);
        showError();
    }
});

function showError() {
    const loadingElem = document.getElementById('loading');
    const errorElem = document.getElementById('errorMsg');
    
    if(loadingElem) loadingElem.style.display = 'none';
    if(errorElem) errorElem.style.display = 'block';
}