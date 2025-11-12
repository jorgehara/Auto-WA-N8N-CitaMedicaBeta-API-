import Joi from 'joi';

// Esquemas de validación con Joi

// Validación para datos de citas
export const appointmentSchema = Joi.object({
    clientName: Joi.string()
        .min(3)
        .max(100)
        .required()
        .messages({
            'string.min': 'El nombre debe tener al menos 3 caracteres',
            'string.max': 'El nombre no puede exceder 100 caracteres',
            'any.required': 'El nombre es requerido'
        }),
    
    socialWork: Joi.string()
        .min(2)
        .max(100)
        .required()
        .messages({
            'string.min': 'La obra social debe tener al menos 2 caracteres',
            'any.required': 'La obra social es requerida'
        }),
    
    phone: Joi.string()
        .pattern(/^[\+]?[1-9][\d]{7,15}$/)
        .required()
        .messages({
            'string.pattern.base': 'Formato de teléfono inválido',
            'any.required': 'El teléfono es requerido'
        }),
    
    email: Joi.string()
        .email()
        .allow('')
        .optional(),
    
    date: Joi.date()
        .min('now')
        .required()
        .messages({
            'date.min': 'La fecha no puede ser en el pasado',
            'any.required': 'La fecha es requerida'
        }),
    
    time: Joi.string()
        .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .required()
        .messages({
            'string.pattern.base': 'Formato de hora inválido (HH:MM)',
            'any.required': 'La hora es requerida'
        }),
    
    description: Joi.string()
        .max(500)
        .allow('')
        .optional(),
    
    isSobreturno: Joi.boolean()
        .default(false)
});

// Validación para sobreturnos
export const sobreturnoSchema = appointmentSchema.keys({
    sobreturnoNumber: Joi.number()
        .integer()
        .min(1)
        .max(10)
        .required()
        .messages({
            'number.min': 'Número de sobreturno debe ser entre 1 y 10',
            'number.max': 'Número de sobreturno debe ser entre 1 y 10',
            'any.required': 'El número de sobreturno es requerido'
        })
});

// Validación para mensajes de WhatsApp
export const messageSchema = Joi.object({
    from: Joi.string()
        .pattern(/^[\d]+@[sc]\.whatsapp\.net$/)
        .required()
        .messages({
            'string.pattern.base': 'Formato de número de WhatsApp inválido',
            'any.required': 'El remitente es requerido'
        }),
    
    message: Joi.string()
        .min(1)
        .max(4096)
        .required()
        .messages({
            'string.min': 'El mensaje no puede estar vacío',
            'string.max': 'El mensaje es demasiado largo',
            'any.required': 'El mensaje es requerido'
        }),
    
    messageId: Joi.string()
        .required(),
    
    instance: Joi.string()
        .default('default'),
    
    type: Joi.string()
        .valid('text', 'image', 'audio', 'video', 'document')
        .default('text'),
    
    timestamp: Joi.date()
        .default(() => new Date()),
    
    isGroup: Joi.boolean()
        .default(false)
});

// Validación para configuración de webhook
export const webhookConfigSchema = Joi.object({
    url: Joi.string()
        .uri()
        .required()
        .messages({
            'string.uri': 'URL de webhook inválida',
            'any.required': 'URL del webhook es requerida'
        }),
    
    events: Joi.array()
        .items(Joi.string().valid(
            'APPLICATION_STARTUP',
            'QRCODE_UPDATED', 
            'CONNECTION_UPDATE',
            'MESSAGES_UPSERT',
            'MESSAGES_UPDATE',
            'SEND_MESSAGE'
        ))
        .min(1)
        .default(['MESSAGES_UPSERT']),
    
    instance: Joi.string()
        .default('default')
});

// Validación para datos de N8N workflow
export const n8nWorkflowSchema = Joi.object({
    webhookPath: Joi.string()
        .pattern(/^\/[\w\-\/]*$/)
        .required()
        .messages({
            'string.pattern.base': 'Ruta de webhook inválida',
            'any.required': 'La ruta del webhook es requerida'
        }),
    
    data: Joi.object()
        .required(),
    
    method: Joi.string()
        .valid('GET', 'POST', 'PUT', 'PATCH', 'DELETE')
        .default('POST')
});

// Función de validación helper
export const validateData = (data, schema, context = 'data') => {
    const { error, value } = schema.validate(data, {
        abortEarly: false,
        stripUnknown: true,
        convert: true
    });
    
    if (error) {
        const validationError = new Error(`Validación falló para ${context}: ${error.details.map(d => d.message).join(', ')}`);
        validationError.name = 'ValidationError';
        validationError.details = error.details;
        throw validationError;
    }
    
    return value;
};

// Validaciones específicas por tipo
export const validators = {
    appointment: (data) => validateData(data, appointmentSchema, 'cita'),
    sobreturno: (data) => validateData(data, sobreturnoSchema, 'sobreturno'),
    message: (data) => validateData(data, messageSchema, 'mensaje'),
    webhook: (data) => validateData(data, webhookConfigSchema, 'webhook'),
    n8nWorkflow: (data) => validateData(data, n8nWorkflowSchema, 'workflow N8N')
};

export default validators;