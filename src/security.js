/**
 * ═══════════════════════════════════════════════════════════
 * MÓDULO: SEGURANÇA E CRIPTOGRAFIA
 * Arquivo: security.js
 * Descrição: Funções de segurança, criptografia e proteção
 * ═══════════════════════════════════════════════════════════
 * 
 * Responsabilidades:
 * - Criptografia AES-256 de dados sensíveis
 * - Hash de PINs com bcrypt
 * - Validação de acesso
 * - Geração de chaves seguras
 * - Timeout de sessão
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Constantes de segurança
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;
const SALT_ROUNDS = 10;

// Chave mestra de criptografia (em produção, usar variável de ambiente)
// IMPORTANTE: Esta chave deve ser mantida em segredo absoluto
let MASTER_KEY = null;

/**
 * Inicializa ou recupera a chave mestra de criptografia
 * Em produção, esta chave deve vir de variável de ambiente ou arquivo protegido
 * @returns {Buffer} Chave mestra
 */
function getMasterKey() {
  if (!MASTER_KEY) {
    // Gerar chave determinística baseada em identificador único do dispositivo
    // Em produção, usar uma chave fixa armazenada com segurança
    const identifier = process.env.DEVICE_ID || 'gyneco-bot-default-key';
    MASTER_KEY = crypto.scryptSync(identifier, 'salt', KEY_LENGTH);
  }
  return MASTER_KEY;
}

/**
 * Criptografa dados usando AES-256-GCM
 * @param {string} plaintext - Texto a ser criptografado
 * @returns {string} Texto criptografado em base64
 */
function encryptData(plaintext) {
  try {
    // Gerar IV (Initialization Vector) aleatório
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Criar cipher
    const cipher = crypto.createCipheriv(
      ENCRYPTION_ALGORITHM,
      getMasterKey(),
      iv
    );

    // Criptografar
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Obter tag de autenticação (GCM)
    const authTag = cipher.getAuthTag();

    // Combinar IV + AuthTag + Encrypted (tudo em base64)
    const combined = {
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      encrypted: encrypted
    };

    return Buffer.from(JSON.stringify(combined)).toString('base64');

  } catch (error) {
    console.error('❌ Erro ao criptografar:', error.message);
    throw new Error('Falha na criptografia');
  }
}

/**
 * Descriptografa dados
 * @param {string} ciphertext - Texto criptografado em base64
 * @returns {string} Texto descriptografado
 */
function decryptData(ciphertext) {
  try {
    // Decodificar estrutura
    const combined = JSON.parse(
      Buffer.from(ciphertext, 'base64').toString('utf8')
    );

    const iv = Buffer.from(combined.iv, 'base64');
    const authTag = Buffer.from(combined.authTag, 'base64');
    const encrypted = combined.encrypted;

    // Criar decipher
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_ALGORITHM,
      getMasterKey(),
      iv
    );

    // Configurar tag de autenticação
    decipher.setAuthTag(authTag);

    // Descriptografar
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;

  } catch (error) {
    console.error('❌ Erro ao descriptografar:', error.message);
    throw new Error('Falha na descriptografia');
  }
}

/**
 * Gera hash seguro de um PIN
 * @param {string} pin - PIN em texto plano
 * @returns {Promise<string>} Hash do PIN
 */
async function hashPIN(pin) {
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hash = await bcrypt.hash(pin, salt);
    return hash;
  } catch (error) {
    console.error('❌ Erro ao gerar hash:', error.message);
    throw new Error('Falha ao processar PIN');
  }
}

/**
 * Verifica se um PIN corresponde ao hash armazenado
 * @param {string} pin - PIN fornecido pelo usuário
 * @param {string} hash - Hash armazenado
 * @returns {Promise<boolean>} true se o PIN está correto
 */
async function verifyPIN(pin, hash) {
  try {
    return await bcrypt.compare(pin, hash);
  } catch (error) {
    console.error('❌ Erro ao verificar PIN:', error.message);
    return false;
  }
}

/**
 * Valida formato de PIN (4-6 dígitos)
 * @param {string} pin - PIN a ser validado
 * @returns {boolean} true se o PIN é válido
 */
function isValidPIN(pin) {
  return /^\d{4,6}$/.test(pin);
}

/**
 * Gera um token de sessão único
 * @param {string} userId - ID do usuário
 * @returns {string} Token de sessão
 */
function generateSessionToken(userId) {
  const timestamp = Date.now();
  const random = crypto.randomBytes(16).toString('hex');
  const data = `${userId}-${timestamp}-${random}`;
  
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex');
}

/**
 * Classe para gerenciar sessões de usuários
 * Implementa timeout automático por inatividade
 */
class SessionManager {
  constructor(timeoutMs = 1800000) { // 30 minutos padrão
    this.sessions = new Map();
    this.timeoutMs = timeoutMs;
  }

  /**
   * Cria uma nova sessão para usuário
   * @param {string} userId - ID do usuário
   * @returns {string} Token da sessão
   */
  createSession(userId) {
    const token = generateSessionToken(userId);
    const session = {
      userId,
      token,
      createdAt: Date.now(),
      lastActivity: Date.now()
    };
    
    this.sessions.set(userId, session);
    return token;
  }

  /**
   * Valida se sessão está ativa
   * @param {string} userId - ID do usuário
   * @param {string} token - Token da sessão
   * @returns {boolean} true se sessão válida
   */
  validateSession(userId, token) {
    const session = this.sessions.get(userId);
    
    if (!session) return false;
    if (session.token !== token) return false;

    // Verificar timeout
    const now = Date.now();
    const timeSinceActivity = now - session.lastActivity;
    
    if (timeSinceActivity > this.timeoutMs) {
      this.destroySession(userId);
      return false;
    }

    // Atualizar última atividade
    session.lastActivity = now;
    return true;
  }

  /**
   * Atualiza última atividade da sessão
   * @param {string} userId - ID do usuário
   */
  updateActivity(userId) {
    const session = this.sessions.get(userId);
    if (session) {
      session.lastActivity = Date.now();
    }
  }

  /**
   * Destrói uma sessão
   * @param {string} userId - ID do usuário
   */
  destroySession(userId) {
    this.sessions.delete(userId);
  }

  /**
   * Limpa sessões expiradas (executar periodicamente)
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    for (const [userId, session] of this.sessions.entries()) {
      const timeSinceActivity = now - session.lastActivity;
      if (timeSinceActivity > this.timeoutMs) {
        this.destroySession(userId);
      }
    }
  }
}

/**
 * Sanitiza entrada do usuário para prevenir injection
 * @param {string} input - Entrada do usuário
 * @returns {string} Entrada sanitizada
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  
  return input
    .trim()
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove scripts
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/[<>'"]/g, '') // Remove caracteres perigosos
    .substring(0, 5000); // Limitar tamanho
}

/**
 * Valida número de telefone WhatsApp
 * @param {string} phoneNumber - Número a ser validado
 * @returns {boolean} true se válido
 */
function isValidPhoneNumber(phoneNumber) {
  // Formato esperado: 5511999999999@s.whatsapp.net
  return /^\d{10,15}@s\.whatsapp\.net$/.test(phoneNumber);
}

/**
 * Gera relatório de segurança do sistema
 * @returns {Object} Estatísticas de segurança
 */
function getSecurityStatus() {
  return {
    encryptionEnabled: MASTER_KEY !== null,
    algorithm: ENCRYPTION_ALGORITHM,
    keyLength: KEY_LENGTH * 8, // em bits
    timestamp: new Date().toISOString()
  };
}

// Instância global do gerenciador de sessões
const sessionManager = new SessionManager();

// Limpar sessões expiradas a cada 10 minutos
setInterval(() => {
  sessionManager.cleanupExpiredSessions();
}, 600000);

// Exportar funções e classes do módulo
module.exports = {
  encryptData,
  decryptData,
  hashPIN,
  verifyPIN,
  isValidPIN,
  generateSessionToken,
  SessionManager,
  sessionManager,
  sanitizeInput,
  isValidPhoneNumber,
  getSecurityStatus
};