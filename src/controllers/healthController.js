import { logger } from '../utils/logger.js';

class HealthController {
    // Health check básico
    getHealth(req, res) {
        res.status(200).json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'development'
        });
    }

    // Status detallado con verificación de servicios
    async getStatus(req, res) {
        try {
            const status = {
                server: {
                    status: 'healthy',
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    cpu: process.cpuUsage()
                },
                services: await this.checkServices(),
                timestamp: new Date().toISOString(),
                environment: process.env.NODE_ENV || 'development'
            };

            // Determinar status general
            const isHealthy = Object.values(status.services)
                .every(service => service.status === 'healthy');

            const responseStatus = isHealthy ? 200 : 503;
            
            res.status(responseStatus).json({
                ...status,
                overall: isHealthy ? 'healthy' : 'degraded'
            });

        } catch (error) {
            logger.error('❌ Error en health check', { error: error.message });
            
            res.status(503).json({
                overall: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    async checkServices() {
        const services = {};

        // Check EvolutionAPI
        services.evolutionapi = await this.checkEvolutionAPI();
        
        // Check CitaMedicaBeta API
        services.citamedica = await this.checkCitaMedicaAPI();
        
        // Check N8N (opcional)
        if (process.env.N8N_WEBHOOK_URL) {
            services.n8n = await this.checkN8N();
        }

        return services;
    }

    async checkEvolutionAPI() {
        try {
            if (!process.env.EVOLUTION_API_URL) {
                return { status: 'not_configured', message: 'URL no configurada' };
            }

            // Aquí podrías hacer una llamada real a EvolutionAPI
            // Por ahora solo verificamos la configuración
            return {
                status: 'healthy',
                url: process.env.EVOLUTION_API_URL,
                instance: process.env.EVOLUTION_INSTANCE_NAME || 'default'
            };
            
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }

    async checkCitaMedicaAPI() {
        try {
            if (!process.env.CITAMEDICA_API_URL) {
                return { status: 'not_configured', message: 'URL no configurada' };
            }

            // Aquí podrías hacer una llamada real a CitaMedica API
            // Por ahora solo verificamos la configuración
            return {
                status: 'healthy',
                url: process.env.CITAMEDICA_API_URL
            };
            
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }

    async checkN8N() {
        try {
            return {
                status: 'configured',
                webhook_url: process.env.N8N_WEBHOOK_URL
            };
            
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }
}

export default new HealthController();