# 🚀 GUÍA DE INSTALACIÓN Y CONFIGURACIÓN

## N8N-EvolutionAPI-CitaMedica Integration

Esta guía te llevará paso a paso para configurar la integración completa.

## 📋 Prerrequisitos

- **Docker** y **Docker Compose** instalados
- **Node.js 18+** (para desarrollo)
- Acceso a la **API de CitaMedicaBeta**
- Cuenta de **WhatsApp** para EvolutionAPI

## 🔧 PASO 1: Preparación del Entorno

### 1.1 Clonar el Proyecto
```bash
git clone <tu-repositorio>
cd N8N-EvolutionAPI-CitaMedica
```

### 1.2 Configurar Variables de Entorno
```bash
cp .env.example .env
```

Editar `.env` con tus configuraciones:

```bash
# Configuración del servidor
PORT=3000
NODE_ENV=development

# URLs de las APIs
CITAMEDICA_API_URL=http://localhost:4001/api
EVOLUTION_API_URL=http://localhost:8080
N8N_WEBHOOK_URL=http://localhost:5678

# Configuración de EvolutionAPI
EVOLUTION_API_KEY=tu_clave_aqui_2024
EVOLUTION_INSTANCE_NAME=citamedica-bot

# Configuración de la clínica
CLINIC_NAME=Tu Clínica Médica
BOT_NAME=Anita - Asistente Médica
TIMEZONE=America/Argentina/Buenos_Aires

# Configuración de logs
LOG_LEVEL=debug

# Rate limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 🐳 PASO 2: Ejecutar con Docker

### 2.1 Modo Desarrollo
```bash
docker-compose -f docker-compose.dev.yml up -d
```

### 2.2 Verificar que todos los servicios estén corriendo
```bash
docker ps
```

Deberías ver:
- `n8n-evolution-bridge-dev`
- `n8n-dev`
- `evolution-api-dev`

## 📱 PASO 3: Configurar EvolutionAPI

### 3.1 Verificar que EvolutionAPI esté funcionando
```bash
curl http://localhost:8080/instance/fetchInstances
```

### 3.2 Crear una nueva instancia de WhatsApp
```bash
curl -X POST http://localhost:8080/instance/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tu_clave_aqui_2024" \
  -d '{
    "instanceName": "citamedica-bot",
    "token": "tu_clave_aqui_2024",
    "qrcode": true,
    "webhook": "http://n8n-evolution-bridge:3000/webhook/whatsapp"
  }'
```

### 3.3 Obtener el código QR para vincular WhatsApp
```bash
curl -X GET http://localhost:8080/instance/qrcode/citamedica-bot \
  -H "Authorization: Bearer tu_clave_aqui_2024"
```

**Importante**: Escanea el código QR con tu WhatsApp para vincular la cuenta.

### 3.4 Configurar webhook
```bash
curl -X POST http://localhost:8080/webhook/set/citamedica-bot \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tu_clave_aqui_2024" \
  -d '{
    "url": "http://n8n-evolution-bridge:3000/webhook/whatsapp",
    "events": [
      "MESSAGES_UPSERT",
      "MESSAGES_UPDATE",
      "CONNECTION_UPDATE"
    ]
  }'
```

## ⚡ PASO 4: Configurar N8N

### 4.1 Acceder al panel de N8N
Abrir navegador en: http://localhost:5678

### 4.2 Importar workflows

1. En N8N, ir a **Workflows** → **Import**
2. Importar los siguientes archivos:
   - `workflows/whatsapp-citamedica-complete.json`
   - `workflows/error-handler-notifications.json`
   - `workflows/appointment-management-crud.json`

### 4.3 Configurar variables de entorno en N8N

En cada workflow, verificar que las variables estén configuradas:
- `CITAMEDICA_API_URL`
- `EVOLUTION_API_URL`
- `EVOLUTION_API_KEY`
- `EVOLUTION_INSTANCE_NAME`

### 4.4 Activar workflows

Asegúrate de que todos los workflows estén **activos** (toggle verde).

## 🔗 PASO 5: Conectar con CitaMedicaBeta API

### 5.1 Verificar conectividad con tu API
```bash
curl http://localhost:4001/api/health
```

### 5.2 Test de endpoints principales
```bash
# Obtener citas
curl http://localhost:4001/api/appointments

# Obtener sobreturnos
curl http://localhost:4001/api/sobreturnos

# Verificar horarios disponibles
curl http://localhost:4001/api/appointments/available/$(date +%Y-%m-%d)
```

## ✅ PASO 6: Verificar Integración Completa

### 6.1 Health check del bridge
```bash
curl http://localhost:3000/health
curl http://localhost:3000/status
```

### 6.2 Test de mensaje de WhatsApp

Envía un mensaje de prueba desde tu WhatsApp al número vinculado:

```
Mensaje: "hola"
Respuesta esperada: Menú principal del bot
```

### 6.3 Test de funcionalidades

1. **Solicitar ayuda**: `ayuda`
2. **Agendar cita**: `cita`
3. **Solicitar sobreturno**: `sobreturno`

## 🔍 PASO 7: Monitoreo y Logs

### 7.1 Ver logs en tiempo real
```bash
# Todos los servicios
docker-compose -f docker-compose.dev.yml logs -f

# Solo el bridge
docker-compose -f docker-compose.dev.yml logs -f n8n-evolution-bridge

# Solo N8N
docker-compose -f docker-compose.dev.yml logs -f n8n
```

### 7.2 Logs específicos del sistema
```bash
# Logs del bridge
tail -f logs/app.log

# Solo errores
tail -f logs/error.log
```

## 🛠️ TROUBLESHOOTING

### Problema: EvolutionAPI no responde

**Solución**:
```bash
# Verificar estado
curl http://localhost:8080/instance/connectionState/citamedica-bot

# Reiniciar contenedor
docker restart evolution-api-dev
```

### Problema: N8N workflows no ejecutan

**Solución**:
1. Verificar que los webhooks estén activos
2. Revisar logs de N8N:
```bash
docker logs n8n-dev
```

### Problema: No se conecta con CitaMedicaBeta API

**Solución**:
1. Verificar que la API esté corriendo en el puerto 4001
2. Comprobar la URL en el `.env`:
```bash
CITAMEDICA_API_URL=http://host.docker.internal:4001/api
```

### Problema: WhatsApp no recibe mensajes

**Verificaciones**:
1. El código QR fue escaneado correctamente
2. La instancia está activa:
```bash
curl http://localhost:8080/instance/connectionState/citamedica-bot
```
3. El webhook está configurado:
```bash
curl http://localhost:8080/webhook/find/citamedica-bot
```

## 🔧 COMANDOS ÚTILES

### Docker
```bash
# Reiniciar todo
docker-compose -f docker-compose.dev.yml restart

# Ver uso de recursos
docker stats

# Limpiar todo
docker-compose -f docker-compose.dev.yml down -v
```

### Desarrollo
```bash
# Instalar dependencias
npm install

# Desarrollo local (sin Docker)
npm run dev

# Tests
npm test
```

### EvolutionAPI
```bash
# Estado de instancia
curl http://localhost:8080/instance/connectionState/citamedica-bot

# Listar instancias
curl http://localhost:8080/instance/fetchInstances

# Reiniciar instancia
curl -X POST http://localhost:8080/instance/restart/citamedica-bot
```

## 🚀 PASO 8: Puesta en Producción

### 8.1 Configurar entorno de producción

1. Editar `docker-compose.yml` para producción
2. Configurar variables de entorno seguras:

```bash
# Usar Docker secrets o variables de entorno del sistema
EVOLUTION_API_KEY=${EVOLUTION_API_KEY}
WEBHOOK_SECRET=${WEBHOOK_SECRET}
```

### 8.2 SSL/HTTPS

Para producción, configura un proxy reverso con SSL:

```nginx
server {
    listen 443 ssl;
    server_name tu-dominio.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 8.3 Monitoreo

Implementar alertas para:
- Estado de servicios Docker
- Uso de recursos (CPU, RAM, disco)
- Errores en logs
- Latencia de APIs

## 📞 Soporte

Si tienes problemas durante la instalación:

1. **Revisar logs**: `docker-compose logs -f`
2. **Verificar conectividad**: Usar los comandos curl de prueba
3. **Consultar documentación**: README.md completo
4. **Crear issue**: En el repositorio de GitHub

---

**¡Felicitaciones! 🎉**

Tu integración N8N-EvolutionAPI-CitaMedica está lista para usar. Los usuarios pueden ahora agendar citas médicas a través de WhatsApp de manera completamente automatizada.