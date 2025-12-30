/**
 * ═══════════════════════════════════════════════════════════
 * MÓDULO: UTILIDADES
 * Arquivo: utils.js
 * Descrição: Funções auxiliares e helpers gerais
 * ═══════════════════════════════════════════════════════════
 * 
 * Responsabilidades:
 * - Parsing e formatação de datas
 * - Validação de configurações
 * - Criação de diretórios
 * - Funções de formatação de texto
 * - Helpers diversos
 */

const fs = require('fs');
const path = require('path');

/**
 * Valida configurações obrigatórias
 * @param {Object} config - Objeto de configuração
 * @returns {boolean} true se configuração válida
 */
function validateConfig(config) {
  // Validar estrutura básica
  if (!config || typeof config !== 'object') {
    console.error('❌ Config deve ser um objeto');
    return false;
  }

  // Validar seção Gemini
  if (!config.gemini || !config.gemini.apiKey) {
    console.error('❌ API Key do Gemini não configurada');
    return false;
  }

  if (config.gemini.apiKey === 'SUA_API_KEY_AQUI') {
    console.error('❌ Configure uma API Key válida do Gemini');
    return false;
  }

  // Validar modelo
  if (!config.gemini.model) {
    config.gemini.model = 'gemini-1.5-flash';
    console.log('ℹ️  Usando modelo padrão: gemini-1.5-flash');
  }

  // Validar seção de segurança (opcional)
  if (!config.security) {
    config.security = {
      enableEncryption: true,
      enablePIN: false,
      sessionTimeout: 1800000
    };
  }

  // Validar seção do bot (opcional)
  if (!config.bot) {
    config.bot = {
      botName: 'Gina',
      language: 'pt-BR'
    };
  }

  return true;
}

/**
 * Garante que todos os diretórios necessários existem
 * Cria diretórios que não existem
 */
function ensureDirectories() {
  const directories = [
    path.join(__dirname, '../data'),
    path.join(__dirname, '../data/users'),
    path.join(__dirname, '../data/sessions'),
    path.join(__dirname, '../logs'),
    path.join(__dirname, '../config')
  ];

  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`   ✅ Diretório criado: ${dir}`);
    }
  });
}

/**
 * Interpreta expressões de data em linguagem natural
 * @param {string} dateExpression - Expressão de data (hoje, ontem, 02/08/25)
 * @returns {string} Data no formato YYYY-MM-DD
 */
function parseDateFromMessage(dateExpression) {
  const expr = dateExpression.toLowerCase().trim();
  
  // Hoje
  if (expr === 'today' || expr === 'hoje') {
    return formatDate(new Date());
  }

  // Ontem
  if (expr === 'yesterday' || expr === 'ontem') {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return formatDate(yesterday);
  }

  // Anteontem
  if (expr === 'anteontem') {
    const dayBefore = new Date();
    dayBefore.setDate(dayBefore.getDate() - 2);
    return formatDate(dayBefore);
  }

  // Tentar parsear data específica (DD/MM/YY ou DD/MM/YYYY)
  const dateMatch = expr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (dateMatch) {
    let day = dateMatch[1].padStart(2, '0');
    let month = dateMatch[2].padStart(2, '0');
    let year = dateMatch[3];

    // Converter ano de 2 dígitos para 4
    if (year.length === 2) {
      const currentYear = new Date().getFullYear();
      const century = Math.floor(currentYear / 100) * 100;
      year = century + parseInt(year);
    }

    return `${year}-${month}-${day}`;
  }

  // Se não reconhecer, assumir hoje
  return formatDate(new Date());
}

/**
 * Formata objeto Date para string YYYY-MM-DD
 * @param {Date} date - Objeto Date
 * @returns {string} Data formatada
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formata data para padrão brasileiro DD/MM/YYYY
 * @param {string} dateStr - Data em formato YYYY-MM-DD
 * @returns {string} Data em formato DD/MM/YYYY
 */
function formatDateBR(dateStr) {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Calcula diferença em dias entre duas datas
 * @param {string} date1 - Data em formato YYYY-MM-DD
 * @param {string} date2 - Data em formato YYYY-MM-DD
 * @returns {number} Diferença em dias
 */
function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Retorna data de hoje no formato YYYY-MM-DD
 * @returns {string} Data de hoje
 */
function getTodayDate() {
  return formatDate(new Date());
}

/**
 * Trunca texto longo para tamanho máximo
 * @param {string} text - Texto a ser truncado
 * @param {number} maxLength - Tamanho máximo
 * @returns {string} Texto truncado
 */
function truncateText(text, maxLength = 100) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Capitaliza primeira letra de cada palavra
 * @param {string} text - Texto a ser capitalizado
 * @returns {string} Texto capitalizado
 */
function capitalizeWords(text) {
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Remove acentos de uma string
 * @param {string} text - Texto com acentos
 * @returns {string} Texto sem acentos
 */
function removeAccents(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Valida se uma string é um JSON válido
 * @param {string} str - String a ser validada
 * @returns {boolean} true se for JSON válido
 */
function isValidJSON(str) {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gera ID único baseado em timestamp
 * @returns {string} ID único
 */
function generateUniqueId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Formata bytes em formato legível (KB, MB, etc)
 * @param {number} bytes - Quantidade de bytes
 * @returns {string} Tamanho formatado
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Pausa execução por tempo determinado
 * @param {number} ms - Milissegundos para aguardar
 * @returns {Promise} Promise que resolve após o tempo
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry de função assíncrona com backoff exponencial
 * @param {Function} fn - Função a ser executada
 * @param {number} maxRetries - Número máximo de tentativas
 * @param {number} delayMs - Delay inicial em ms
 * @returns {Promise} Resultado da função
 */
async function retryWithBackoff(fn, maxRetries = 3, delayMs = 1000) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (i < maxRetries - 1) {
        const waitTime = delayMs * Math.pow(2, i);
        console.log(`⚠️  Tentativa ${i + 1} falhou. Aguardando ${waitTime}ms...`);
        await sleep(waitTime);
      }
    }
  }
  
  throw lastError;
}

/**
 * Sanitiza nome de arquivo
 * @param {string} filename - Nome do arquivo
 * @returns {string} Nome sanitizado
 */
function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-z0-9.-]/gi, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase();
}

/**
 * Verifica se string contém apenas números
 * @param {string} str - String a ser verificada
 * @returns {boolean} true se contém apenas números
 */
function isNumeric(str) {
  return /^\d+$/.test(str);
}

/**
 * Obtém informações do sistema (útil para debug)
 * @returns {Object} Informações do sistema
 */
function getSystemInfo() {
  return {
    platform: process.platform,
    nodeVersion: process.version,
    architecture: process.arch,
    memory: {
      total: formatBytes(require('os').totalmem()),
      free: formatBytes(require('os').freemem())
    },
    uptime: Math.floor(process.uptime()) + 's'
  };
}

/**
 * Logger simples para debug
 * @param {string} level - Nível do log (info, warn, error)
 * @param {string} message - Mensagem
 * @param {Object} data - Dados adicionais
 */
function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    message,
    ...data
  };

  // Em produção, salvar em arquivo
  // Por ora, apenas console
  if (level === 'error') {
    console.error(JSON.stringify(logEntry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(logEntry));
  } else {
    console.log(JSON.stringify(logEntry));
  }
}

/**
 * Cria banner ASCII para exibição no terminal
 * @param {string} text - Texto do banner
 * @returns {string} Banner formatado
 */
function createBanner(text) {
  const border = '═'.repeat(text.length + 4);
  return `\n${border}\n  ${text}  \n${border}\n`;
}

// Exportar funções do módulo
module.exports = {
  validateConfig,
  ensureDirectories,
  parseDateFromMessage,
  formatDate,
  formatDateBR,
  daysBetween,
  getTodayDate,
  truncateText,
  capitalizeWords,
  removeAccents,
  isValidJSON,
  generateUniqueId,
  formatBytes,
  sleep,
  retryWithBackoff,
  sanitizeFilename,
  isNumeric,
  getSystemInfo,
  log,
  createBanner
};