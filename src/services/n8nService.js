import axios from 'axios';
import { logger, logAPICall } from '../utils/logger.js';

class N8NService {
    constructor() {
        this.baseURL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678';
        this.protocol = process.env.N8N_PROTOCOL || 'http';
        this.host = process.env.N8N_HOST || 'localhost';
        this.port = process.env.N8N_PORT || '5678';
        this.timeout = 30000;

        this.client = axios.create({
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        this.setupInterceptors();
    }

    setupInterceptors() {
        // Request interceptor
        this.client.interceptors.request.use(
            (config) => {
                config.metadata = { startTime: new Date() };
                logger.info(`📤 N8N Request: ${config.method?.toUpperCase()} ${config.url}`);
                return config;
            },
            (error) => {
                logger.error('❌ N8N Request Error', { error: error.message });
                return Promise.reject(error);
            }
        );

        // Response interceptor
        this.client.interceptors.response.use(
            (response) => {
                const responseTime = new Date() - response.config.metadata.startTime;
                logAPICall(
                    'N8N',
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
                    'N8N',
                    error.config?.url || 'unknown',
                    error.config?.method?.toUpperCase() || 'unknown',
                    error.response?.status || 'error',
                    responseTime
                );
                
                logger.error('❌ N8N Response Error', {
                    status: error.response?.status,
                    data: error.response?.data,
                    url: error.config?.url
                });
                
                return Promise.reject(error);
            }
        );
    }

    /**
     * Construye la URL completa del webhook
     */
    buildWebhookURL(path) {
        if (path.startsWith('http')) {
            return path; // URL completa ya proporcionada
        }
        
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        return `${this.protocol}://${this.host}:${this.port}/webhook${cleanPath}`;
    }

    /**
     * Dispara un workflow específico via webhook
     */
    async triggerWorkflow(workflowData) {
        try {
            const { webhookPath, data, method = 'POST' } = workflowData;
            
            if (!webhookPath) {
                throw new Error('Se requiere webhookPath para disparar el workflow');
            }

            const url = this.buildWebhookURL(webhookPath);
            
            const response = await this.client({
                method,
                url,
                data: {
                    timestamp: new Date().toISOString(),
                    source: 'evolutionapi-bridge',
                    ...data
                }
            });

            logger.info('⚡ Workflow de N8N disparado', {
                webhookPath,
                method,
                dataKeys: Object.keys(data || {})
            });

            return response.data;

        } catch (error) {
            logger.error('❌ Error disparando workflow N8N', {
                workflowData,
                error: error.message,
                response: error.response?.data
            });
            throw new Error(`Error disparando workflow: ${error.message}`);
        }
    }

    /**
     * Envía datos de mensaje de WhatsApp a N8N
     */
    async sendMessageToN8N(messageData) {
        try {
            const webhookData = {
                webhookPath: '/whatsapp-message',
                data: {
                    message: messageData.message,
                    from: messageData.from,
                    messageId: messageData.messageId,
                    instance: messageData.instance,
                    timestamp: messageData.timestamp,
                    type: messageData.type,
                    isGroup: messageData.isGroup
                }
            };

            return await this.triggerWorkflow(webhookData);

        } catch (error) {
            logger.error('❌ Error enviando mensaje a N8N', {
                messageData,
                error: error.message
            });
            throw new Error(`Error enviando mensaje a N8N: ${error.message}`);
        }
    }

    /**
     * Envía datos de cita creada a N8N
     */
    async sendAppointmentToN8N(appointmentData) {
        try {
            const webhookData = {
                webhookPath: '/appointment-created',
                data: {
                    appointment: appointmentData,
                    eventType: 'appointment_created'
                }
            };

            return await this.triggerWorkflow(webhookData);

        } catch (error) {
            logger.error('❌ Error enviando cita a N8N', {
                appointmentData,
                error: error.message
            });
            throw new Error(`Error enviando cita a N8N: ${error.message}`);
        }
    }

    /**
     * Envía datos de sobreturno a N8N
     */
    async sendSobreturnoToN8N(sobreturnoData) {
        try {
            const webhookData = {
                webhookPath: '/sobreturno-created',
                data: {
                    sobreturno: sobreturnoData,
                    eventType: 'sobreturno_created'
                }
            };

            return await this.triggerWorkflow(webhookData);

        } catch (error) {
            logger.error('❌ Error enviando sobreturno a N8N', {
                sobreturnoData,
                error: error.message
            });
            throw new Error(`Error enviando sobreturno a N8N: ${error.message}`);
        }
    }

    /**
     * Dispara workflow de recordatorio
     */
    async triggerReminder(reminderData) {
        try {
            const webhookData = {
                webhookPath: '/reminder-trigger',
                data: {
                    ...reminderData,
                    eventType: 'reminder_trigger',
                    scheduledFor: reminderData.appointmentTime
                }
            };

            return await this.triggerWorkflow(webhookData);

        } catch (error) {
            logger.error('❌ Error disparando recordatorio', {
                reminderData,
                error: error.message
            });
            throw new Error(`Error disparando recordatorio: ${error.message}`);
        }
    }

    /**
     * Envía evento de error a N8N para logging/monitoring
     */
    async sendErrorToN8N(errorData) {
        try {
            const webhookData = {
                webhookPath: '/error-notification',
                data: {
                    error: errorData.error,
                    context: errorData.context,
                    metadata: errorData.metadata,
                    eventType: 'error_occurred',
                    severity: errorData.severity || 'error'
                }
            };

            return await this.triggerWorkflow(webhookData);

        } catch (error) {
            logger.error('❌ Error enviando error a N8N', {
                originalError: errorData,
                sendError: error.message
            });
            // No lanzar error aquí para evitar bucles infinitos
        }
    }

    /**
     * Verifica la conectividad con N8N
     */
    async healthCheck() {
        try {
            // Intentar hacer ping a un webhook de health check
            const response = await this.client.get(
                this.buildWebhookURL('/health-check'),
                { timeout: 5000 }
            );

            return {
                status: 'healthy',
                response: response.data,
                url: this.baseURL
            };

        } catch (error) {
            logger.warn('⚠️ N8N no disponible', {
                error: error.message,
                url: this.baseURL
            });
            
            return {
                status: 'unhealthy',
                error: error.message,
                url: this.baseURL
            };
        }
    }

    /**
     * Formatea datos para workflows específicos
     */
    formatDataForWorkflow(workflowType, data) {
        const baseData = {
            timestamp: new Date().toISOString(),
            source: 'evolutionapi-bridge',
            workflowType
        };

        switch (workflowType) {
            case 'message_processing':
                return {
                    ...baseData,
                    message: data.message,
                    user: {
                        phone: data.from,
                        isGroup: data.isGroup
                    },
                    metadata: {
                        messageId: data.messageId,
                        instance: data.instance
                    }
                };

            case 'appointment_management':
                return {
                    ...baseData,
                    appointment: data.appointment,
                    action: data.action, // create, update, delete
                    user: {
                        name: data.appointment?.clientName,
                        phone: data.appointment?.phone
                    }
                };

            case 'notification':
                return {
                    ...baseData,
                    notification: {
                        type: data.type,
                        recipient: data.recipient,
                        message: data.message,
                        priority: data.priority || 'normal'
                    }
                };

            default:
                return {
                    ...baseData,
                    data
                };
        }
    }

    /**
     * Ejecuta múltiples workflows en paralelo
     */
    async triggerMultipleWorkflows(workflowsData) {
        try {
            const promises = workflowsData.map(workflow => 
                this.triggerWorkflow(workflow).catch(error => ({
                    error: error.message,
                    workflow: workflow.webhookPath
                }))
            );

            const results = await Promise.allSettled(promises);

            logger.info('⚡ Múltiples workflows ejecutados', {
                total: workflowsData.length,
                successful: results.filter(r => r.status === 'fulfilled').length,
                failed: results.filter(r => r.status === 'rejected').length
            });

            return results;

        } catch (error) {
            logger.error('❌ Error ejecutando múltiples workflows', {
                error: error.message,
                workflowsCount: workflowsData.length
            });
            throw new Error(`Error ejecutando workflows: ${error.message}`);
        }
    }
}

export default N8NService;