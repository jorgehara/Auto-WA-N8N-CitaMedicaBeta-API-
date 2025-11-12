import { logger } from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
    // Log del error
    logger.error('💥 Error en middleware de manejo de errores', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });

    // Errores de validación
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Error de validación',
            message: err.message,
            details: err.details || null
        });
    }

    // Errores de JWT
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            error: 'Token inválido',
            message: 'El token proporcionado no es válido'
        });
    }

    // Errores de timeout
    if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
        return res.status(504).json({
            error: 'Timeout',
            message: 'La solicitud tardó demasiado tiempo en procesarse'
        });
    }

    // Errores de conexión con APIs externas
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        return res.status(503).json({
            error: 'Servicio no disponible',
            message: 'No se pudo conectar con el servicio externo'
        });
    }

    // Error de sintaxis JSON
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({
            error: 'JSON inválido',
            message: 'El formato JSON enviado no es válido'
        });
    }

    // Errores HTTP específicos
    if (err.status || err.statusCode) {
        return res.status(err.status || err.statusCode).json({
            error: err.name || 'Error HTTP',
            message: err.message || 'Ha ocurrido un error en la petición'
        });
    }

    // Error 500 genérico
    res.status(500).json({
        error: 'Error interno del servidor',
        message: process.env.NODE_ENV === 'development' 
            ? err.message 
            : 'Ha ocurrido un error interno. Por favor, contacta al administrador.',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

export default errorHandler;