/* ARCHIVO: assets/js/main.js */
import { initStorePage } from './storeLogic.js';
import { db, auth, fetchViaProxy } from './config.js';
import { ref, set, get, remove, child, onValue, query, orderByChild, equalTo, limitToLast } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
            const url = inputUrlSteam.value.trim();

            // 1. NUEVA REGEX: Acepta app, sub y bundle
            const regex = /(app|sub|bundle)\/(\d+)/;
            const match = url.match(regex);

            if(previewContainer) previewContainer.style.display = 'none';

            // --- NUEVO: SI NO ES UN LINK, BUSCAMOS POR NOMBRE ---
            if (!match) {
                if (url.length < 3) {
                    window.Swal.fire('Búsqueda inválida', 'Ingresa un link válido de Steam o al menos 3 letras para buscar por nombre.', 'warning');
                    return;
                }
                
                window.Swal.fire({ title: 'Buscando en Steam...', didOpen: () => window.Swal.showLoading() });
                
                try {
                    // API de búsqueda de Steam
                    const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(url)}&l=spanish&cc=cl`;
                    
                    const response = await fetchViaProxy(searchUrl);
                    const data = await response.json();
                    
                    if (data.total > 0 && data.items && data.items.length > 0) {
                        let htmlStr = '<div class="steam-search-results">';
                        data.items.forEach(item => {
                            const imgUrl = item.tiny_image || `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${item.id}/capsule_sm_120.jpg`;
                            htmlStr += `
                                <div class="search-item" onclick="seleccionarJuegoBuscado('${item.id}')">
                                    <img src="${imgUrl}" alt="${item.name}">
                                    <div class="search-item-info">
                                        <strong>${item.name}</strong>
                                    </div>
                                </div>
                            `;
                        });
                        htmlStr += '</div>';
                        
                        window.Swal.fire({
                            title: 'Resultados de búsqueda',
                            html: htmlStr,
                            showConfirmButton: false,
                            showCloseButton: true,
                            width: '500px'
                        });
                        
                        if(!window.seleccionarJuegoBuscado) {
                            window.seleccionarJuegoBuscado = (appId) => {
                                window.Swal.close();
                                inputUrlSteam.value = `https://store.steampowered.com/app/${appId}/`;
                                btnBuscarSteam.click(); 
                            };
                        }
                        return;
                    } else {
                        window.Swal.fire('Sin resultados', 'No encontramos ningún juego con ese nombre en Steam.', 'info');
                        return;
                    }
                } catch (error) {
                    console.error("Error buscando por nombre:", error);
                    window.Swal.fire('Error', 'Hubo un problema con la búsqueda. Intenta con el link directo.', 'error');
                    return;
                }
            }

            const tipoItem = match[1]; // 'app', 'sub', o 'bundle'
            const itemId = match[2];

            window.Swal.fire({ title: 'Buscando en Steam...', didOpen: () => window.Swal.showLoading() });

            try {
                if (tipoItem === 'app' || tipoItem === 'sub') {
                    // --- LÓGICA PARA APPS Y SUBS (API OFICIAL) ---
                    const endpoint = tipoItem === 'app' ? 'appdetails?appids=' : 'packagedetails?packageids=';
                    const targetUrl = `https://store.steampowered.com/api/${endpoint}${itemId}&cc=cl`;

                    const response = await fetchViaProxy(targetUrl);
                    if (!response.ok) throw new Error('Error de conexión con el proxy');
                    const steamData = await response.json();

                    // Nota: 'packagedetails' no usa 'success' en la raíz, maneja la estructura dinámicamente
                    const itemData = steamData[itemId];
                    if (itemData && (itemData.success !== false)) { 
                        const gameInfo = itemData.data || itemData; 
                        
                        currentGameData = {
                            id: itemId,
                            name: gameInfo.name,
                            image: gameInfo.header_image || 'assets/img/logo.png',
                            url: url 
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

                            // --- BOTÓN WISHLIST (CORAZÓN - DERECHA) ---
                            let wishBtn = document.getElementById('btnWishlistToggle');
                            if (!wishBtn) {
                                wishBtn = document.createElement('button');
                                wishBtn.id = 'btnWishlistToggle';
                                wishBtn.className = 'wishlist-btn';
                                wishBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
                                previewContainer.appendChild(wishBtn);
                                wishBtn.addEventListener('click', toggleWishlist);
                            }

                            // --- NUEVO: BOTÓN REQUISITOS (PC - IZQUIERDA) ---
                            let reqBtn = document.getElementById('btnReqToggle');
                            if (!reqBtn) {
                                reqBtn = document.createElement('button');
                                reqBtn.id = 'btnReqToggle';
                                reqBtn.className = 'req-btn';
                                reqBtn.title = 'Ver Requisitos del Sistema';
                                reqBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7l-2 3v1h8v-1l-2-3h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z"/></svg>';
                                previewContainer.appendChild(reqBtn);
                            }

                            // Verificar si Steam nos mandó los requisitos (no todos los juegos los traen)
                            if (tipoItem === 'app' && gameInfo.pc_requirements && (gameInfo.pc_requirements.minimum || gameInfo.pc_requirements.recommended)) {
                                reqBtn.style.display = 'flex'; // Mostrar botón
                                
                                let reqHtml = '<div class="steam-req-content">';
                                if (gameInfo.pc_requirements.minimum) reqHtml += gameInfo.pc_requirements.minimum;
                                if (gameInfo.pc_requirements.recommended) reqHtml += '<hr>' + gameInfo.pc_requirements.recommended;
                                reqHtml += '</div>';

                                reqBtn.onclick = (e) => {
                                    e.preventDefault();
                                    window.Swal.fire({
                                        title: 'Requisitos del Sistema',
                                        html: reqHtml,
                                        width: '600px',
                                        confirmButtonText: 'Cerrar',
                                        confirmButtonColor: 'var(--accent)'
                                    });
                                };
                            } else {
                                reqBtn.style.display = 'none'; // Ocultar si es un juego viejo sin info
                            }

                            checkWishlistStatus(itemId);
                            previewContainer.style.display = 'block';
                        }

                        const inputPrecio = document.getElementById('precioSteam');
                        
                        window.Swal.close();
                        const Toast = window.Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });

                        // Manejo de precio para app y sub
                        if (gameInfo.is_free) {
                            inputPrecio.value = 0;
                            Toast.fire({ icon: 'info', title: 'Juego Gratis' });
                        } else if (gameInfo.price_overview || gameInfo.price) {
                            let precioObj = gameInfo.price_overview || gameInfo.price;
                            let precio = (precioObj.final || precioObj.initial) / 100;
                            inputPrecio.value = precio;
                            inputPrecio.dispatchEvent(new Event('input'));

                            setTimeout(() => {
                                const btnCalc = document.getElementById('btnCalcular');
                                if(btnCalc) btnCalc.click();
                            }, 300);

                            if(precioObj.discount_percent > 0) {
                                Toast.fire({ icon: 'success', title: `¡Oferta detectada! -${precioObj.discount_percent}%` });
                            } else {
                                Toast.fire({ icon: 'success', title: 'Datos cargados' });
                            }
                        } else {
                            Toast.fire({ icon: 'warning', title: 'Sin precio disponible' });
                        }
                    } else {
                        throw new Error('Juego o Pack no encontrado en la API');
                    }

                } else if (tipoItem === 'bundle') {
                    // --- LÓGICA PARA BUNDLES (SCRAPING HTML VÍA PROXY) ---
                    
                    // 1. Forzamos la moneda a pesos chilenos añadiendo ?cc=cl al link
                    const bundleUrlObj = new URL(url);
                    bundleUrlObj.searchParams.set('cc', 'cl');
                    const targetBundleUrl = bundleUrlObj.toString();

                    const response = await fetchViaProxy(targetBundleUrl);

                    const htmlText = await response.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(htmlText, 'text/html');

                    // 2. Extraer Título
                    const titleEl = doc.querySelector('.pageheader');
                    let title = titleEl ? titleEl.innerText.trim() : '';
                    if (!title) {
                        const metaTitle = doc.querySelector('meta[property="og:title"]');
                        title = metaTitle ? metaTitle.content : 'Pack de Steam';
                    }

                    // 3. Extraer Imagen
                    const imgEl = doc.querySelector('.package_header');
                    let imgUrl = imgEl ? imgEl.src : '';
                    if (!imgUrl) {
                        const metaImg = doc.querySelector('meta[property="og:image"]');
                        imgUrl = metaImg ? metaImg.content : '';
                    }

                    // 4. Extraer Precio Final (Mejorado para packs)
                    // Buscamos clases específicas de bundles, o tomamos el ÚLTIMO precio de descuento en la página (el total)
                    let priceEl = doc.querySelector('.bundle_final_price_with_discount') || 
                                  doc.querySelector('.bundle_final_package_price') || 
                                  Array.from(doc.querySelectorAll('.discount_final_price')).pop();
                                  
                    let priceText = priceEl ? priceEl.innerText.replace(/[^0-9]/g, '') : '0';
                    let precioCalculado = parseInt(priceText, 10);

                    currentGameData = {
                        id: `bundle_${itemId}`,
                        name: title,
                        image: imgUrl,
                        url: url
                    };

                    const inputJuego = document.getElementById('juego');
                    if(inputJuego) inputJuego.value = title;

                    if (imgUrl && previewContainer && gameCoverImg) {
                        gameCoverImg.src = imgUrl;
                        const bgDiv = document.getElementById('gamePreviewBg');
                        if(bgDiv) {
                            bgDiv.style.backgroundImage = `url('${imgUrl}')`;
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

                        // --- OCULTAR REQUISITOS EN BUNDLES ---
                        let reqBtn = document.getElementById('btnReqToggle');
                        if (reqBtn) reqBtn.style.display = 'none';

                        checkWishlistStatus(currentGameData.id);
                        previewContainer.style.display = 'block';
                    }

                    const inputPrecio = document.getElementById('precioSteam');
                    window.Swal.close();
                    const Toast = window.Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });

                    // Si logramos extraer el precio, lo seteamos y autocalculamos
                    if (precioCalculado > 0) {
                        inputPrecio.value = precioCalculado;
                        inputPrecio.dispatchEvent(new Event('input'));

                        setTimeout(() => {
                            const btnCalc = document.getElementById('btnCalcular');
                            if(btnCalc) btnCalc.click();
                        }, 300);

                        Toast.fire({ icon: 'success', title: '¡Pack cargado con éxito!' });
                    } else {
                        Toast.fire({ icon: 'warning', title: 'Pack cargado. Por favor ingresa el precio manualmente.' });
                    }
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

    // --- AUTOCOMPLETADO + REGALO (STEAM) ---
    const urlParams = new URLSearchParams(window.location.search);
    const autoLink = urlParams.get('auto');
    const giftTo = urlParams.get('gift_to'); // <--- Nuevo parámetro

    if (autoLink && inputUrlSteam && btnBuscarSteam) {
        inputUrlSteam.value = autoLink;
        
        // Si es un regalo, pre-llenamos el campo detalles y avisamos
        if (giftTo) {
            const inputDetalles = document.getElementById('detalles');
            if(inputDetalles) {
                inputDetalles.value = `Regalo para: ${giftTo}`;
            }
            
            // Alerta visual bonita
            setTimeout(() => {
                Swal.fire({
                    title: '🎁 Modo Regalo Activado',
                    text: `Estás comprando este juego para ${giftTo}. Hemos anotado esto en los detalles del pedido.`,
                    icon: 'info',
                    confirmButtonText: '¡Genial!'
                });
            }, 1000);
        }

        const seccionPedido = document.getElementById('pedido');
        if (seccionPedido) {
            setTimeout(() => {
                seccionPedido.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }

        // Limpiamos la URL para que no moleste
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
        window.weeklyDiscount = (data && data.descuento) ? data.descuento : 35; 

        if (!data || !data.activo || !data.appid) {
            if(weeklySection) weeklySection.style.display = 'none';
            return;
        }

        const appId = data.appid;
        const discountText = window.weeklyDiscount; 

        try {
            const targetUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=cl`;
            
            const response = await fetchViaProxy(targetUrl);
            const steamData = await response.json();

            if (steamData[appId] && steamData[appId].success) {
                const game = steamData[appId].data;
                const precio = game.price_overview ? (game.price_overview.final / 100) : 0;
                const precioFormateado = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(precio);
                
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
                                <p class="weekly-cta">¡${discountText}% DE DESCUENTO EXTRA!</p>
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

    // --- FUNCIÓN CORREGIDA: SCROLL SUAVE + FOCO SEGURO ---
    window.cargarJuegoSemana = (appId, nombre) => {
        const inputUrl = document.getElementById('steamUrlInput');
        const btnBuscar = document.getElementById('btnBuscarSteam');
        const seccionPedido = document.getElementById('pedido');
        
        if(inputUrl && btnBuscar && seccionPedido) {
            // 1. Ponemos el link
            inputUrl.value = `https://store.steampowered.com/app/${appId}/`;
            
            // 2. Iniciamos el scroll SUAVE (animación del navegador)
            seccionPedido.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // 3. Esperamos 800ms a que la animación de bajada termine visualmente
            setTimeout(() => {
                // AHORA sí hacemos foco (para que no salte al cerrar Swal)
                inputUrl.focus({ preventScroll: true }); // preventScroll ayuda en navegadores modernos
                
                // Y hacemos clic en buscar
                btnBuscar.click();
            }, 800);
        }
    };
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