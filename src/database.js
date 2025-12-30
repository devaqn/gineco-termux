/**
 * ═══════════════════════════════════════════════════════════
 * MÓDULO: BANCO DE DADOS LOCAL
 * Arquivo: database.js
 * Descrição: Sistema de armazenamento de dados em JSON
 * ═══════════════════════════════════════════════════════════
 * 
 * Responsabilidades:
 * - Armazenar dados de cada usuária isoladamente
 * - Organizar registros por data (YYYY-MM-DD)
 * - Salvar/carregar dados de forma segura
 * - Gerenciar operações CRUD (Create, Read, Update, Delete)
 * - Manter integridade dos dados
 * - Suportar criptografia opcional (via security.js)
 */

const fs = require('fs');
const path = require('path');
const { encryptData, decryptData } = require('./security');

// Diretório base para dados dos usuários
const DATA_DIR = path.join(__dirname, '../data/users');

/**
 * Inicializa o sistema de banco de dados
 * Cria diretórios necessários se não existirem
 */
function initializeDatabase() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      console.log('   Diretório de dados criado:', DATA_DIR);
    }
    return true;
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error.message);
    throw error;
  }
}

/**
 * Sanitiza número de telefone para uso como identificador
 * Remove caracteres especiais e garante formato consistente
 * @param {string} phoneNumber - Número com formato: 5511999999999@s.whatsapp.net
 * @returns {string} Número sanitizado: 5511999999999
 */
function sanitizePhoneNumber(phoneNumber) {
  return phoneNumber.replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '');
}

/**
 * Obtém o caminho do arquivo de dados de um usuário
 * @param {string} userId - ID do usuário (número WhatsApp)
 * @returns {string} Caminho completo do arquivo
 */
function getUserDataPath(userId) {
  const sanitizedId = sanitizePhoneNumber(userId);
  return path.join(DATA_DIR, `${sanitizedId}.json`);
}

/**
 * Carrega dados de um usuário específico
 * @param {string} userId - ID do usuário
 * @param {boolean} encrypted - Se os dados estão criptografados
 * @returns {Object} Dados do usuário { records: [], metadata: {} }
 */
function loadUserData(userId, encrypted = false) {
  try {
    const filePath = getUserDataPath(userId);

    // Se arquivo não existe, retornar estrutura vazia
    if (!fs.existsSync(filePath)) {
      return {
        userId: sanitizePhoneNumber(userId),
        records: [],
        metadata: {
          createdAt: new Date().toISOString(),
          lastUpdate: new Date().toISOString(),
          totalRecords: 0
        }
      };
    }

    // Ler arquivo
    let fileContent = fs.readFileSync(filePath, 'utf8');

    // Descriptografar se necessário
    if (encrypted) {
      fileContent = decryptData(fileContent);
    }

    const data = JSON.parse(fileContent);
    return data;

  } catch (error) {
    console.error(`❌ Erro ao carregar dados do usuário ${userId}:`, error.message);
    
    // Retornar estrutura vazia em caso de erro
    return {
      userId: sanitizePhoneNumber(userId),
      records: [],
      metadata: {
        createdAt: new Date().toISOString(),
        lastUpdate: new Date().toISOString(),
        totalRecords: 0,
        error: 'Falha ao carregar dados anteriores'
      }
    };
  }
}

/**
 * Salva dados de um usuário
 * @param {string} userId - ID do usuário
 * @param {Object} data - Dados a serem salvos
 * @param {boolean} encrypted - Se deve criptografar os dados
 * @returns {boolean} true se salvou com sucesso
 */
function saveUserData(userId, data, encrypted = false) {
  try {
    const filePath = getUserDataPath(userId);

    // Atualizar metadata
    data.metadata = data.metadata || {};
    data.metadata.lastUpdate = new Date().toISOString();
    data.metadata.totalRecords = data.records.length;

    // Converter para JSON
    let jsonData = JSON.stringify(data, null, 2);

    // Criptografar se necessário
    if (encrypted) {
      jsonData = encryptData(jsonData);
    }

    // Salvar arquivo
    fs.writeFileSync(filePath, jsonData, 'utf8');
    
    return true;

  } catch (error) {
    console.error(`❌ Erro ao salvar dados do usuário ${userId}:`, error.message);
    return false;
  }
}

/**
 * Adiciona um novo registro para o usuário
 * @param {string} userId - ID do usuário
 * @param {Object} record - Registro a ser adicionado
 * @param {boolean} encrypted - Se usa criptografia
 * @returns {boolean} true se adicionou com sucesso
 */
function addRecord(userId, record, encrypted = false) {
  try {
    // Carregar dados existentes
    const userData = loadUserData(userId, encrypted);

    // Criar registro completo
    const newRecord = {
      id: generateRecordId(),
      timestamp: new Date().toISOString(),
      date: record.date || getTodayDate(),
      category: record.category || 'observacao',
      content: record.content,
      ...record // Mesclar campos adicionais
    };

    // Adicionar ao array de registros
    userData.records.push(newRecord);

    // Ordenar por data (mais recente primeiro)
    userData.records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Salvar
    return saveUserData(userId, userData, encrypted);

  } catch (error) {
    console.error(`❌ Erro ao adicionar registro:`, error.message);
    return false;
  }
}

/**
 * Obtém registros de uma data específica
 * @param {string} userId - ID do usuário
 * @param {string} date - Data no formato YYYY-MM-DD
 * @param {boolean} encrypted - Se usa criptografia
 * @returns {Array} Array de registros da data
 */
function getRecordsByDate(userId, date, encrypted = false) {
  try {
    const userData = loadUserData(userId, encrypted);
    
    return userData.records.filter(record => record.date === date);

  } catch (error) {
    console.error(`❌ Erro ao buscar registros por data:`, error.message);
    return [];
  }
}

/**
 * Obtém registros dos últimos N dias
 * @param {string} userId - ID do usuário
 * @param {number} days - Número de dias
 * @param {boolean} encrypted - Se usa criptografia
 * @returns {Array} Array de registros
 */
function getRecentRecords(userId, days = 30, encrypted = false) {
  try {
    const userData = loadUserData(userId, encrypted);
    
    // Calcular data limite
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - days);
    const limitDateStr = formatDate(limitDate);

    // Filtrar registros
    return userData.records.filter(record => record.date >= limitDateStr);

  } catch (error) {
    console.error(`❌ Erro ao buscar registros recentes:`, error.message);
    return [];
  }
}

/**
 * Obtém todos os registros de um usuário
 * @param {string} userId - ID do usuário
 * @param {boolean} encrypted - Se usa criptografia
 * @returns {Array} Array com todos os registros
 */
function getAllRecords(userId, encrypted = false) {
  try {
    const userData = loadUserData(userId, encrypted);
    return userData.records;
  } catch (error) {
    console.error(`❌ Erro ao buscar todos os registros:`, error.message);
    return [];
  }
}

/**
 * Deleta todos os dados de um usuário
 * @param {string} userId - ID do usuário
 * @returns {boolean} true se deletou com sucesso
 */
function deleteUserData(userId) {
  try {
    const filePath = getUserDataPath(userId);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    
    return false;

  } catch (error) {
    console.error(`❌ Erro ao deletar dados:`, error.message);
    return false;
  }
}

/**
 * Exporta dados de um usuário em formato legível
 * @param {string} userId - ID do usuário
 * @param {boolean} encrypted - Se usa criptografia
 * @returns {string} Dados formatados em texto
 */
function exportUserData(userId, encrypted = false) {
  try {
    const userData = loadUserData(userId, encrypted);
    
    if (userData.records.length === 0) {
      return '📋 Nenhum registro encontrado para exportar.';
    }

    let exportText = `═══════════════════════════════════════\n`;
    exportText += `💗 EXPORTAÇÃO DE DADOS - GINA BOT\n`;
    exportText += `═══════════════════════════════════════\n\n`;
    exportText += `📱 Usuária: ${userData.userId}\n`;
    exportText += `📊 Total de registros: ${userData.records.length}\n`;
    exportText += `📅 Última atualização: ${new Date(userData.metadata.lastUpdate).toLocaleString('pt-BR')}\n\n`;
    
    exportText += `═══════════════════════════════════════\n`;
    exportText += `📝 REGISTROS\n`;
    exportText += `═══════════════════════════════════════\n\n`;

    // Agrupar registros por data
    const recordsByDate = {};
    userData.records.forEach(record => {
      if (!recordsByDate[record.date]) {
        recordsByDate[record.date] = [];
      }
      recordsByDate[record.date].push(record);
    });

    // Ordenar datas (mais recente primeiro)
    const sortedDates = Object.keys(recordsByDate).sort().reverse();

    // Formatar cada data
    sortedDates.forEach(date => {
      const formattedDate = formatDateBR(date);
      exportText += `📅 ${formattedDate}\n`;
      exportText += `${'─'.repeat(40)}\n`;

      recordsByDate[date].forEach(record => {
        const emoji = getCategoryEmoji(record.category);
        exportText += `${emoji} ${record.category.toUpperCase()}\n`;
        exportText += `   ${record.content}\n`;
        exportText += `   ⏰ ${new Date(record.timestamp).toLocaleTimeString('pt-BR')}\n\n`;
      });
    });

    exportText += `═══════════════════════════════════════\n`;
    exportText += `Exportado em: ${new Date().toLocaleString('pt-BR')}\n`;
    exportText += `═══════════════════════════════════════\n`;

    return exportText;

  } catch (error) {
    console.error(`❌ Erro ao exportar dados:`, error.message);
    return '❌ Erro ao exportar dados. Tente novamente.';
  }
}

// ═══════════════════════════════════════
// FUNÇÕES AUXILIARES
// ═══════════════════════════════════════

/**
 * Gera ID único para registro
 * @returns {string} ID no formato: timestamp-random
 */
function generateRecordId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Retorna data de hoje no formato YYYY-MM-DD
 * @returns {string} Data formatada
 */
function getTodayDate() {
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

// Exportar funções do módulo
module.exports = {
  initializeDatabase,
  loadUserData,
  saveUserData,
  addRecord,
  getRecordsByDate,
  getRecentRecords,
  getAllRecords,
  deleteUserData,
  exportUserData,
  getTodayDate,
  formatDate,
  formatDateBR
};