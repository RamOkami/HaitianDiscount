/* ARCHIVO: public/assets/js/encuesta.js */
import { ref, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
// Al estar en la misma carpeta 'assets/js', importamos config.js directamente
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
                    // 1. Guardar en la orden privada (Como antes)
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

                    // 2. NUEVO: Guardar copia en lista pública (Sin datos sensibles)
                    // Nota: Usamos "Anónimo" o el nombre si pudiéramos obtenerlo, 
                    // para la versión pública simplificada usaremos un identificador genérico seguro.
                    await update(publicFeedbackRef, {
                        rating: rating,
                        comment: comment,
                        fecha: timestamp,
                        cliente: "Cliente Verificado" // Opcional: podrías pasar el nombre por URL si quisieras
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