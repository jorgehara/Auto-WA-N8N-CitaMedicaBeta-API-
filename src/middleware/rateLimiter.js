import { RateLimiterMemory } from 'rate-limiter-flexible';
import { logger } from '../utils/logger.js';

// Configuración del rate limiter
const rateLimiter = new RateLimiterMemory({
    keyPrefix: 'webhook_limit',
    points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // Número de requests
    duration: parseInt(process.env.RATE_LIMIT_WINDOW) || 900, // Ventana de tiempo en segundos (15 min)
    blockDuration: 300, // Tiempo de bloqueo en segundos (5 min)
});

// Middleware para aplicar rate limiting
export const applyRateLimit = async (req, res, next) => {
    try {
        // Usar IP + User-Agent como clave para identificar al cliente
        const key = `${req.ip}_${req.get('User-Agent') || 'unknown'}`;
        
        await rateLimiter.consume(key);
        next();
    } catch (rateLimiterRes) {
        // Request rate limited
        const secs = Math.round(rateLimiterRes.msBeforeNext / 1000) || 1;
        
        logger.warn('🚫 Rate limit excedido', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path,
            resetTime: secs
        });

        res.set('Retry-After', String(secs));
        res.status(429).json({
            error: 'Demasiadas solicitudes',
            message: `Rate limit excedido. Intenta de nuevo en ${secs} segundos.`,
            retryAfter: secs
        });
    }
};

export { rateLimiter, applyRateLimit as default };