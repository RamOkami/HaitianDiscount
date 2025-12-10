/* ARCHIVO: assets/js/main.js */
import { initStorePage } from './storeLogic.js';
// NUEVOS IMPORTS PARA WISHLIST
import { db, auth } from './config.js';
import { ref, set, get, remove, child } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// 1. INICIALIZAMOS LA LÓGICA COMPARTIDA
initStorePage({
    platformName: 'Steam',
    budgetRefString: 'presupuesto_steam',
    statusRefString: 'estado_steam'
});

// 2. LÓGICA ESPECÍFICA DE STEAM + WISHLIST
document.addEventListener('DOMContentLoaded', () => {
    
    const btnBuscarSteam = document.getElementById('btnBuscarSteam');
    const inputUrlSteam = document.getElementById('steamUrlInput');
    const previewContainer = document.getElementById('previewContainer');
    const gameCoverImg = document.getElementById('gameCover');

    // Variable para guardar datos temporales del juego buscado
    let currentGameData = null;

    if(btnBuscarSteam && inputUrlSteam) {
        
        btnBuscarSteam.addEventListener('click', async () => {
            console.log("Buscando juego..."); 
            
            const url = inputUrlSteam.value;
            const regex = /app\/(\d+)/;
            const match = url.match(regex);
            
            if(previewContainer) previewContainer.style.display = 'none';

            if (!match) {
                window.Swal.fire('Link no válido', 'Usa un link de Steam válido.', 'warning');
                return;
            }

            const appId = match[1];
            window.Swal.fire({ title: 'Buscando en Steam...', didOpen: () => window.Swal.showLoading() });

            try {
                // Usamos corsproxy.io
                const targetUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=cl`;
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
                
                const response = await fetch(proxyUrl);
                if (!response.ok) throw new Error('Error de conexión');
                
                const steamData = await response.json();

                if (steamData[appId] && steamData[appId].success) {
                    const gameInfo = steamData[appId].data;
                    
                    // Guardamos datos para la Wishlist
                    currentGameData = {
                        id: appId,
                        name: gameInfo.name,
                        image: gameInfo.header_image,
                        url: `https://store.steampowered.com/app/${appId}/`
                    };

                    // 1. Rellenar Nombre
                    const inputJuego = document.getElementById('juego');
                    if(inputJuego) inputJuego.value = gameInfo.name;

                    // 2. Mostrar Portada + Botón Wishlist
                    if (gameInfo.header_image && previewContainer && gameCoverImg) {
                        gameCoverImg.src = gameInfo.header_image;
                        
                        // INYECTAR BOTÓN DE WISHLIST
                        // Verificamos si ya existe para no duplicarlo
                        let wishBtn = document.getElementById('btnWishlistToggle');
                        if (!wishBtn) {
                            wishBtn = document.createElement('button');
                            wishBtn.id = 'btnWishlistToggle';
                            wishBtn.className = 'wishlist-btn';
                            wishBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
                            previewContainer.appendChild(wishBtn);
                            
                            // Evento Click
                            wishBtn.addEventListener('click', toggleWishlist);
                        }

                        // Verificar estado inicial del botón (Si ya está en favoritos)
                        checkWishlistStatus(appId);

                        previewContainer.style.display = 'block';
                    }

                    // 3. Rellenar Precio
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

                        if(gameInfo.price_overview.discount_percent > 0) {
                            Toast.fire({ icon: 'success', title: `¡Oferta! -${gameInfo.price_overview.discount_percent}%` });
                        } else {
                            Toast.fire({ icon: 'success', title: 'Datos cargados' });
                        }
                    } else {
                        Toast.fire({ icon: 'warning', title: 'Sin precio disponible' });
                    }
                } else {
                    throw new Error('Juego no encontrado');
                }
            } catch (error) {
                console.error("Error:", error);
                window.Swal.fire('Error', 'No pudimos cargar los datos. Intenta manual.', 'error');
            }
        });
    }

    // --- FUNCIONES WISHLIST ---
    
    async function toggleWishlist(e) {
        e.preventDefault(); // Evitar que el botón haga submit si está dentro de un form
        const user = auth.currentUser;
        
        if (!user) {
            window.Swal.fire('Inicia Sesión', 'Debes iniciar sesión para guardar en favoritos.', 'info');
            return;
        }

        if (!currentGameData) return;

        const btn = document.getElementById('btnWishlistToggle');
        const gameRef = child(ref(db), `usuarios/${user.uid}/wishlist/${currentGameData.id}`);

        // Si ya tiene la clase active, es porque vamos a BORRAR
        if (btn.classList.contains('active')) {
            await remove(gameRef);
            btn.classList.remove('active');
            window.Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Eliminado de Deseados', showConfirmButton: false, timer: 1500 });
        } else {
            // Si no, vamos a GUARDAR
            await set(gameRef, {
                nombre: currentGameData.name,
                imagen: currentGameData.image,
                url: currentGameData.url,
                fecha_agregado: new Date().toISOString()
            });
            btn.classList.add('active');
            // Animación de confeti pequeña solo por gusto
            if(window.confetti) window.confetti({ particleCount: 50, spread: 40, origin: { y: 0.6 } });
            window.Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Añadido a Deseados', showConfirmButton: false, timer: 1500 });
        }
    }

    async function checkWishlistStatus(appId) {
        const user = auth.currentUser;
        const btn = document.getElementById('btnWishlistToggle');
        if (!user || !btn) return;

        try {
            const snapshot = await get(child(ref(db), `usuarios/${user.uid}/wishlist/${appId}`));
            if (snapshot.exists()) {
                btn.classList.add('active'); // Pintar rojo
            } else {
                btn.classList.remove('active'); // Pintar blanco
            }
        } catch (e) {
            console.error(e);
        }
    }
});