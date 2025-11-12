import crypto from 'crypto';
import { logger } from '../utils/logger.js';

export const validateWebhook = (req, res, next) => {
    try {
        // Validar que existe el body
        if (!req.body) {
            return res.status(400).json({
                error: 'Body requerido',
                message: 'El webhook debe incluir datos en el body'
            });
        }

        // Validar signature si está configurado el secret
        if (process.env.WEBHOOK_SECRET) {
            const signature = req.get('X-Signature') || req.get('X-Hub-Signature-256');
            
            if (!signature) {
                logger.warn('🔒 Webhook sin signature', {
                    ip: req.ip,
                    userAgent: req.get('User-Agent')
                });
                return res.status(401).json({
                    error: 'Signature requerida',
                    message: 'El webhook debe incluir una signature válida'
                });
            }

            // Verificar la signature
            const payload = JSON.stringify(req.body);
            const expectedSignature = crypto
                .createHmac('sha256', process.env.WEBHOOK_SECRET)
                .update(payload)
                .digest('hex');

            const providedSignature = signature.replace('sha256=', '');

            if (!crypto.timingSafeEqual(
                Buffer.from(expectedSignature, 'hex'),
                Buffer.from(providedSignature, 'hex')
            )) {
                logger.warn('🔒 Signature inválida', {
                    ip: req.ip,
                    expected: expectedSignature,
                    provided: providedSignature
                });
                return res.status(401).json({
                    error: 'Signature inválida',
                    message: 'La signature del webhook no es válida'
                });
            }
        }

        // Validar estructura básica según el tipo de webhook
        if (req.path.includes('whatsapp')) {
            if (!validateWhatsAppWebhook(req.body)) {
                return res.status(400).json({
                    error: 'Estructura de webhook inválida',
                    message: 'El webhook de WhatsApp no tiene la estructura esperada'
                });
            }
        }

        next();
    } catch (error) {
        logger.error('❌ Error en validación de webhook', {
            error: error.message,
            body: req.body
        });
        
        return res.status(500).json({
            error: 'Error de validación',
            message: 'Error interno al validar el webhook'
        });
    }
};

// Validador específico para webhooks de WhatsApp/EvolutionAPI
const validateWhatsAppWebhook = (data) => {
    // Verificar estructura básica de EvolutionAPI
    if (data.event || data.data) {
        return true; // EvolutionAPI structure
    }

    // Verificar estructura de mensaje directo
    if (data.from && (data.body || data.type)) {
        return true; // Direct message structure
    }

    // Verificar estructura de evento de instancia
    if (data.instance && data.data) {
        return true; // Instance event structure
    }

    return false;
};

export default validateWebhook;