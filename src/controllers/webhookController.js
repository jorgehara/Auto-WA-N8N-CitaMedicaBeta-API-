import { logger, logWhatsAppMessage, logN8NWebhook, logEvolutionEvent } from '../utils/logger.js';
import EvolutionAPIService from '../services/evolutionAPIService.js';
import CitaMedicaService from '../services/citaMedicaService.js';
import MessageProcessor from '../services/messageProcessor.js';
import N8NService from '../services/n8nService.js';

class WebhookController {
    constructor() {
        this.evolutionAPI = new EvolutionAPIService();
        this.citaMedicaAPI = new CitaMedicaService();
        this.messageProcessor = new MessageProcessor(this.citaMedicaAPI, this.evolutionAPI);
        this.n8nService = new N8NService();
    }

    /**
     * Maneja mensajes entrantes de WhatsApp via EvolutionAPI
     */
    async handleWhatsAppMessage(req, res) {
        try {
            const messageData = req.body;
            
            // Log del mensaje recibido
            logWhatsAppMessage(messageData);

            // Respuesta inmediata al webhook
            res.status(200).json({ 
                success: true, 
                message: 'Mensaje recibido',
                timestamp: new Date().toISOString()
            });

            // Procesar mensaje de forma asíncrona
            this.processMessageAsync(messageData);

        } catch (error) {
            logger.error('❌ Error en handleWhatsAppMessage', {
                error: error.message,
                body: req.body
            });

            res.status(500).json({
                success: false,
                error: 'Error interno al procesar mensaje'
            });
        }
    }

    /**
     * Procesa el mensaje de forma asíncrona
     */
    async processMessageAsync(messageData) {
        try {
            // Extraer información del mensaje
            const messageInfo = this.extractMessageInfo(messageData);

            if (!messageInfo.isValidMessage) {
                logger.info('📝 Mensaje ignorado (no es texto válido)', { messageData });
                return;
            }

            // Procesar el mensaje a través del servicio de mensajes
            const response = await this.messageProcessor.processMessage(messageInfo);

            // Enviar respuesta si es necesaria
            if (response && response.reply) {
                await this.evolutionAPI.sendMessage(messageInfo.from, response.reply, messageInfo.instance);
            }

            // Notificar a N8N si es necesario
            if (response && response.notifyN8N) {
                await this.n8nService.triggerWorkflow(response.workflowData);
            }

        } catch (error) {
            logger.error('❌ Error en processMessageAsync', {
                error: error.message,
                messageData
            });

            // Enviar mensaje de error al usuario
            try {
                const messageInfo = this.extractMessageInfo(messageData);
                await this.evolutionAPI.sendMessage(
                    messageInfo.from,
                    process.env.BOT_ERROR_MESSAGE || 'Lo siento, ha ocurrido un error. Por favor, intenta de nuevo.',
                    messageInfo.instance
                );
            } catch (sendError) {
                logger.error('❌ Error al enviar mensaje de error', { error: sendError.message });
            }
        }
    }

    /**
     * Extrae información útil del mensaje
     */
    extractMessageInfo(messageData) {
        // Estructura para EvolutionAPI
        if (messageData.data && messageData.data.message) {
            const msg = messageData.data.message;
            return {
                from: msg.key.remoteJid || msg.key.participant,
                message: msg.conversation || msg.extendedTextMessage?.text || '',
                messageId: msg.key.id,
                instance: messageData.instance || 'default',
                type: msg.messageType || 'text',
                isValidMessage: !!(msg.conversation || msg.extendedTextMessage?.text),
                timestamp: new Date().toISOString(),
                isGroup: msg.key.remoteJid?.includes('@g.us') || false
            };
        }

        // Estructura directa
        if (messageData.from && messageData.body) {
            return {
                from: messageData.from,
                message: messageData.body,
                messageId: messageData.messageId || Date.now().toString(),
                instance: messageData.instance || 'default',
                type: messageData.type || 'text',
                isValidMessage: true,
                timestamp: new Date().toISOString(),
                isGroup: messageData.from?.includes('@g.us') || false
            };
        }

        // Estructura de evento
        if (messageData.event === 'messages.upsert' && messageData.data) {
            const message = messageData.data.messages?.[0];
            if (message) {
                return {
                    from: message.key.remoteJid,
                    message: message.conversation || message.extendedTextMessage?.text || '',
                    messageId: message.key.id,
                    instance: messageData.instance || 'default',
                    type: 'text',
                    isValidMessage: !!(message.conversation || message.extendedTextMessage?.text),
                    timestamp: new Date().toISOString(),
                    isGroup: message.key.remoteJid?.includes('@g.us') || false
                };
            }
        }

        return {
            isValidMessage: false,
            error: 'Formato de mensaje no reconocido'
        };
    }

    /**
     * Maneja webhooks de N8N
     */
    async handleN8NWebhook(req, res) {
        try {
            const webhookData = req.body;
            
            logN8NWebhook(
                webhookData.workflowId,
                'received',
                webhookData
            );

            // Procesar datos de N8N
            const result = await this.processN8NData(webhookData);

            res.status(200).json({
                success: true,
                result,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error('❌ Error en handleN8NWebhook', {
                error: error.message,
                body: req.body
            });

            res.status(500).json({
                success: false,
                error: 'Error al procesar webhook de N8N'
            });
        }
    }

    /**
     * Procesa datos provenientes de N8N
     */
    async processN8NData(webhookData) {
        // Aquí puedes procesar datos específicos que vienen de N8N
        // Por ejemplo, actualizaciones de citas, recordatorios, etc.
        
        logger.info('🔄 Procesando datos de N8N', { 
            workflowId: webhookData.workflowId,
            dataType: webhookData.type 
        });

        switch (webhookData.type) {
            case 'appointment_reminder':
                return await this.handleAppointmentReminder(webhookData.data);
            case 'appointment_confirmation':
                return await this.handleAppointmentConfirmation(webhookData.data);
            default:
                return { processed: true, type: 'generic' };
        }
    }

    /**
     * Maneja eventos de EvolutionAPI
     */
    async handleEvolutionEvent(req, res) {
        try {
            const eventData = req.body;
            
            logEvolutionEvent(
                eventData.event,
                eventData.instance,
                eventData.data
            );

            // Procesar evento específico
            await this.processEvolutionEvent(eventData);

            res.status(200).json({
                success: true,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error('❌ Error en handleEvolutionEvent', {
                error: error.message,
                body: req.body
            });

            res.status(500).json({
                success: false,
                error: 'Error al procesar evento de EvolutionAPI'
            });
        }
    }

    /**
     * Procesa eventos específicos de EvolutionAPI
     */
    async processEvolutionEvent(eventData) {
        switch (eventData.event) {
            case 'connection.update':
                logger.info('📡 Estado de conexión actualizado', eventData.data);
                break;
            case 'messages.upsert':
                // Ya manejado en handleWhatsAppMessage
                break;
            case 'instance.status':
                logger.info('📱 Estado de instancia', eventData.data);
                break;
            default:
                logger.info('📨 Evento no manejado', { event: eventData.event });
        }
    }

    /**
     * Endpoint de prueba para enviar mensajes
     */
    async testSendMessage(req, res) {
        try {
            const { to, message, instance } = req.body;

            if (!to || !message) {
                return res.status(400).json({
                    error: 'Faltan parámetros requeridos: to, message'
                });
            }

            const result = await this.evolutionAPI.sendMessage(to, message, instance);

            res.json({
                success: true,
                result,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error('❌ Error en testSendMessage', { error: error.message });
            
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Maneja recordatorios de citas
     */
    async handleAppointmentReminder(data) {
        // Implementar lógica de recordatorios
        logger.info('⏰ Procesando recordatorio de cita', data);
        return { processed: true, type: 'reminder' };
    }

    /**
     * Maneja confirmaciones de citas
     */
    async handleAppointmentConfirmation(data) {
        // Implementar lógica de confirmaciones
        logger.info('✅ Procesando confirmación de cita', data);
        return { processed: true, type: 'confirmation' };
    }
}

export default new WebhookController();