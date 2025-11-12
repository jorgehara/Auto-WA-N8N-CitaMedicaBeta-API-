# Multi-stage build para optimizar el tamaño de imagen
FROM node:18-alpine AS builder

# Instalar dependencias del sistema
RUN apk add --no-cache python3 make g++

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production && npm cache clean --force

# Etapa de producción
FROM node:18-alpine AS production

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001

# Crear directorio de trabajo y logs
WORKDIR /app
RUN mkdir -p /app/logs && chown -R nodeuser:nodejs /app

# Copiar dependencias desde builder
COPY --from=builder --chown=nodeuser:nodejs /app/node_modules ./node_modules

# Copiar código fuente
COPY --chown=nodeuser:nodejs . .

# Exponer puerto
EXPOSE ${PORT}

# Configurar usuario
USER nodeuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "const http = require('http'); \
    const options = { hostname: 'localhost', port: process.env.PORT || 3000, path: '/health', timeout: 2000 }; \
    const req = http.request(options, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); \
    req.on('timeout', () => { req.destroy(); process.exit(1); }); \
    req.on('error', () => { process.exit(1); }); \
    req.end();"

# Comando de inicio
CMD ["node", "src/app.js"]

# Metadata
LABEL maintainer="Jorge Hara <jorge@example.com>" \
      description="N8N-EvolutionAPI-CitaMedica Integration Service" \
      version="1.0.0"