# N8N-EvolutionAPI-CitaMedica Integration

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)
![License](https://img.shields.io/badge/license-MIT-yellow.svg)

Sistema de integración completo que conecta **N8N**, **EvolutionAPI** y **CitaMedicaBeta API** para automatizar la gestión de citas médicas a través de WhatsApp.

## 🏗️ Arquitectura

```
WhatsApp ↔ EvolutionAPI ↔ N8N-Bridge ↔ N8N Workflows ↔ CitaMedicaBeta API
```

## ✨ Características

### 🔄 Funcionalidades Principales
- **Gestión completa de citas**: Crear, modificar, eliminar y consultar citas
- **Sobreturnos automáticos**: Manejo de citas urgentes fuera del horario normal
- **Conversación inteligente**: Bot conversacional con estados y contexto
- **Recordatorios automáticos**: Notificaciones programadas
- **Manejo robusto de errores**: Sistema completo de recuperación

### 🛠️ Tecnologías
- **Node.js 18+** con ES Modules
- **Express.js** para el servidor HTTP
- **N8N** para workflows de automatización
- **EvolutionAPI** para comunicación con WhatsApp
- **Axios** para comunicación con APIs
- **Winston** para logging avanzado
- **Joi** para validación de datos
- **Docker & Docker Compose** para despliegue

## 🚀 Inicio Rápido

### Prerrequisitos
- Docker y Docker Compose instalados
- Node.js 18+ (para desarrollo local)
- Acceso a WhatsApp Business API o cuenta personal

### 1. Clonar e Instalar

```bash
git clone <repository-url>
cd N8N-EvolutionAPI-CitaMedica
cp .env.example .env
```

### 2. Configurar Variables de Entorno

Editar `.env` con tus configuraciones:

```bash
# URLs de las APIs
CITAMEDICA_API_URL=http://localhost:4001/api
EVOLUTION_API_URL=http://localhost:8080
N8N_WEBHOOK_URL=http://localhost:5678

# Configuración de EvolutionAPI
EVOLUTION_API_KEY=tu_api_key_aqui
EVOLUTION_INSTANCE_NAME=citamedica-bot

# Configuración de la clínica
CLINIC_NAME=Tu Clínica
BOT_NAME=Anita - Asistente Médica
TIMEZONE=America/Argentina/Buenos_Aires
```

### 3. Ejecutar con Docker (Recomendado)

```bash
# Producción
docker-compose up -d

# Desarrollo
docker-compose -f docker-compose.dev.yml up -d
```

### 4. Desarrollo Local

```bash
npm install
npm run dev
```

## 📋 Endpoints Principales

### Webhooks
```
POST /webhook/whatsapp     # Mensajes de WhatsApp
POST /webhook/n8n          # Workflows de N8N  
POST /webhook/evolution    # Eventos de EvolutionAPI
```

### API Management
```
GET  /health              # Health check
GET  /status              # Status detallado
POST /api/test/send-message  # Test de mensajes
```

## 🔧 Configuración Detallada

### N8N Workflows

El sistema incluye 3 workflows principales:

1. **whatsapp-citamedica-complete.json**
   - Manejo completo de conversación
   - Procesamiento de intenciones
   - Gestión de citas y sobreturnos

2. **error-handler-notifications.json**
   - Manejo centralizado de errores
   - Notificaciones al administrador
   - Health checks automatizados

3. **appointment-management-crud.json**
   - Operaciones CRUD de citas
   - Validaciones y confirmaciones
   - Programación de recordatorios

### EvolutionAPI Setup

1. **Crear instancia**:
```bash
curl -X POST http://localhost:8080/instance/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tu_api_key" \
  -d '{"instanceName": "citamedica-bot", "qrcode": true}'
```

2. **Configurar webhook**:
```bash
curl -X POST http://localhost:8080/webhook/set/citamedica-bot \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tu_api_key" \
  -d '{
    "url": "http://localhost:3000/webhook/whatsapp",
    "events": ["MESSAGES_UPSERT"]
  }'
```

## 📱 Flujo de Conversación

### Comandos Disponibles

| Comando | Descripción |
|---------|-------------|
| `hola`, `inicio` | Menú principal |
| `cita`, `turno` | Agendar cita normal |
| `sobreturno` | Solicitar sobreturno |
| `ver citas` | Consultar citas |
| `ayuda` | Mostrar ayuda |
| `cancelar` | Cancelar operación |

### Flujo de Agendamiento

1. **Saludo inicial** → Selección de tipo
2. **Recolección de datos** → Nombre, obra social
3. **Selección de fecha** → Fechas disponibles
4. **Selección de horario** → Horarios libres
5. **Confirmación** → Creación en sistema
6. **Recordatorio** → Notificación programada

## 🐛 Debugging y Logs

### Logs en Tiempo Real
```bash
# Todos los servicios
docker-compose logs -f

# Solo bridge
docker-compose logs -f n8n-evolution-bridge

# Solo N8N
docker-compose logs -f n8n
```

### Estructura de Logs
```
logs/
├── app.log           # Logs generales
├── error.log         # Solo errores
└── whatsapp.log      # Mensajes WhatsApp
```

### Niveles de Log
- `error`: Solo errores críticos
- `warn`: Advertencias y errores
- `info`: Información general (recomendado)
- `debug`: Información detallada

## 🔒 Seguridad

### Variables Sensibles
- Nunca commitear archivos `.env`
- Usar secretos de Docker en producción
- Rotar API keys regularmente

### Rate Limiting
```javascript
RATE_LIMIT_WINDOW=900000     # 15 minutos
RATE_LIMIT_MAX_REQUESTS=100  # 100 requests por ventana
```

### Validaciones
- Validación de entrada con Joi
- Sanitización de números de teléfono
- Verificación de webhooks con signatures

## 🚀 Despliegue en Producción

### 1. Configuración de Producción

```bash
# docker-compose.prod.yml
version: '3.8'
services:
  n8n-evolution-bridge:
    image: tu-registry/n8n-evolution-bridge:latest
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
    secrets:
      - evolution_api_key
      - webhook_secret
```

### 2. Variables de Entorno Requeridas

```bash
NODE_ENV=production
CITAMEDICA_API_URL=https://tu-api.com/api
EVOLUTION_API_URL=https://tu-evolution.com
N8N_WEBHOOK_URL=https://tu-n8n.com
EVOLUTION_API_KEY=tu_clave_secreta
WEBHOOK_SECRET=tu_webhook_secret
```

### 3. Proxy Reverso (Nginx)

```nginx
server {
    listen 80;
    server_name tu-dominio.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 📊 Monitoreo y Métricas

### Health Checks
```bash
curl http://localhost:3000/health
curl http://localhost:3000/status
```

### Métricas de N8N
- Panel disponible en: http://localhost:5678
- Métricas de ejecución
- Logs de workflows

### Alertas Recomendadas
- CPU > 80%
- Memoria > 85%
- Disco > 90%
- Errores > 5/min

## 🔧 Troubleshooting

### Problemas Comunes

#### 1. EvolutionAPI no conecta
```bash
# Verificar estado
curl http://localhost:8080/instance/connectionState/citamedica-bot

# Reiniciar instancia
curl -X POST http://localhost:8080/instance/restart/citamedica-bot
```

#### 2. N8N workflows no ejecutan
```bash
# Verificar webhooks activos
curl http://localhost:5678/webhook-test/whatsapp-message

# Revisar logs de N8N
docker logs n8n
```

#### 3. CitaMedica API error
```bash
# Test de conectividad
curl http://localhost:4001/api/health

# Verificar endpoints
curl http://localhost:4001/api/appointments
```

### Comandos de Diagnóstico

```bash
# Estado de todos los servicios
docker ps

# Uso de recursos
docker stats

# Logs con filtros
docker-compose logs --since="1h" --tail="100"

# Conectividad de red
docker network inspect citamedica-network
```

## 📝 API Documentation

### CitaMedicaBeta Endpoints

#### Citas Normales
```bash
GET    /api/appointments              # Obtener citas
POST   /api/appointments              # Crear cita
PUT    /api/appointments/:id          # Actualizar cita
DELETE /api/appointments/:id          # Eliminar cita
```

#### Sobreturnos
```bash
GET    /api/sobreturnos              # Obtener sobreturnos
POST   /api/sobreturnos              # Crear sobreturno
GET    /api/sobreturnos/available/:date  # Sobreturnos disponibles
```

### EvolutionAPI Integration

#### Enviar Mensajes
```javascript
const response = await evolutionAPI.sendMessage(
  '5491234567890',
  'Hola, tu cita está confirmada!',
  'citamedica-bot'
);
```

#### Configurar Webhooks
```javascript
await evolutionAPI.setWebhook(
  'http://localhost:3000/webhook/whatsapp',
  'citamedica-bot'
);
```

## 🤝 Contribución

### Estructura del Proyecto
```
src/
├── controllers/       # Controladores HTTP
├── services/         # Servicios de negocio
├── middleware/       # Middlewares Express
├── utils/           # Utilidades y helpers
└── app.js          # Punto de entrada

workflows/           # Workflows de N8N
logs/               # Archivos de log
```

### Comandos de Desarrollo
```bash
npm run dev         # Desarrollo con nodemon
npm run test        # Ejecutar tests
npm run lint        # Linter
npm run build       # Build de Docker
```

### Estándares de Código
- ES6+ modules
- JSDoc para documentación
- Prettier para formateo
- ESLint para calidad de código

## 📄 Licencia

MIT License - ver [LICENSE](LICENSE) para detalles.

## 🆘 Soporte

- **Issues**: Crear issue en GitHub
- **Documentación**: `/docs` en el repositorio
- **Email**: soporte@tu-clinica.com

---

**Desarrollado por**: Jorge Hara  
**Versión**: 1.0.0  
**Última actualización**: Noviembre 2024