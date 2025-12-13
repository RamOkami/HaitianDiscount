/* ARCHIVO: assets/js/main.js */
import { initStorePage } from './storeLogic.js';
import { db, auth } from './config.js';
import { ref, set, get, remove, child, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// 1. INICIALIZAMOS LA LÓGICA COMPARTIDA
initStorePage({
    platformName: 'Steam',
    budgetRefString: 'presupuesto_steam',
    statusRefString: 'estado_steam'
});

// 2. LÓGICA ESPECÍFICA DE STEAM
document.addEventListener('DOMContentLoaded', () => {
    
    const btnBuscarSteam = document.getElementById('btnBuscarSteam');
    const inputUrlSteam = document.getElementById('steamUrlInput');
    const previewContainer = document.getElementById('previewContainer');
    const gameCoverImg = document.getElementById('gameCover');
    const cardWrapper = document.getElementById('cardWrapper');

    let currentGameData = null;

    if(btnBuscarSteam && inputUrlSteam) {
        
        // --- EVENTO: CLIC EN BUSCAR ---
        btnBuscarSteam.addEventListener('click', async () => {
            console.log("Buscando juego..."); 
            const url = inputUrlSteam.value;
            const regex = /app\/(\d+)/;
            const match = url.match(regex);
            
            if(previewContainer) previewContainer.style.display = 'none';

            if (!match) {
                window.Swal.fire('Link no válido', 'Usa un link de Steam válido (store.steampowered.com/app/...).', 'warning');
                return;
            }

            const appId = match[1];
            window.Swal.fire({ title: 'Buscando en Steam...', didOpen: () => window.Swal.showLoading() });

            try {
                const targetUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=cl`;
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
                
                const response = await fetch(proxyUrl);
                if (!response.ok) throw new Error('Error de conexión con el proxy');
                
                const steamData = await response.json();

                if (steamData[appId] && steamData[appId].success) {
                    const gameInfo = steamData[appId].data;
                    
                    currentGameData = {
                        id: appId,
                        name: gameInfo.name,
                        image: gameInfo.header_image,
                        url: `https://store.steampowered.com/app/${appId}/`
                    };

                    const inputJuego = document.getElementById('juego');
                    if(inputJuego) inputJuego.value = gameInfo.name;

                    if (gameInfo.header_image && previewContainer && gameCoverImg) {
                        gameCoverImg.src = gameInfo.header_image;
                        
                        const bgDiv = document.getElementById('gamePreviewBg');
                        if(bgDiv) {
                            bgDiv.style.backgroundImage = `url('${gameInfo.header_image}')`;
                            bgDiv.style.opacity = '1'; 
                        }

                        let wishBtn = document.getElementById('btnWishlistToggle');
                        if (!wishBtn) {
                            wishBtn = document.createElement('button');
                            wishBtn.id = 'btnWishlistToggle';
                            wishBtn.className = 'wishlist-btn';
                            wishBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
                            previewContainer.appendChild(wishBtn);
                            wishBtn.addEventListener('click', toggleWishlist);
                        }

                        checkWishlistStatus(appId);
                        previewContainer.style.display = 'block';
                    }

                    const inputPrecio = document.getElementById('precioSteam');
                    window.Swal.close();
                    const Toast = window.Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });

                    if (gameInfo.is_free) {
                        inputPrecio.value = 0;
                        Toast.fire({ icon: 'info', title: 'Juego Gratis' });
                    } else if (gameInfo.price_overview) {
                        let precio = gameInfo.price_overview.final / 100;
                        inputPrecio.value = precio;
                        inputPrecio.dispatchEvent(new Event('input')); 

                        // --- NUEVO: AUTO-CALCULAR PRECIO FINAL ---
                        // Disparamos el cálculo automáticamente tras cargar el precio
                        setTimeout(() => {
                            const btnCalc = document.getElementById('btnCalcular');
                            if(btnCalc) btnCalc.click();
                        }, 300); // Pequeña espera para que la UI se actualice primero
                        // -----------------------------------------

                        if(gameInfo.price_overview.discount_percent > 0) {
                            Toast.fire({ icon: 'success', title: `¡Oferta detectada! -${gameInfo.price_overview.discount_percent}%` });
                        } else {
                            Toast.fire({ icon: 'success', title: 'Datos cargados' });
                        }
                    } else {
                        Toast.fire({ icon: 'warning', title: 'Sin precio disponible' });
                    }
                } else {
                    throw new Error('Juego no encontrado o ID inválido');
                }
            } catch (error) {
                console.error("Error en búsqueda:", error);
                window.Swal.fire('Error', 'No pudimos cargar los datos. Intenta ingresarlos manualmente.', 'error');
            }
        });
    }

    // --- FUNCIONES WISHLIST ---
    async function toggleWishlist(e) {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) {
            window.Swal.fire('Inicia Sesión', 'Debes iniciar sesión para guardar en favoritos.', 'info');
            return;
        }
        if (!currentGameData) return;

        const btn = document.getElementById('btnWishlistToggle');
        const gameRef = child(ref(db), `usuarios/${user.uid}/wishlist/${currentGameData.id}`);

        if (btn.classList.contains('active')) {
            await remove(gameRef);
            btn.classList.remove('active');
            window.Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Eliminado de Deseados', showConfirmButton: false, timer: 1500 });
        } else {
            await set(gameRef, {
                nombre: currentGameData.name,
                imagen: currentGameData.image,
                url: currentGameData.url,
                fecha_agregado: new Date().toISOString()
            });
            btn.classList.add('active');
            if(window.confetti) window.confetti({ particleCount: 30, spread: 40, origin: { y: 0.6 }, colors: ['#ef4444', '#ffffff'] });
            window.Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Añadido a Deseados', showConfirmButton: false, timer: 1500 });
        }
    }

    async function checkWishlistStatus(appId) {
        const user = auth.currentUser;
        const btn = document.getElementById('btnWishlistToggle');
        if (!user || !btn) return;

        try {
            const snapshot = await get(child(ref(db), `usuarios/${user.uid}/wishlist/${appId}`));
            if (snapshot.exists()) btn.classList.add('active'); 
            else btn.classList.remove('active'); 
        } catch (e) { console.error(e); }
    }

    // --- AUTOCOMPLETADO + SCROLL (WISHLIST) ---
    const urlParams = new URLSearchParams(window.location.search);
    const autoLink = urlParams.get('auto');
    if (autoLink && inputUrlSteam && btnBuscarSteam) {
        inputUrlSteam.value = autoLink;
        
        // Corrección de Scroll para Wishlist
        const seccionPedido = document.getElementById('pedido');
        if (seccionPedido) {
            setTimeout(() => {
                seccionPedido.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }

        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => {
            console.log("Autocompletando compra...");
            btnBuscarSteam.click();
        }, 600);
    }

    // --- JUEGO DE LA SEMANA ---
    const weeklySection = document.getElementById('weeklyGameSection');
    
    onValue(child(ref(db), 'juego_semana'), async (snap) => {
        const data = snap.val();
        
        window.weeklyGameId = (data && data.activo) ? data.appid : null; 

        if (!data || !data.activo || !data.appid) {
            if(weeklySection) weeklySection.style.display = 'none';
            return;
        }

        const appId = data.appid;

        try {
            const targetUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=cl`;
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
            
            const response = await fetch(proxyUrl);
            const steamData = await response.json();

            if (steamData[appId] && steamData[appId].success) {
                const game = steamData[appId].data;
                const precio = game.price_overview ? (game.price_overview.final / 100) : 0;
                const precioFormateado = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(precio);
                
                // Lógica de Imagen Custom
                let imagenFinal = game.header_image;
                if (data.customImage && data.customImage.trim() !== "") {
                    imagenFinal = data.customImage;
                }

                weeklySection.innerHTML = `
                    <div class="weekly-banner" onclick="cargarJuegoSemana('${game.steam_appid}', '${game.name.replace(/'/g, "\\'")}')">
                        <div class="weekly-badge">🔥 JUEGO DE LA SEMANA</div>
                        
                        <div class="weekly-content">
                            <img src="${imagenFinal}" alt="${game.name}" class="weekly-img">
                            
                            <div class="weekly-info-col">
                                <h3>${game.name}</h3>
                                <p class="weekly-price">
                                    Precio Steam: <span style="text-decoration: line-through; opacity: 0.7;">${precioFormateado}</span>
                                </p>
                                <p class="weekly-cta">¡35% DE DESCUENTO EXTRA!</p>
                                <button class="btn btn-primary weekly-btn">Ver Oferta &rarr;</button>
                            </div>
                        </div>
                    </div>
                `;
                
                weeklySection.style.display = 'block';
                
                weeklySection.animate([
                    { opacity: 0, transform: 'translateY(20px)' },
                    { opacity: 1, transform: 'translateY(0)' }
                ], { duration: 500, easing: 'ease-out' });
            }

        } catch (error) {
            console.error("Error cargando juego de la semana:", error);
            weeklySection.style.display = 'none';
        }
    });

    window.cargarJuegoSemana = (appId, nombre) => {
        const inputUrl = document.getElementById('steamUrlInput');
        const btnBuscar = document.getElementById('btnBuscarSteam');
        
        if(inputUrl && btnBuscar) {
            inputUrl.value = `https://store.steampowered.com/app/${appId}/`;
            document.getElementById('pedido').scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => { btnBuscar.click(); }, 600);
        }
    };

    // --- EFECTO 3D ---
    if (previewContainer && cardWrapper && gameCoverImg) {
        previewContainer.addEventListener('mousemove', (e) => {
            const rect = previewContainer.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const maxRotation = 25; 
            let rotateY = ((mouseX - width / 2) / (width / 2)) * maxRotation;
            let rotateX = ((mouseY - height / 2) / (height / 2)) * -maxRotation;

            rotateX = Math.max(-maxRotation, Math.min(maxRotation, rotateX));
            rotateY = Math.max(-maxRotation, Math.min(maxRotation, rotateY));

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