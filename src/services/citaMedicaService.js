import axios from 'axios';
import { logger, logAPICall } from '../utils/logger.js';

class CitaMedicaService {
    constructor() {
        this.baseURL = process.env.CITAMEDICA_API_URL || 'http://localhost:4001/api';
        this.timeout = parseInt(process.env.CITAMEDICA_TIMEOUT) || 30000;

        this.client = axios.create({
            baseURL: this.baseURL,
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
                logger.info(`📤 CitaMedica Request: ${config.method?.toUpperCase()} ${config.url}`);
                return config;
            },
            (error) => {
                logger.error('❌ CitaMedica Request Error', { error: error.message });
                return Promise.reject(error);
            }
        );

        // Response interceptor
        this.client.interceptors.response.use(
            (response) => {
                const responseTime = new Date() - response.config.metadata.startTime;
                logAPICall(
                    'CitaMedicaBeta',
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
                    'CitaMedicaBeta',
                    error.config?.url || 'unknown',
                    error.config?.method?.toUpperCase() || 'unknown',
                    error.response?.status || 'error',
                    responseTime
                );
                
                logger.error('❌ CitaMedica Response Error', {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data,
                    url: error.config?.url
                });
                
                return Promise.reject(error);
            }
        );
    }

    // ==================== CITAS NORMALES ====================

    /**
     * Obtiene todas las citas
     */
    async getAppointments(date = null, showHistory = false) {
        try {
            const params = {};
            if (date) params.date = date;
            if (showHistory) params.showHistory = 'true';

            const response = await this.client.get('/appointments', { params });
            return response.data;

        } catch (error) {
            logger.error('❌ Error obteniendo citas', {
                date,
                showHistory,
                error: error.message
            });
            throw new Error(`Error obteniendo citas: ${error.message}`);
        }
    }

    /**
     * Obtiene horarios disponibles para una fecha
     */
    async getAvailableAppointments(date) {
        try {
            const response = await this.client.get(`/appointments/available/${date}`);
            return response.data;

        } catch (error) {
            logger.error('❌ Error obteniendo horarios disponibles', {
                date,
                error: error.message
            });
            throw new Error(`Error obteniendo horarios disponibles: ${error.message}`);
        }
    }

    /**
     * Obtiene citas reservadas para una fecha
     */
    async getReservedAppointments(date) {
        try {
            const response = await this.client.get(`/appointments/reserved/${date}`);
            return response.data;

        } catch (error) {
            logger.error('❌ Error obteniendo citas reservadas', {
                date,
                error: error.message
            });
            throw new Error(`Error obteniendo citas reservadas: ${error.message}`);
        }
    }

    /**
     * Crea una nueva cita
     */
    async createAppointment(appointmentData) {
        try {
            const payload = {
                clientName: appointmentData.clientName,
                socialWork: appointmentData.socialWork,
                phone: appointmentData.phone,
                email: appointmentData.email || '',
                date: appointmentData.date,
                time: appointmentData.time,
                description: appointmentData.description || '',
                isSobreturno: appointmentData.isSobreturno || false
            };

            const response = await this.client.post('/appointments', payload);

            logger.info('📅 Cita creada exitosamente', {
                clientName: payload.clientName,
                date: payload.date,
                time: payload.time,
                isSobreturno: payload.isSobreturno
            });

            return response.data;

        } catch (error) {
            logger.error('❌ Error creando cita', {
                appointmentData,
                error: error.message,
                response: error.response?.data
            });
            throw new Error(`Error creando cita: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Actualiza una cita existente
     */
    async updateAppointment(appointmentId, updateData) {
        try {
            const response = await this.client.put(`/appointments/${appointmentId}`, updateData);

            logger.info('📝 Cita actualizada', {
                appointmentId,
                updateData
            });

            return response.data;

        } catch (error) {
            logger.error('❌ Error actualizando cita', {
                appointmentId,
                updateData,
                error: error.message
            });
            throw new Error(`Error actualizando cita: ${error.message}`);
        }
    }

    /**
     * Elimina una cita
     */
    async deleteAppointment(appointmentId) {
        try {
            const response = await this.client.delete(`/appointments/${appointmentId}`);

            logger.info('🗑️ Cita eliminada', {
                appointmentId
            });

            return response.data;

        } catch (error) {
            logger.error('❌ Error eliminando cita', {
                appointmentId,
                error: error.message
            });
            throw new Error(`Error eliminando cita: ${error.message}`);
        }
    }

    /**
     * Actualiza el estado de pago de una cita
     */
    async updatePaymentStatus(appointmentId, paymentStatus) {
        try {
            const response = await this.client.patch(`/appointments/${appointmentId}/payment`, {
                paymentStatus
            });

            logger.info('💳 Estado de pago actualizado', {
                appointmentId,
                paymentStatus
            });

            return response.data;

        } catch (error) {
            logger.error('❌ Error actualizando estado de pago', {
                appointmentId,
                paymentStatus,
                error: error.message
            });
            throw new Error(`Error actualizando pago: ${error.message}`);
        }
    }

    // ==================== SOBRETURNOS ====================

    /**
     * Obtiene todos los sobreturnos
     */
    async getSobreturnos(status = null, date = null) {
        try {
            const params = {};
            if (status) params.status = status;
            if (date) params.date = date;

            const response = await this.client.get('/sobreturnos', { params });
            return response.data;

        } catch (error) {
            logger.error('❌ Error obteniendo sobreturnos', {
                status,
                date,
                error: error.message
            });
            throw new Error(`Error obteniendo sobreturnos: ${error.message}`);
        }
    }

    /**
     * Obtiene sobreturnos disponibles para una fecha
     */
    async getAvailableSobreturnos(date) {
        try {
            const response = await this.client.get(`/sobreturnos/available/${date}`);
            return response.data;

        } catch (error) {
            logger.error('❌ Error obteniendo sobreturnos disponibles', {
                date,
                error: error.message
            });
            throw new Error(`Error obteniendo sobreturnos disponibles: ${error.message}`);
        }
    }

    /**
     * Obtiene sobreturnos por fecha
     */
    async getSobreturnosByDate(date) {
        try {
            const response = await this.client.get(`/sobreturnos/date/${date}`);
            return response.data;

        } catch (error) {
            logger.error('❌ Error obteniendo sobreturnos por fecha', {
                date,
                error: error.message
            });
            throw new Error(`Error obteniendo sobreturnos: ${error.message}`);
        }
    }

    /**
     * Crea un nuevo sobreturno
     */
    async createSobreturno(sobreturnoData) {
        try {
            const payload = {
                sobreturnoNumber: sobreturnoData.sobreturnoNumber,
                date: sobreturnoData.date,
                clientName: sobreturnoData.clientName,
                socialWork: sobreturnoData.socialWork,
                phone: sobreturnoData.phone,
                email: sobreturnoData.email || '',
                description: sobreturnoData.description || '',
                time: sobreturnoData.time,
                isSobreturno: true
            };

            const response = await this.client.post('/sobreturnos', payload);

            logger.info('🔄 Sobreturno creado exitosamente', {
                clientName: payload.clientName,
                date: payload.date,
                sobreturnoNumber: payload.sobreturnoNumber
            });

            return response.data;

        } catch (error) {
            logger.error('❌ Error creando sobreturno', {
                sobreturnoData,
                error: error.message,
                response: error.response?.data
            });
            throw new Error(`Error creando sobreturno: ${error.response?.data?.error || error.message}`);
        }
    }

    /**
     * Valida disponibilidad de sobreturno
     */
    async validateSobreturno(date, sobreturnoNumber) {
        try {
            const response = await this.client.get('/sobreturnos/validate', {
                params: { date, sobreturnoNumber }
            });

            return response.data;

        } catch (error) {
            logger.error('❌ Error validando sobreturno', {
                date,
                sobreturnoNumber,
                error: error.message
            });
            throw new Error(`Error validando sobreturno: ${error.message}`);
        }
    }

    /**
     * Actualiza un sobreturno
     */
    async updateSobreturno(sobreturnoId, updateData) {
        try {
            const response = await this.client.put(`/sobreturnos/${sobreturnoId}`, updateData);

            logger.info('📝 Sobreturno actualizado', {
                sobreturnoId,
                updateData
            });

            return response.data;

        } catch (error) {
            logger.error('❌ Error actualizando sobreturno', {
                sobreturnoId,
                updateData,
                error: error.message
            });
            throw new Error(`Error actualizando sobreturno: ${error.message}`);
        }
    }

    /**
     * Elimina un sobreturno
     */
    async deleteSobreturno(sobreturnoId) {
        try {
            const response = await this.client.delete(`/sobreturnos/${sobreturnoId}`);

            logger.info('🗑️ Sobreturno eliminado', {
                sobreturnoId
            });

            return response.data;

        } catch (error) {
            logger.error('❌ Error eliminando sobreturno', {
                sobreturnoId,
                error: error.message
            });
            throw new Error(`Error eliminando sobreturno: ${error.message}`);
        }
    }

    /**
     * Reserva un sobreturno
     */
    async reserveSobreturno(sobreturnoId) {
        try {
            const response = await this.client.post('/sobreturnos/reserve', {
                id: sobreturnoId
            });

            logger.info('🎯 Sobreturno reservado', {
                sobreturnoId
            });

            return response.data;

        } catch (error) {
            logger.error('❌ Error reservando sobreturno', {
                sobreturnoId,
                error: error.message
            });
            throw new Error(`Error reservando sobreturno: ${error.message}`);
        }
    }

    // ==================== UTILIDADES ====================

    /**
     * Verifica el estado del servicio
     */
    async healthCheck() {
        try {
            const response = await this.client.get('/health');
            return response.data;

        } catch (error) {
            logger.error('❌ Error en health check de CitaMedica', {
                error: error.message
            });
            throw new Error(`Error en health check: ${error.message}`);
        }
    }

    /**
     * Formatea fecha para la API
     */
    formatDateForAPI(date) {
        if (date instanceof Date) {
            return date.toISOString().split('T')[0];
        }
        if (typeof date === 'string') {
            return new Date(date).toISOString().split('T')[0];
        }
        return date;
    }

    /**
     * Parsea respuesta de horarios disponibles
     */
    parseAvailableSlots(response) {
        if (response.success && response.data) {
            return response.data.map(slot => ({
                time: slot.time,
                available: slot.available,
                type: slot.type || 'normal'
            }));
        }
        return [];
    }

    /**
     * Genera datos de prueba para testing
     */
    generateTestAppointment() {
        return {
            clientName: 'Paciente de Prueba',
            socialWork: 'Obra Social Test',
            phone: '1234567890',
            email: 'test@example.com',
            date: new Date().toISOString().split('T')[0],
            time: '14:00',
            description: 'Cita de prueba generada automáticamente'
        };
    }
}

export default CitaMedicaService;