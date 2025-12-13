/* ARCHIVO: public/assets/js/encuesta.js */
import { ref, update, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { db } from './config.js';

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order');
    let rating = urlParams.get('rating'); 

    const feedbackContent = document.getElementById('feedback-content');
    const successMessage = document.getElementById('success-message');
    const ratingStars = document.getElementById('rating-stars');
    const ratingStatus = document.getElementById('rating-status');
    const orderIdDisplay = document.getElementById('order-id-display');
    const feedbackForm = document.getElementById('feedback-form');
    const submitBtn = document.getElementById('submit-btn');
    const loader = document.getElementById('loader');

    if (!orderId || !rating) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Parámetros de pedido y calificación faltantes.',
        });
        if(loader) loader.style.display = 'none';
        
    } else {
        rating = parseInt(rating);
        if(orderIdDisplay) orderIdDisplay.textContent = orderId;
        if(feedbackContent) feedbackContent.style.display = 'block';

        // Estilos y texto según la calificación inicial
        switch (rating) {
            case 5:
                ratingStars.textContent = '⭐⭐⭐⭐⭐';
                ratingStatus.textContent = '¡Excelente Experiencia!';
                ratingStatus.style.backgroundColor = 'var(--success-color)';
                break;
            case 3:
                ratingStars.textContent = '⭐⭐⭐';
                ratingStatus.textContent = 'Experiencia Normal';
                ratingStatus.style.backgroundColor = 'var(--warning-color)';
                break;
            case 1:
                ratingStars.textContent = '⭐';
                ratingStatus.textContent = 'Experiencia Negativa';
                ratingStatus.style.backgroundColor = 'var(--error-color)';
                break;
            default:
                ratingStars.textContent = 'N/A';
                ratingStatus.textContent = 'Calificación Desconocida';
                ratingStatus.style.backgroundColor = '#6b7280';
                break;
        }

        // Listener para el formulario
        if(feedbackForm) {
            feedbackForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                submitBtn.disabled = true;
                submitBtn.textContent = 'Enviando...';

                const comment = document.getElementById('comment').value.trim();
                const timestamp = new Date().toISOString();

                try {
                    // --- PASO 1: OBTENER EL NOMBRE REAL ---
                    // Consultamos la orden para saber quién la hizo antes de guardar
                    const orderRef = ref(db, `ordenes/${orderId}`);
                    const snapshot = await get(orderRef);
                    
                    let nombreCliente = "Cliente Verificado"; // Valor por defecto

                    if (snapshot.exists()) {
                        const data = snapshot.val();
                        // Lógica de Prioridad: 
                        // 1. Usar el campo 'nombre' si existe
                        // 2. Si no, usar la primera parte del email
                        if (data.nombre && data.nombre.trim().length > 0) {
                            nombreCliente = data.nombre;
                        } else if (data.email) {
                            nombreCliente = data.email.split('@')[0];
                        }
                    }

                    // --- PASO 2: GUARDAR FEEDBACK ---
                    const feedbackRef = ref(db, `ordenes/${orderId}/feedback`);
                    const publicFeedbackRef = ref(db, `feedbacks_publicos/${orderId}`);

                    const feedbackData = {
                        rating: rating,
                        comment: comment,
                        fecha_feedback: timestamp,
                        feedback_recibido: true
                    };

                    // Actualizamos la orden privada
                    await update(feedbackRef, feedbackData);

                    // Guardamos copia pública con el NOMBRE REAL recuperado
                    await update(publicFeedbackRef, {
                        rating: rating,
                        comment: comment,
                        fecha: timestamp,
                        cliente: nombreCliente 
                    });

                    feedbackContent.style.display = 'none';
                    successMessage.style.display = 'block';

                } catch (error) {
                    console.error("Error al guardar el feedback en Firebase:", error);
                    Swal.fire('Error', 'No se pudo registrar tu opinión. Inténtalo más tarde.', 'error');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Enviar Opinión';
                }
            });
        }
    }
});