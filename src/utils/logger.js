import winston from 'winston';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuración de formato personalizado
const customFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
        
        if (Object.keys(meta).length > 0) {
            log += ` | Meta: ${JSON.stringify(meta)}`;
        }
        
        if (stack) {
            log += `\nStack: ${stack}`;
        }
        
        return log;
    })
);

// Configuración de transports
const transports = [
    // Console transport
    new winston.transports.Console({
        level: process.env.LOG_LEVEL || 'info',
        format: winston.format.combine(
            winston.format.colorize(),
            customFormat
        )
    })
];

// File transport solo en producción
if (process.env.NODE_ENV === 'production') {
    transports.push(
        new winston.transports.File({
            filename: join(dirname(__dirname), '..', 'logs', 'app.log'),
            level: 'info',
            maxsize: 5242880, // 5MB
            maxFiles: 10,
            format: customFormat
        }),
        new winston.transports.File({
            filename: join(dirname(__dirname), '..', 'logs', 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            format: customFormat
        })
    );
}

// Crear el logger
export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: customFormat,
    transports,
    exitOnError: false
});

// Funciones de utilidad para logging específico
export const logWhatsAppMessage = (messageData) => {
    logger.info('📱 Mensaje de WhatsApp recibido', {
        from: messageData.from,
        type: messageData.type,
        messageId: messageData.messageId,
        instance: messageData.instance
    });
};

export const logAPICall = (service, endpoint, method, status, responseTime) => {
    logger.info(`🔗 API Call - ${service}`, {
        endpoint,
        method,
        status,
        responseTime: `${responseTime}ms`
    });
};

export const logError = (context, error, additionalData = {}) => {
    logger.error(`❌ Error en ${context}`, {
        error: error.message,
        stack: error.stack,
        ...additionalData
    });
};

export const logN8NWebhook = (workflowId, status, data) => {
    logger.info('⚡ Webhook N8N procesado', {
        workflowId,
        status,
        dataKeys: Object.keys(data || {})
    });
};

export const logEvolutionEvent = (eventType, instanceName, data) => {
    logger.info('🤖 Evento EvolutionAPI', {
        eventType,
        instanceName,
        timestamp: new Date().toISOString()
    });
};

export default logger;