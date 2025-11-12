import { logger } from '../utils/logger.js';
import moment from 'moment-timezone';

class MessageProcessor {
    constructor(citaMedicaService, evolutionAPIService) {
        this.citaMedicaAPI = citaMedicaService;
        this.evolutionAPI = evolutionAPIService;
        this.timezone = process.env.TIMEZONE || 'America/Argentina/Buenos_Aires';
        
        // Estados de conversación por usuario
        this.userStates = new Map();
        
        // Configuración de horarios
        this.morningHours = ['10:00', '10:15', '10:30', '10:45', '11:00', '11:15', '11:30', '11:45'];
        this.afternoonHours = ['17:00', '17:15', '17:30', '17:45', '18:00', '18:15', '18:30', '18:45', '19:00', '19:15', '19:30', '19:45'];
        this.sobreturnoHours = {
            morning: ['11:00', '11:15', '11:30', '11:45', '12:00'],
            afternoon: ['19:00', '19:15', '19:30', '19:45', '20:00']
        };
    }

    /**
     * Procesa un mensaje entrante
     */
    async processMessage(messageInfo) {
        try {
            const { from, message, instance } = messageInfo;
            const normalizedMessage = this.normalizeMessage(message);

            logger.info('🧠 Procesando mensaje', {
                from,
                message: normalizedMessage,
                instance
            });

            // Verificar si es un mensaje de grupo (ignorar por ahora)
            if (messageInfo.isGroup) {
                logger.info('👥 Mensaje de grupo ignorado', { from });
                return null;
            }

            // Obtener o crear estado del usuario
            let userState = this.userStates.get(from) || this.createInitialState();

            // Procesar según el estado actual
            const response = await this.processUserMessage(normalizedMessage, userState, from);

            // Actualizar estado del usuario
            this.userStates.set(from, userState);

            return response;

        } catch (error) {
            logger.error('❌ Error procesando mensaje', {
                error: error.message,
                messageInfo
            });

            return {
                reply: 'Lo siento, ha ocurrido un error procesando tu mensaje. Por favor, intenta de nuevo.',
                notifyN8N: false
            };
        }
    }

    /**
     * Crea estado inicial para un usuario
     */
    createInitialState() {
        return {
            step: 'greeting',
            type: null, // 'appointment' | 'sobreturno' | 'query' | 'cancel'
            data: {},
            lastActivity: new Date(),
            attempts: 0
        };
    }

    /**
     * Normaliza el mensaje para facilitar el procesamiento
     */
    normalizeMessage(message) {
        return message
            .toLowerCase()
            .trim()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remover acentos
            .replace(/[^\w\s]/g, '') // Remover puntuación
            .replace(/\s+/g, ' '); // Múltiples espacios a uno
    }

    /**
     * Procesa mensaje según el estado del usuario
     */
    async processUserMessage(message, userState, userPhone) {
        // Verificar comandos globales primero
        const globalResponse = await this.handleGlobalCommands(message);
        if (globalResponse) {
            userState.step = 'greeting';
            userState.type = null;
            return globalResponse;
        }

        // Procesar según el paso actual
        switch (userState.step) {
            case 'greeting':
                return await this.handleGreeting(message, userState);
                
            case 'choosing_type':
                return await this.handleTypeChoice(message, userState);
                
            case 'collecting_name':
                return await this.handleNameCollection(message, userState);
                
            case 'collecting_social_work':
                return await this.handleSocialWorkCollection(message, userState);
                
            case 'choosing_date':
                return await this.handleDateChoice(message, userState);
                
            case 'choosing_time':
                return await this.handleTimeChoice(message, userState);
                
            case 'choosing_sobreturno':
                return await this.handleSobreturnoChoice(message, userState);
                
            case 'confirmation':
                return await this.handleConfirmation(message, userState, userPhone);
                
            case 'query_appointments':
                return await this.handleQueryAppointments(message, userState, userPhone);
                
            default:
                userState.step = 'greeting';
                return await this.handleGreeting(message, userState);
        }
    }

    /**
     * Maneja comandos globales (ayuda, inicio, etc.)
     */
    async handleGlobalCommands(message) {
        const helpCommands = ['ayuda', 'help', 'menu', 'opciones'];
        const startCommands = ['hola', 'inicio', 'empezar', 'start', 'comenzar'];
        const cancelCommands = ['cancelar', 'cancel', 'salir', 'exit', 'stop'];

        if (helpCommands.some(cmd => message.includes(cmd))) {
            return {
                reply: this.getHelpMessage(),
                notifyN8N: false
            };
        }

        if (startCommands.some(cmd => message.includes(cmd))) {
            return {
                reply: this.getWelcomeMessage(),
                notifyN8N: false
            };
        }

        if (cancelCommands.some(cmd => message.includes(cmd))) {
            return {
                reply: 'Conversación cancelada. Si necesitas ayuda, escribe "ayuda" o "hola" para comenzar de nuevo.',
                notifyN8N: false
            };
        }

        return null;
    }

    /**
     * Maneja el saludo inicial
     */
    async handleGreeting(message, userState) {
        const appointmentKeywords = ['cita', 'turno', 'consulta', 'reservar', 'appointment'];
        const sobreturnoKeywords = ['sobreturno', 'sobreturnos', 'urgente', 'emergencia'];
        const queryKeywords = ['ver', 'consultar', 'mostrar', 'listar', 'mis turnos', 'mis citas'];

        if (appointmentKeywords.some(keyword => message.includes(keyword))) {
            userState.step = 'collecting_name';
            userState.type = 'appointment';
            return {
                reply: '📅 *SOLICITUD DE CITA MÉDICA*\n\nPerfecto, voy a ayudarte a agendar una cita.\n\nPor favor, indícame tu *NOMBRE COMPLETO*:',
                notifyN8N: false
            };
        }

        if (sobreturnoKeywords.some(keyword => message.includes(keyword))) {
            userState.step = 'collecting_name';
            userState.type = 'sobreturno';
            return {
                reply: '🔄 *SOLICITUD DE SOBRETURNO*\n\nEntiendo que necesitas un sobreturno. Estos son turnos especiales fuera del horario normal.\n\nPor favor, indícame tu *NOMBRE COMPLETO*:',
                notifyN8N: false
            };
        }

        if (queryKeywords.some(keyword => message.includes(keyword))) {
            userState.step = 'query_appointments';
            userState.type = 'query';
            return {
                reply: '🔍 *CONSULTAR CITAS*\n\nPara consultar tus citas, por favor proporciona tu *NOMBRE COMPLETO* tal como fue registrado:',
                notifyN8N: false
            };
        }

        // Mensaje de bienvenida por defecto
        userState.step = 'choosing_type';
        return {
            reply: this.getWelcomeMessage(),
            notifyN8N: false
        };
    }

    /**
     * Maneja la elección del tipo de servicio
     */
    async handleTypeChoice(message, userState) {
        if (message.includes('1') || message.includes('cita') || message.includes('turno')) {
            userState.type = 'appointment';
            userState.step = 'collecting_name';
            return {
                reply: '📅 *CITA MÉDICA*\n\nPor favor, indícame tu *NOMBRE COMPLETO*:',
                notifyN8N: false
            };
        }

        if (message.includes('2') || message.includes('sobreturno')) {
            userState.type = 'sobreturno';
            userState.step = 'collecting_name';
            return {
                reply: '🔄 *SOBRETURNO*\n\nPor favor, indícame tu *NOMBRE COMPLETO*:',
                notifyN8N: false
            };
        }

        if (message.includes('3') || message.includes('consultar')) {
            userState.type = 'query';
            userState.step = 'query_appointments';
            return {
                reply: '🔍 *CONSULTAR CITAS*\n\nPor favor, proporciona tu *NOMBRE COMPLETO*:',
                notifyN8N: false
            };
        }

        // Si no entiende la opción
        return {
            reply: 'Por favor, selecciona una opción válida:\n\n1️⃣ Agendar cita\n2️⃣ Solicitar sobreturno\n3️⃣ Consultar mis citas\n\nEscribe el número o la opción que necesites.',
            notifyN8N: false
        };
    }

    /**
     * Recolecta el nombre del paciente
     */
    async handleNameCollection(message, userState) {
        if (message.length < 3) {
            userState.attempts += 1;
            if (userState.attempts >= 3) {
                userState.step = 'greeting';
                return {
                    reply: 'Demasiados intentos fallidos. Por favor, comienza de nuevo escribiendo "hola".',
                    notifyN8N: false
                };
            }
            return {
                reply: 'Por favor, proporciona un nombre válido (mínimo 3 caracteres):',
                notifyN8N: false
            };
        }

        userState.data.clientName = message;
        userState.step = 'collecting_social_work';
        userState.attempts = 0;

        return {
            reply: `Hola ${message} 👋\n\nAhora necesito saber tu *OBRA SOCIAL*.\n\nEjemplos: OSDE, Swiss Medical, PAMI, Particular, etc.`,
            notifyN8N: false
        };
    }

    /**
     * Recolecta la obra social
     */
    async handleSocialWorkCollection(message, userState) {
        if (message.length < 2) {
            return {
                reply: 'Por favor, proporciona una obra social válida:',
                notifyN8N: false
            };
        }

        userState.data.socialWork = message;
        
        if (userState.type === 'sobreturno') {
            userState.step = 'choosing_sobreturno';
            return await this.showAvailableSobreturnos(userState);
        } else {
            userState.step = 'choosing_date';
            return await this.showAvailableDates(userState);
        }
    }

    /**
     * Muestra fechas disponibles
     */
    async showAvailableDates(userState) {
        try {
            const dates = this.getNextAvailableDates(7); // Próximos 7 días
            const dateOptions = dates.map((date, index) => 
                `${index + 1}️⃣ ${this.formatDateSpanish(date)}`
            ).join('\n');

            userState.data.availableDates = dates;

            return {
                reply: `📅 *FECHAS DISPONIBLES*\n\nSelecciona la fecha que prefieres:\n\n${dateOptions}\n\nEscribe el número de la fecha que deseas:`,
                notifyN8N: false
            };

        } catch (error) {
            logger.error('❌ Error mostrando fechas', { error: error.message });
            return {
                reply: 'Error obteniendo fechas disponibles. Por favor, intenta más tarde.',
                notifyN8N: false
            };
        }
    }

    /**
     * Muestra sobreturnos disponibles
     */
    async showAvailableSobreturnos(userState) {
        try {
            const today = moment().tz(this.timezone).format('YYYY-MM-DD');
            const availableSobreturnos = await this.citaMedicaAPI.getAvailableSobreturnos(today);

            if (!availableSobreturnos.success || !availableSobreturnos.data?.data?.disponibles) {
                return {
                    reply: 'No hay sobreturnos disponibles para hoy. Los sobreturnos solo están disponibles el mismo día.',
                    notifyN8N: false
                };
            }

            const sobreturnos = availableSobreturnos.data.data.disponibles;
            const sobreturnoOptions = sobreturnos.map((st, index) => 
                `${index + 1}️⃣ ${st.horario} - Turno ${st.numero} (${st.turno})`
            ).join('\n');

            userState.data.availableSobreturnos = sobreturnos;
            userState.data.selectedDate = today;

            return {
                reply: `🔄 *SOBRETURNOS DISPONIBLES PARA HOY*\n\n${sobreturnoOptions}\n\n*Nota:* Los sobreturnos son turnos especiales fuera del horario normal.\n\nEscribe el número del sobreturno que deseas:`,
                notifyN8N: false
            };

        } catch (error) {
            logger.error('❌ Error obteniendo sobreturnos', { error: error.message });
            return {
                reply: 'Error obteniendo sobreturnos disponibles. Por favor, intenta más tarde.',
                notifyN8N: false
            };
        }
    }

    /**
     * Maneja la elección de fecha
     */
    async handleDateChoice(message, userState) {
        const choice = parseInt(message);
        const availableDates = userState.data.availableDates;

        if (isNaN(choice) || choice < 1 || choice > availableDates.length) {
            return {
                reply: `Por favor, selecciona un número válido (1-${availableDates.length}):`,
                notifyN8N: false
            };
        }

        const selectedDate = availableDates[choice - 1];
        userState.data.selectedDate = selectedDate;
        userState.step = 'choosing_time';

        return await this.showAvailableTimes(userState, selectedDate);
    }

    /**
     * Muestra horarios disponibles para una fecha
     */
    async showAvailableTimes(userState, date) {
        try {
            const availableSlots = await this.citaMedicaAPI.getAvailableAppointments(date);
            
            if (!availableSlots.success || !availableSlots.data?.length) {
                // Resetear para elegir otra fecha
                userState.step = 'choosing_date';
                return {
                    reply: `No hay horarios disponibles para ${this.formatDateSpanish(date)}.\n\nPor favor, selecciona otra fecha:`,
                    notifyN8N: false
                };
            }

            const morningSlots = availableSlots.data.filter(slot => 
                this.morningHours.includes(slot.time) && slot.available
            );
            const afternoonSlots = availableSlots.data.filter(slot => 
                this.afternoonHours.includes(slot.time) && slot.available
            );

            let timeOptions = '';
            let counter = 1;
            const allSlots = [];

            if (morningSlots.length > 0) {
                timeOptions += '*🌅 MAÑANA:*\n';
                morningSlots.forEach(slot => {
                    timeOptions += `${counter}️⃣ ${slot.time}\n`;
                    allSlots.push(slot);
                    counter++;
                });
            }

            if (afternoonSlots.length > 0) {
                timeOptions += '\n*🌆 TARDE:*\n';
                afternoonSlots.forEach(slot => {
                    timeOptions += `${counter}️⃣ ${slot.time}\n`;
                    allSlots.push(slot);
                    counter++;
                });
            }

            userState.data.availableTimes = allSlots;

            return {
                reply: `⏰ *HORARIOS DISPONIBLES*\n*${this.formatDateSpanish(date)}*\n\n${timeOptions}\nEscribe el número del horario que prefieres:`,
                notifyN8N: false
            };

        } catch (error) {
            logger.error('❌ Error obteniendo horarios', { error: error.message });
            return {
                reply: 'Error obteniendo horarios disponibles. Por favor, intenta más tarde.',
                notifyN8N: false
            };
        }
    }

    /**
     * Maneja la elección de horario
     */
    async handleTimeChoice(message, userState) {
        const choice = parseInt(message);
        const availableTimes = userState.data.availableTimes;

        if (isNaN(choice) || choice < 1 || choice > availableTimes.length) {
            return {
                reply: `Por favor, selecciona un número válido (1-${availableTimes.length}):`,
                notifyN8N: false
            };
        }

        const selectedTime = availableTimes[choice - 1];
        userState.data.selectedTime = selectedTime.time;
        userState.step = 'confirmation';

        return this.showConfirmation(userState);
    }

    /**
     * Maneja la elección de sobreturno
     */
    async handleSobreturnoChoice(message, userState) {
        const choice = parseInt(message);
        const availableSobreturnos = userState.data.availableSobreturnos;

        if (isNaN(choice) || choice < 1 || choice > availableSobreturnos.length) {
            return {
                reply: `Por favor, selecciona un número válido (1-${availableSobreturnos.length}):`,
                notifyN8N: false
            };
        }

        const selectedSobreturno = availableSobreturnos[choice - 1];
        userState.data.selectedSobreturno = selectedSobreturno;
        userState.data.selectedTime = selectedSobreturno.horario;
        userState.step = 'confirmation';

        return this.showConfirmation(userState);
    }

    /**
     * Muestra confirmación antes de crear la cita/sobreturno
     */
    showConfirmation(userState) {
        const { clientName, socialWork, selectedDate, selectedTime, selectedSobreturno } = userState.data;
        const issobreturno = userState.type === 'sobreturno';

        let confirmationMessage = `✅ *CONFIRMACIÓN DE ${issobreturno ? 'SOBRETURNO' : 'CITA'}*\n\n`;
        confirmationMessage += `👤 *Paciente:* ${clientName}\n`;
        confirmationMessage += `🏥 *Obra Social:* ${socialWork}\n`;
        confirmationMessage += `📅 *Fecha:* ${this.formatDateSpanish(selectedDate)}\n`;
        confirmationMessage += `⏰ *Horario:* ${selectedTime}\n`;

        if (issobreturno) {
            confirmationMessage += `🔄 *Sobreturno:* Nº ${selectedSobreturno.numero} (${selectedSobreturno.turno})\n`;
        }

        confirmationMessage += '\n¿Confirmas esta cita?\n\n✅ Escribe "SI" para confirmar\n❌ Escribe "NO" para cancelar';

        return {
            reply: confirmationMessage,
            notifyN8N: false
        };
    }

    /**
     * Maneja la confirmación final
     */
    async handleConfirmation(message, userState, userPhone) {
        const confirmed = message.includes('si') || message.includes('yes') || message.includes('confirmar');
        const cancelled = message.includes('no') || message.includes('cancelar');

        if (cancelled) {
            userState.step = 'greeting';
            return {
                reply: 'Cita cancelada. Si necesitas ayuda, escribe "hola" para comenzar de nuevo.',
                notifyN8N: false
            };
        }

        if (!confirmed) {
            return {
                reply: 'Por favor, escribe "SI" para confirmar o "NO" para cancelar:',
                notifyN8N: false
            };
        }

        // Crear la cita/sobreturno
        try {
            const appointmentData = {
                clientName: userState.data.clientName,
                socialWork: userState.data.socialWork,
                phone: userPhone.replace('@s.whatsapp.net', ''),
                email: '',
                date: userState.data.selectedDate,
                time: userState.data.selectedTime,
                description: `Agendado via WhatsApp - ${userState.type}`,
                isSobreturno: userState.type === 'sobreturno'
            };

            let result;
            if (userState.type === 'sobreturno') {
                appointmentData.sobreturnoNumber = userState.data.selectedSobreturno.numero;
                result = await this.citaMedicaAPI.createSobreturno(appointmentData);
            } else {
                result = await this.citaMedicaAPI.createAppointment(appointmentData);
            }

            // Resetear estado
            userState.step = 'greeting';
            userState.type = null;
            userState.data = {};

            const successMessage = userState.type === 'sobreturno' ? 
                `🎉 *SOBRETURNO CONFIRMADO*\n\n` +
                `✅ Tu sobreturno ha sido agendado exitosamente:\n\n` +
                `👤 *Paciente:* ${appointmentData.clientName}\n` +
                `📅 *Fecha:* ${this.formatDateSpanish(appointmentData.date)}\n` +
                `⏰ *Horario:* ${appointmentData.time}\n` +
                `🔄 *Sobreturno:* Nº ${appointmentData.sobreturnoNumber}\n\n` +
                `*Importante:* Los sobreturnos son atendidos según orden de llegada después de las citas regulares.\n\n` +
                `¡Te esperamos! 🏥` :
                `🎉 *CITA CONFIRMADA*\n\n` +
                `✅ Tu cita médica ha sido agendada exitosamente:\n\n` +
                `👤 *Paciente:* ${appointmentData.clientName}\n` +
                `📅 *Fecha:* ${this.formatDateSpanish(appointmentData.date)}\n` +
                `⏰ *Horario:* ${appointmentData.time}\n\n` +
                `*Recordatorio:* Llega 10 minutos antes de tu cita.\n\n` +
                `¡Te esperamos! 🏥`;

            return {
                reply: successMessage,
                notifyN8N: true,
                workflowData: {
                    webhookPath: userState.type === 'sobreturno' ? '/sobreturno-created' : '/appointment-created',
                    data: {
                        appointment: result,
                        patient: {
                            name: appointmentData.clientName,
                            phone: appointmentData.phone,
                            socialWork: appointmentData.socialWork
                        },
                        type: userState.type
                    }
                }
            };

        } catch (error) {
            logger.error('❌ Error creando cita/sobreturno', { error: error.message });
            
            userState.step = 'greeting';
            return {
                reply: `❌ Error al agendar la cita: ${error.message}\n\nPor favor, intenta de nuevo escribiendo "hola".`,
                notifyN8N: false
            };
        }
    }

    /**
     * Maneja consultas de citas existentes
     */
    async handleQueryAppointments(message, userState, userPhone) {
        // Implementar lógica para consultar citas existentes
        // Por ahora, respuesta básica
        userState.step = 'greeting';
        return {
            reply: 'Esta funcionalidad está en desarrollo. Por favor, contacta directamente con la clínica para consultar tus citas.',
            notifyN8N: false
        };
    }

    // ==================== UTILIDADES ====================

    /**
     * Obtiene próximas fechas disponibles
     */
    getNextAvailableDates(days = 7) {
        const dates = [];
        const today = moment().tz(this.timezone);
        
        for (let i = 1; i <= days; i++) {
            const date = today.clone().add(i, 'days');
            // Saltar fines de semana si es necesario
            if (date.day() !== 0 && date.day() !== 6) { // 0=Sunday, 6=Saturday
                dates.push(date.format('YYYY-MM-DD'));
            }
        }
        
        return dates;
    }

    /**
     * Formatea fecha en español
     */
    formatDateSpanish(dateString) {
        const date = moment(dateString).tz(this.timezone);
        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        
        return `${days[date.day()]} ${date.date()} de ${months[date.month()]}`;
    }

    /**
     * Mensaje de bienvenida
     */
    getWelcomeMessage() {
        return `🏥 *${process.env.BOT_NAME || 'Anita - Asistente Médica'}*\n\n` +
               `¡Hola! Soy tu asistente virtual para gestionar citas médicas.\n\n` +
               `¿En qué puedo ayudarte hoy?\n\n` +
               `1️⃣ Agendar una cita médica\n` +
               `2️⃣ Solicitar un sobreturno\n` +
               `3️⃣ Consultar mis citas\n\n` +
               `Escribe el número de la opción que necesites o describe lo que buscas.`;
    }

    /**
     * Mensaje de ayuda
     */
    getHelpMessage() {
        return `📋 *AYUDA - COMANDOS DISPONIBLES*\n\n` +
               `🏥 *Para agendar citas:*\n` +
               `• "cita" o "turno" - Nueva cita médica\n` +
               `• "sobreturno" - Turno urgente\n\n` +
               `🔍 *Para consultas:*\n` +
               `• "ver citas" - Consultar mis turnos\n` +
               `• "ayuda" - Mostrar esta ayuda\n\n` +
               `⚙️ *Comandos generales:*\n` +
               `• "hola" - Volver al menú principal\n` +
               `• "cancelar" - Cancelar operación actual\n\n` +
               `*Horarios de atención:*\n` +
               `🌅 Mañana: 10:00 - 12:00\n` +
               `🌆 Tarde: 17:00 - 20:00\n\n` +
               `¿En qué puedo ayudarte?`;
    }
}

export default MessageProcessor;