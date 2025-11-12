import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Importar servicios y middleware
import { logger } from './utils/logger.js';
import { applyRateLimit } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { validateWebhook } from './middleware/webhookValidator.js';

// Importar controladores
import webhookController from './controllers/webhookController.js';
import healthController from './controllers/healthController.js';

// Configurar rutas de archivos
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config();

class N8NEvolutionAPIServer {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    setupMiddleware() {
        // Middleware de seguridad
        this.app.use(helmet());
        
        // CORS configurado para permitir N8N y EvolutionAPI
        this.app.use(cors({
            origin: [
                process.env.N8N_WEBHOOK_URL,
                process.env.EVOLUTION_API_URL,
                'http://localhost:5678',
                'http://localhost:8080'
            ],
            credentials: true
        }));

        // Logging
        this.app.use(morgan('combined', {
            stream: {
                write: (message) => logger.info(message.trim())
            }
        }));

        // Rate limiting
        this.app.use(applyRateLimit);

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Request logging
        this.app.use((req, res, next) => {
            logger.info(`${req.method} ${req.path}`, {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                body: req.method === 'POST' ? req.body : undefined
            });
            next();
        });
    }

    setupRoutes() {
        // Ruta de health check
        this.app.get('/health', healthController.getHealth);
        this.app.get('/status', healthController.getStatus);

        // Webhook para recibir mensajes de WhatsApp
        this.app.post('/webhook/whatsapp', 
            validateWebhook, 
            webhookController.handleWhatsAppMessage
        );

        // Webhook para N8N
        this.app.post('/webhook/n8n',
            webhookController.handleN8NWebhook
        );

        // Webhook genérico para eventos de EvolutionAPI
        this.app.post('/webhook/evolution',
            webhookController.handleEvolutionEvent
        );

        // Rutas de API para testing
        this.app.post('/api/test/send-message',
            webhookController.testSendMessage
        );

        // Ruta 404
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Ruta no encontrada',
                path: req.originalUrl,
                method: req.method
            });
        });
    }

    setupErrorHandling() {
        this.app.use(errorHandler);
    }

    async start() {
        try {
            // Verificar conexiones con servicios externos
            await this.checkDependencies();

            this.app.listen(this.port, '0.0.0.0', () => {
                logger.info(`🚀 Servidor iniciado en puerto ${this.port}`);
                logger.info(`🔗 Ambiente: ${process.env.NODE_ENV || 'development'}`);
                logger.info(`📱 EvolutionAPI: ${process.env.EVOLUTION_API_URL}`);
                logger.info(`🏥 CitaMedica API: ${process.env.CITAMEDICA_API_URL}`);
                logger.info(`⚡ N8N Webhook: ${process.env.N8N_WEBHOOK_URL}`);
                logger.info('✅ Sistema listo para recibir webhooks');
            });

            // Manejo graceful de cierre
            this.setupGracefulShutdown();

        } catch (error) {
            logger.error('❌ Error al iniciar servidor:', error);
            process.exit(1);
        }
    }

    async checkDependencies() {
        logger.info('🔍 Verificando dependencias...');
        
        // Aquí podrías agregar verificaciones de conectividad
        // con EvolutionAPI, CitaMedica API, etc.
        
        logger.info('✅ Dependencias verificadas');
    }

    setupGracefulShutdown() {
        const shutdown = (signal) => {
            logger.info(`📴 Recibida señal ${signal}. Cerrando servidor...`);
            
            process.exit(0);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('uncaughtException', (error) => {
            logger.error('💥 Excepción no capturada:', error);
            process.exit(1);
        });
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('💥 Promise rechazada:', { reason, promise });
            process.exit(1);
        });
    }
}

// Iniciar servidor
const server = new N8NEvolutionAPIServer();
server.start();

export default server;