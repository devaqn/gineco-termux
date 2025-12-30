/**
 * ═══════════════════════════════════════════════════════════
 * MÓDULO: PROCESSADOR DE MENSAGENS
 * Arquivo: processor.js
 * Descrição: Lógica central de processamento de mensagens
 * ═══════════════════════════════════════════════════════════
 * 
 * Responsabilidades:
 * - Receber mensagens brutas do WhatsApp
 * - Identificar se é comando ou conversa natural
 * - Rotear para handlers apropriados
 * - Integrar WhatsApp ↔ Gemini ↔ Database
 * - Retornar respostas formatadas
 */

const { sendToGemini, classifyMessage, generateInsights } = require('./gemini');
const { 
  addRecord, 
  getRecordsByDate, 
  getRecentRecords, 
  getAllRecords,
  deleteUserData,
  exportUserData,
  getTodayDate,
  formatDateBR
} = require('./database');
const { parseDateFromMessage } = require('./utils');

/**
 * Função principal de processamento de mensagens
 * Decide se é comando ou conversa natural e roteia adequadamente
 * @param {string} from - Número WhatsApp do remetente
 * @param {string} message - Conteúdo da mensagem
 * @param {Object} config - Configurações da aplicação
 * @returns {Promise<string>} Resposta a ser enviada
 */
async function processMessage(from, message, config) {
  try {
    const userId = from;
    const trimmedMessage = message.trim();

    // Verificar se é um comando (começa com /)
    if (trimmedMessage.startsWith('/')) {
      return await processCommand(userId, trimmedMessage, config);
    }

    // Caso contrário, é uma conversa natural
    return await processNaturalMessage(userId, trimmedMessage, config);

  } catch (error) {
    console.error('❌ Erro no processamento:', error.message);
    return '😔 Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.';
  }
}

/**
 * Processa comandos iniciados com /
 * @param {string} userId - ID do usuário
 * @param {string} message - Mensagem completa
 * @param {Object} config - Configurações
 * @returns {Promise<string>} Resposta do comando
 */
async function processCommand(userId, message, config) {
  const parts = message.split(' ');
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  const encrypted = config.security?.enableEncryption || false;

  switch (command) {
    case '/hoje':
      return await handleTodayCommand(userId, encrypted);

    case '/ontem':
      return await handleYesterdayCommand(userId, encrypted);

    case '/relatorio':
      return await handleReportCommand(userId, args, encrypted);

    case '/resumo':
      return await handleSummaryCommand(userId, encrypted);

    case '/insights':
      return await handleInsightsCommand(userId, encrypted);

    case '/ajuda':
      return handleHelpCommand();

    case '/exportar':
      return await handleExportCommand(userId, encrypted);

    case '/limpar':
      return await handleClearCommand(userId);

    default:
      return '❓ Comando não reconhecido. Digite /ajuda para ver comandos disponíveis.';
  }
}

/**
 * Processa mensagens em linguagem natural
 * Usa Gemini para entender e responder, salvando dados quando necessário
 * @param {string} userId - ID do usuário
 * @param {string} message - Mensagem do usuário
 * @param {Object} config - Configurações
 * @returns {Promise<string>} Resposta da IA
 */
async function processNaturalMessage(userId, message, config) {
  try {
    const encrypted = config.security?.enableEncryption || false;

    // 1. Classificar a mensagem usando Gemini
    const classification = await classifyMessage(message);

    // 2. Verificar se é um registro de informação
    const isRecord = classification.category !== 'pergunta' && 
                    classification.content.length > 0;

    if (isRecord) {
      // 3. Salvar registro no banco de dados
      const recordDate = parseDateFromMessage(classification.date);
      
      const recordSaved = addRecord(userId, {
        date: recordDate,
        category: classification.category,
        content: classification.content,
        originalMessage: message
      }, encrypted);

      if (!recordSaved) {
        return '😔 Desculpe, não consegui salvar seu registro. Tente novamente.';
      }
    }

    // 4. Obter contexto recente da usuária (últimos 5 registros)
    const recentRecords = getRecentRecords(userId, 7, encrypted).slice(0, 5);

    // 5. Enviar para Gemini para gerar resposta empática
    const context = {
      recentHistory: recentRecords.map(r => ({
        date: r.date,
        category: r.category,
        content: r.content
      })),
      isCommand: false
    };

    const aiResponse = await sendToGemini(message, context);

    return aiResponse;

  } catch (error) {
    console.error('❌ Erro ao processar mensagem natural:', error.message);
    return '😔 Desculpe, tive um problema ao processar sua mensagem. Tente reformular.';
  }
}

// ═══════════════════════════════════════
// HANDLERS DE COMANDOS
// ═══════════════════════════════════════

/**
 * Handler: /hoje
 * Mostra registros do dia atual
 */
async function handleTodayCommand(userId, encrypted) {
  const today = getTodayDate();
  const records = getRecordsByDate(userId, today, encrypted);

  if (records.length === 0) {
    return '📅 *Hoje*\n\nAinda não há registros para hoje. Conte-me sobre seu dia! 💗';
  }

  let response = `📅 *Registros de Hoje* (${formatDateBR(today)})\n\n`;
  
  records.forEach((record, index) => {
    const emoji = getCategoryEmoji(record.category);
    response += `${emoji} *${record.category.toUpperCase()}*\n`;
    response += `${record.content}\n`;
    response += `⏰ ${new Date(record.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}\n\n`;
  });

  return response;
}

/**
 * Handler: /ontem
 * Mostra registros de ontem
 */
async function handleYesterdayCommand(userId, encrypted) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const records = getRecordsByDate(userId, yesterdayStr, encrypted);

  if (records.length === 0) {
    return `📅 *Ontem* (${formatDateBR(yesterdayStr)})\n\nNão há registros para ontem.`;
  }

  let response = `📅 *Registros de Ontem* (${formatDateBR(yesterdayStr)})\n\n`;
  
  records.forEach((record) => {
    const emoji = getCategoryEmoji(record.category);
    response += `${emoji} *${record.category.toUpperCase()}*\n`;
    response += `${record.content}\n\n`;
  });

  return response;
}

/**
 * Handler: /relatorio DD/MM/AA ou DD/MM/YYYY
 * Mostra registros de uma data específica
 */
async function handleReportCommand(userId, args, encrypted) {
  if (args.length === 0) {
    return '📅 *Relatório de Data Específica*\n\nUso: /relatorio DD/MM/AA\nExemplo: /relatorio 02/08/25';
  }

  const dateStr = args[0];
  const parsedDate = parseDateFromBR(dateStr);

  if (!parsedDate) {
    return '❌ Data inválida. Use o formato: DD/MM/AA ou DD/MM/YYYY\nExemplo: /relatorio 02/08/25';
  }

  const records = getRecordsByDate(userId, parsedDate, encrypted);

  if (records.length === 0) {
    return `📅 *Relatório* (${formatDateBR(parsedDate)})\n\nNão há registros para esta data.`;
  }

  let response = `📅 *Relatório* (${formatDateBR(parsedDate)})\n\n`;
  
  records.forEach((record) => {
    const emoji = getCategoryEmoji(record.category);
    response += `${emoji} *${record.category.toUpperCase()}*\n`;
    response += `${record.content}\n\n`;
  });

  return response;
}

/**
 * Handler: /resumo
 * Mostra resumo dos últimos 30 dias
 */
async function handleSummaryCommand(userId, encrypted) {
  const records = getRecentRecords(userId, 30, encrypted);

  if (records.length === 0) {
    return '📊 *Resumo - Últimos 30 Dias*\n\nAinda não há registros suficientes. Continue usando a Gina! 💗';
  }

  // Contar registros por categoria
  const categoryCounts = {};
  records.forEach(record => {
    categoryCounts[record.category] = (categoryCounts[record.category] || 0) + 1;
  });

  let response = `📊 *Resumo - Últimos 30 Dias*\n\n`;
  response += `📝 Total de registros: ${records.length}\n\n`;
  response += `📋 *Por categoria:*\n`;

  Object.entries(categoryCounts).forEach(([category, count]) => {
    const emoji = getCategoryEmoji(category);
    response += `${emoji} ${category}: ${count} registro(s)\n`;
  });

  response += `\n💡 Use /insights para análises mais detalhadas!`;

  return response;
}

/**
 * Handler: /insights
 * Gera insights usando IA sobre o histórico
 */
async function handleInsightsCommand(userId, encrypted) {
  const records = getRecentRecords(userId, 60, encrypted);

  if (records.length < 5) {
    return '📊 *Insights*\n\nAinda não há registros suficientes para gerar insights. Continue registrando suas informações! 💗';
  }

  const insights = await generateInsights(records);

  return `📊 *Insights sobre sua Saúde*\n\n${insights}\n\n⚕️ *Lembre-se:* Estes são apenas padrões observados. Para avaliação profissional, consulte um ginecologista.`;
}

/**
 * Handler: /ajuda
 * Lista todos os comandos disponíveis
 */
function handleHelpCommand() {
  return `💗 *Comandos Disponíveis da Gina*\n\n` +
         `📅 *Consultas:*\n` +
         `/hoje - Ver registros de hoje\n` +
         `/ontem - Ver registros de ontem\n` +
         `/relatorio DD/MM/AA - Ver data específica\n` +
         `/resumo - Resumo dos últimos 30 dias\n` +
         `/insights - Análise de padrões\n\n` +
         `⚙️ *Gerenciamento:*\n` +
         `/exportar - Exportar todos os dados\n` +
         `/limpar - Apagar todos os dados\n` +
         `/ajuda - Ver esta mensagem\n\n` +
         `💬 *Conversa Natural:*\n` +
         `Você também pode conversar naturalmente!\n` +
         `Exemplos:\n` +
         `• "Minha menstruação começou hoje"\n` +
         `• "Tomei anticoncepcional às 8h"\n` +
         `• "Tô com cólica forte"\n\n` +
         `Estou aqui para ajudar! 💗`;
}

/**
 * Handler: /exportar
 * Exporta todos os dados em formato texto
 */
async function handleExportCommand(userId, encrypted) {
  const exportText = exportUserData(userId, encrypted);
  
  return `💾 *Exportação de Dados*\n\n` +
         `Seus dados completos:\n\n` +
         `${exportText}\n\n` +
         `_Você pode copiar e salvar este texto em local seguro._`;
}

/**
 * Handler: /limpar
 * Apaga todos os dados do usuário (com confirmação)
 */
async function handleClearCommand(userId) {
  // Nota: Em produção, adicionar sistema de confirmação
  // Por ora, apenas deletar
  const deleted = deleteUserData(userId);

  if (deleted) {
    return `🗑️ *Dados Apagados*\n\nTodos os seus registros foram removidos com sucesso.\n\nVocê pode começar novos registros a qualquer momento! 💗`;
  } else {
    return `ℹ️ Não há dados para apagar ou você ainda não possui registros.`;
  }
}

// ═══════════════════════════════════════
// FUNÇÕES AUXILIARES
// ═══════════════════════════════════════

/**
 * Retorna emoji correspondente à categoria
 * @param {string} category - Categoria do registro
 * @returns {string} Emoji
 */
function getCategoryEmoji(category) {
  const emojis = {
    'menstruacao': '🩸',
    'anticoncepcional': '💊',
    'sintomas': '🤒',
    'sexual': '💑',
    'observacao': '📝'
  };
  return emojis[category] || '📝';
}

/**
 * Converte data brasileira (DD/MM/AA ou DD/MM/YYYY) para YYYY-MM-DD
 * @param {string} dateBR - Data em formato brasileiro
 * @returns {string|null} Data em formato YYYY-MM-DD ou null se inválida
 */
function parseDateFromBR(dateBR) {
  try {
    const parts = dateBR.split('/');
    
    if (parts.length !== 3) return null;

    let day = parts[0].padStart(2, '0');
    let month = parts[1].padStart(2, '0');
    let year = parts[2];

    // Converter ano de 2 dígitos para 4
    if (year.length === 2) {
      const currentYear = new Date().getFullYear();
      const century = Math.floor(currentYear / 100) * 100;
      year = century + parseInt(year);
    }

    // Validar
    const date = new Date(`${year}-${month}-${day}`);
    if (isNaN(date.getTime())) return null;

    return `${year}-${month}-${day}`;

  } catch (error) {
    return null;
  }
}

// Exportar funções do módulo
module.exports = {
  processMessage,
  processCommand,
  processNaturalMessage
};