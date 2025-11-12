import axios from 'axios';
import { logger, logAPICall } from '../utils/logger.js';

class EvolutionAPIService {
    constructor() {
        this.baseURL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
        this.apiKey = process.env.EVOLUTION_API_KEY;
        this.instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'citamedica-bot';
        this.timeout = 30000; // 30 segundos

        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json',
                ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
            }
        });

        this.setupInterceptors();
    }

    setupInterceptors() {
        // Request interceptor
        this.client.interceptors.request.use(
            (config) => {
                config.metadata = { startTime: new Date() };
                logger.info(`📤 EvolutionAPI Request: ${config.method?.toUpperCase()} ${config.url}`);
                return config;
            },
            (error) => {
                logger.error('❌ EvolutionAPI Request Error', { error: error.message });
                return Promise.reject(error);
            }
        );

        // Response interceptor
        this.client.interceptors.response.use(
            (response) => {
                const responseTime = new Date() - response.config.metadata.startTime;
                logAPICall(
                    'EvolutionAPI',
                    response.config.url,
                    response.config.method?.toUpperCase(),
                    response.status,
                    responseTime
                );
                return response;
            },
            (error) => {
                const responseTime = error.config?.metadata ? 
                    new Date() - error.config.metadata.startTime : 0;
                
                logAPICall(
                    'EvolutionAPI',
                    error.config?.url || 'unknown',
                    error.config?.method?.toUpperCase() || 'unknown',
                    error.response?.status || 'error',
                    responseTime
                );
                
                logger.error('❌ EvolutionAPI Response Error', {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data,
                    url: error.config?.url
                });
                
                return Promise.reject(error);
            }
        );
    }

    /**
     * Envía un mensaje de texto a WhatsApp
     */
    async sendMessage(to, message, instance = this.instanceName) {
        try {
            const payload = {
                number: to.replace('@s.whatsapp.net', '').replace('+', ''),
                text: message
            };

            const response = await this.client.post(`/message/sendText/${instance}`, payload);

            logger.info('📱 Mensaje enviado exitosamente', {
                to,
                instance,
                messageLength: message.length
            });

            return response.data;

        } catch (error) {
            logger.error('❌ Error enviando mensaje', {
                to,
                instance,
                error: error.message,
                response: error.response?.data
            });
            throw new Error(`Error enviando mensaje: ${error.message}`);
        }
    }

    /**
     * Envía un mensaje con botones
     */
    async sendButtonMessage(to, text, buttons, instance = this.instanceName) {
        try {
            const payload = {
                number: to.replace('@s.whatsapp.net', '').replace('+', ''),
                text,
                buttons: buttons.map((btn, index) => ({
                    buttonId: btn.id || `btn_${index}`,
                    buttonText: { displayText: btn.text },
                    type: 1
                }))
            };

            const response = await this.client.post(`/message/sendButton/${instance}`, payload);

            logger.info('🔘 Mensaje con botones enviado', {
                to,
                instance,
                buttonsCount: buttons.length
            });

            return response.data;

        } catch (error) {
            logger.error('❌ Error enviando mensaje con botones', {
                error: error.message,
                response: error.response?.data
            });
            throw new Error(`Error enviando mensaje con botones: ${error.message}`);
        }
    }

    /**
     * Envía una lista de opciones
     */
    async sendListMessage(to, text, sections, instance = this.instanceName) {
        try {
            const payload = {
                number: to.replace('@s.whatsapp.net', '').replace('+', ''),
                text,
                buttonText: 'Ver opciones',
                sections
            };

            const response = await this.client.post(`/message/sendList/${instance}`, payload);

            logger.info('📋 Lista enviada', {
                to,
                instance,
                sectionsCount: sections.length
            });

            return response.data;

        } catch (error) {
            logger.error('❌ Error enviando lista', {
                error: error.message,
                response: error.response?.data
            });
            throw new Error(`Error enviando lista: ${error.message}`);
        }
    }

    /**
     * Obtiene información de la instancia
     */
    async getInstanceInfo(instance = this.instanceName) {
        try {
            const response = await this.client.get(`/instance/fetchInstances`);
            
            const instances = Array.isArray(response.data) ? response.data : [response.data];
            const instanceInfo = instances.find(inst => inst.instance?.instanceName === instance);

            return instanceInfo || null;

        } catch (error) {
            logger.error('❌ Error obteniendo info de instancia', {
                instance,
                error: error.message
            });
            throw new Error(`Error obteniendo info de instancia: ${error.message}`);
        }
    }

    /**
     * Verifica el estado de la conexión
     */
    async checkConnection(instance = this.instanceName) {
        try {
            const response = await this.client.get(`/instance/connectionState/${instance}`);
            return response.data;

        } catch (error) {
            logger.error('❌ Error verificando conexión', {
                instance,
                error: error.message
            });
            return { state: 'error', error: error.message };
        }
    }

    /**
     * Crea una nueva instancia
     */
    async createInstance(instanceName, webhookUrl) {
        try {
            const payload = {
                instanceName,
                token: this.apiKey,
                qrcode: true,
                webhook: webhookUrl
            };

            const response = await this.client.post('/instance/create', payload);

            logger.info('🆕 Instancia creada', {
                instanceName,
                webhookUrl
            });

            return response.data;

        } catch (error) {
            logger.error('❌ Error creando instancia', {
                instanceName,
                error: error.message
            });
            throw new Error(`Error creando instancia: ${error.message}`);
        }
    }

    /**
     * Configura webhook para la instancia
     */
    async setWebhook(webhookUrl, instance = this.instanceName) {
        try {
            const payload = {
                url: webhookUrl,
                events: [
                    'APPLICATION_STARTUP',
                    'QRCODE_UPDATED',
                    'CONNECTION_UPDATE',
                    'MESSAGES_UPSERT',
                    'MESSAGES_UPDATE',
                    'SEND_MESSAGE'
                ]
            };

            const response = await this.client.post(`/webhook/set/${instance}`, payload);

            logger.info('🔗 Webhook configurado', {
                instance,
                webhookUrl,
                events: payload.events.length
            });

            return response.data;

        } catch (error) {
            logger.error('❌ Error configurando webhook', {
                instance,
                webhookUrl,
                error: error.message
            });
            throw new Error(`Error configurando webhook: ${error.message}`);
        }
    }

    /**
     * Obtiene el QR Code para conectar WhatsApp
     */
    async getQRCode(instance = this.instanceName) {
        try {
            const response = await this.client.get(`/instance/qrcode/${instance}`);
            return response.data;

        } catch (error) {
            logger.error('❌ Error obteniendo QR Code', {
                instance,
                error: error.message
            });
            throw new Error(`Error obteniendo QR Code: ${error.message}`);
        }
    }

    /**
     * Formatea número de teléfono para WhatsApp
     */
    formatPhoneNumber(phone) {
        // Remover caracteres no numéricos
        const cleanPhone = phone.replace(/\D/g, '');
        
        // Agregar código de país si no está presente
        if (!cleanPhone.startsWith('549')) {
            return `549${cleanPhone}`;
        }
        
        return cleanPhone;
    }

    /**
     * Verifica si un número es válido para WhatsApp
     */
    async checkWhatsAppNumber(phone, instance = this.instanceName) {
        try {
            const formattedPhone = this.formatPhoneNumber(phone);
            
            const response = await this.client.post(`/chat/whatsappNumbers/${instance}`, {
                numbers: [formattedPhone]
            });

            return response.data;

        } catch (error) {
            logger.error('❌ Error verificando número de WhatsApp', {
                phone,
                error: error.message
            });
            throw new Error(`Error verificando número: ${error.message}`);
        }
    }
}

export default EvolutionAPIService;