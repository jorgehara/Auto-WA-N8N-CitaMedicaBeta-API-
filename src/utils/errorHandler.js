import { logger } from '../utils/logger.js';

class ErrorHandler {
    constructor() {
        this.errorCodes = {
            // Errores de validación
            VALIDATION_ERROR: 'VALIDATION_ERROR',
            INVALID_PHONE: 'INVALID_PHONE',
            INVALID_DATE: 'INVALID_DATE',
            INVALID_TIME: 'INVALID_TIME',
            
            // Errores de API
            API_ERROR: 'API_ERROR',
            CITAMEDICA_ERROR: 'CITAMEDICA_ERROR',
            EVOLUTION_ERROR: 'EVOLUTION_ERROR',
            N8N_ERROR: 'N8N_ERROR',
            
            // Errores de conectividad
            CONNECTION_ERROR: 'CONNECTION_ERROR',
            TIMEOUT_ERROR: 'TIMEOUT_ERROR',
            
            // Errores de disponibilidad
            NO_SLOTS_AVAILABLE: 'NO_SLOTS_AVAILABLE',
            APPOINTMENT_CONFLICT: 'APPOINTMENT_CONFLICT',
            SOBRETURNO_UNAVAILABLE: 'SOBRETURNO_UNAVAILABLE',
            
            // Errores del sistema
            SYSTEM_ERROR: 'SYSTEM_ERROR',
            CONFIGURATION_ERROR: 'CONFIGURATION_ERROR'
        };

        this.userFriendlyMessages = {
            [this.errorCodes.VALIDATION_ERROR]: 'Los datos proporcionados no son válidos. Por favor, verifica la información.',
            [this.errorCodes.INVALID_PHONE]: 'El número de teléfono no es válido.',
            [this.errorCodes.INVALID_DATE]: 'La fecha seleccionada no es válida.',
            [this.errorCodes.INVALID_TIME]: 'El horario seleccionado no es válido.',
            
            [this.errorCodes.API_ERROR]: 'Error de conexión con el servicio. Por favor, intenta más tarde.',
            [this.errorCodes.CITAMEDICA_ERROR]: 'Error en el sistema de citas. Por favor, contacta a la clínica.',
            [this.errorCodes.EVOLUTION_ERROR]: 'Error en el servicio de mensajería.',
            [this.errorCodes.N8N_ERROR]: 'Error en el procesamiento automatizado.',
            
            [this.errorCodes.CONNECTION_ERROR]: 'Error de conectividad. Verifica tu conexión a internet.',
            [this.errorCodes.TIMEOUT_ERROR]: 'La operación tardó demasiado tiempo. Intenta de nuevo.',
            
            [this.errorCodes.NO_SLOTS_AVAILABLE]: 'No hay horarios disponibles para la fecha seleccionada.',
            [this.errorCodes.APPOINTMENT_CONFLICT]: 'Ya existe una cita en ese horario.',
            [this.errorCodes.SOBRETURNO_UNAVAILABLE]: 'El sobreturno seleccionado ya no está disponible.',
            
            [this.errorCodes.SYSTEM_ERROR]: 'Error interno del sistema. Por favor, contacta al soporte técnico.',
            [this.errorCodes.CONFIGURATION_ERROR]: 'Error de configuración del sistema.'
        };
    }

    /**
     * Maneja errores y devuelve respuesta apropiada para el usuario
     */
    handleError(error, context = 'unknown') {
        const errorInfo = this.categorizeError(error);
        const errorId = this.generateErrorId();

        // Log del error con contexto completo
        logger.error(`❌ Error manejado [${errorId}]`, {
            errorId,
            context,
            code: errorInfo.code,
            message: error.message,
            stack: error.stack,
            originalError: error
        });

        // Retornar respuesta estructurada
        return {
            success: false,
            error: {
                id: errorId,
                code: errorInfo.code,
                message: errorInfo.userMessage,
                context,
                retry: errorInfo.retry,
                severity: errorInfo.severity
            },
            userMessage: this.buildUserErrorMessage(errorInfo, errorId)
        };
    }

    /**
     * Categoriza el error y determina el código apropiado
     */
    categorizeError(error) {
        const message = error.message?.toLowerCase() || '';
        const name = error.name?.toLowerCase() || '';
        const code = error.code || '';

        // Errores de validación
        if (name.includes('validation') || message.includes('validation')) {
            return {
                code: this.errorCodes.VALIDATION_ERROR,
                userMessage: this.userFriendlyMessages[this.errorCodes.VALIDATION_ERROR],
                retry: true,
                severity: 'medium'
            };
        }

        // Errores de timeout
        if (message.includes('timeout') || code === 'ECONNABORTED') {
            return {
                code: this.errorCodes.TIMEOUT_ERROR,
                userMessage: this.userFriendlyMessages[this.errorCodes.TIMEOUT_ERROR],
                retry: true,
                severity: 'medium'
            };
        }

        // Errores de conexión
        if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || message.includes('network')) {
            return {
                code: this.errorCodes.CONNECTION_ERROR,
                userMessage: this.userFriendlyMessages[this.errorCodes.CONNECTION_ERROR],
                retry: true,
                severity: 'high'
            };
        }

        // Errores específicos de APIs
        if (message.includes('citamedica') || message.includes('appointment')) {
            return {
                code: this.errorCodes.CITAMEDICA_ERROR,
                userMessage: this.userFriendlyMessages[this.errorCodes.CITAMEDICA_ERROR],
                retry: false,
                severity: 'high'
            };
        }

        if (message.includes('evolution') || message.includes('whatsapp')) {
            return {
                code: this.errorCodes.EVOLUTION_ERROR,
                userMessage: this.userFriendlyMessages[this.errorCodes.EVOLUTION_ERROR],
                retry: true,
                severity: 'medium'
            };
        }

        if (message.includes('n8n') || message.includes('workflow')) {
            return {
                code: this.errorCodes.N8N_ERROR,
                userMessage: this.userFriendlyMessages[this.errorCodes.N8N_ERROR],
                retry: true,
                severity: 'low'
            };
        }

        // Errores de disponibilidad
        if (message.includes('no disponible') || message.includes('no slots')) {
            return {
                code: this.errorCodes.NO_SLOTS_AVAILABLE,
                userMessage: this.userFriendlyMessages[this.errorCodes.NO_SLOTS_AVAILABLE],
                retry: false,
                severity: 'low'
            };
        }

        if (message.includes('conflict') || message.includes('ya existe')) {
            return {
                code: this.errorCodes.APPOINTMENT_CONFLICT,
                userMessage: this.userFriendlyMessages[this.errorCodes.APPOINTMENT_CONFLICT],
                retry: false,
                severity: 'medium'
            };
        }

        // Error genérico del sistema
        return {
            code: this.errorCodes.SYSTEM_ERROR,
            userMessage: this.userFriendlyMessages[this.errorCodes.SYSTEM_ERROR],
            retry: false,
            severity: 'high'
        };
    }

    /**
     * Construye mensaje de error amigable para el usuario
     */
    buildUserErrorMessage(errorInfo, errorId) {
        let message = `❌ ${errorInfo.userMessage}`;

        if (errorInfo.retry) {
            message += '\n\n🔄 Puedes intentar de nuevo en unos momentos.';
        }

        if (errorInfo.severity === 'high') {
            message += '\n\n📞 Si el problema persiste, contacta directamente con la clínica.';
        }

        // En modo desarrollo, incluir ID del error
        if (process.env.NODE_ENV === 'development') {
            message += `\n\n🔧 ID Error: ${errorId}`;
        }

        return message;
    }

    /**
     * Genera ID único para el error
     */
    generateErrorId() {
        return `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    }

    /**
     * Valida datos de entrada
     */
    validateAppointmentData(data) {
        const errors = [];

        if (!data.clientName || data.clientName.length < 3) {
            errors.push('Nombre del paciente es requerido (mínimo 3 caracteres)');
        }

        if (!data.socialWork || data.socialWork.length < 2) {
            errors.push('Obra social es requerida');
        }

        if (!data.phone) {
            errors.push('Número de teléfono es requerido');
        } else if (!this.validatePhoneNumber(data.phone)) {
            errors.push('Formato de teléfono inválido');
        }

        if (!data.date) {
            errors.push('Fecha es requerida');
        } else if (!this.validateDate(data.date)) {
            errors.push('Fecha inválida');
        }

        if (!data.time) {
            errors.push('Horario es requerido');
        } else if (!this.validateTime(data.time)) {
            errors.push('Horario inválido');
        }

        if (errors.length > 0) {
            throw new Error(`Datos de cita inválidos: ${errors.join(', ')}`);
        }

        return true;
    }

    /**
     * Valida número de teléfono
     */
    validatePhoneNumber(phone) {
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        const cleanPhone = phone.replace(/\D/g, '');
        return phoneRegex.test(cleanPhone) && cleanPhone.length >= 8;
    }

    /**
     * Valida fecha
     */
    validateDate(date) {
        const dateObj = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        return dateObj instanceof Date && 
               !isNaN(dateObj) && 
               dateObj >= today;
    }

    /**
     * Valida horario
     */
    validateTime(time) {
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        return timeRegex.test(time);
    }

    /**
     * Wrapping para funciones async con manejo de errores
     */
    asyncWrapper(fn, context) {
        return async (...args) => {
            try {
                return await fn(...args);
            } catch (error) {
                const handled = this.handleError(error, context);
                throw new Error(handled.userMessage);
            }
        };
    }

    /**
     * Retry automático para operaciones
     */
    async retryOperation(operation, maxRetries = 3, delay = 1000, context = 'retry') {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                
                logger.warn(`🔄 Intento ${attempt}/${maxRetries} falló`, {
                    context,
                    error: error.message,
                    attempt
                });

                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, delay * attempt));
                }
            }
        }

        throw lastError;
    }

    /**
     * Manejo específico para errores de WhatsApp
     */
    handleWhatsAppError(error, messageData) {
        const context = {
            from: messageData?.from,
            messageId: messageData?.messageId,
            instance: messageData?.instance
        };

        return this.handleError(error, `whatsapp_${context.from}`);
    }

    /**
     * Manejo específico para errores de API
     */
    handleAPIError(error, endpoint, method) {
        const context = `api_${method}_${endpoint}`;
        return this.handleError(error, context);
    }
}

export default new ErrorHandler();