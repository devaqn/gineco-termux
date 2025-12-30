/**
 * ═══════════════════════════════════════════════════════════
 * BOT GINECOLÓGICO - WHATSAPP + GEMINI AI
 * Arquivo: index.js
 * Descrição: Ponto de entrada principal da aplicação
 * ═══════════════════════════════════════════════════════════
 * 
 * Este arquivo é responsável por:
 * - Inicializar todos os módulos do sistema
 * - Conectar ao WhatsApp via Baileys
 * - Configurar listeners de mensagens
 * - Gerenciar ciclo de vida da aplicação
 * - Tratamento de erros globais
 */

const fs = require('fs');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

// Importar módulos personalizados
const { initializeGemini } = require('./gemini');
const { initializeDatabase } = require('./database');
const { processMessage } = require('./processor');
const { validateConfig, ensureDirectories } = require('./utils');

/**
 * Configuração global do logger
 * Usa pino para logs leves e eficientes
 * Nível: 'silent' em produção para economizar recursos
 */
const logger = pino({ 
  level: 'silent',
  transport: {
    target: 'pino/file',
    options: { destination: './logs/app.log' }
  }
});

/**
 * Carrega configurações do arquivo config.json
 * @returns {Object} Configurações da aplicação
 */
function loadConfig() {
  try {
    const configPath = path.join(__dirname, '../config/config.json');
    
    if (!fs.existsSync(configPath)) {
      console.error('❌ Arquivo config/config.json não encontrado!');
      console.log('📝 Crie o arquivo com base no README.md');
      process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Validar configurações obrigatórias
    if (!validateConfig(config)) {
      console.error('❌ Configuração inválida! Verifique config.json');
      process.exit(1);
    }

    return config;
  } catch (error) {
    console.error('❌ Erro ao carregar configurações:', error.message);
    process.exit(1);
  }
}

/**
 * Inicializa a conexão com o WhatsApp usando Baileys
 * @param {Object} config - Configurações da aplicação
 * @returns {Promise<Object>} Socket WhatsApp conectado
 */
async function startWhatsAppBot(config) {
  // Garantir que diretórios necessários existem
  ensureDirectories();

  // Caminho para salvar sessões de autenticação
  const authPath = path.join(__dirname, '../data/sessions');
  const { state, saveCreds } = await useMultiFileAuthState(authPath);

  /**
   * Criar socket WhatsApp com configurações otimizadas
   * - printQRInTerminal: Mostra QR code para conexão inicial
   * - auth: Estado de autenticação persistido
   * - logger: Desabilitado para economizar recursos
   */
  const sock = makeWASocket({
    printQRInTerminal: true,
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: ['Gina Bot', 'Chrome', '1.0.0'],
    defaultQueryTimeoutMs: undefined,
  });

  // Salvar credenciais quando atualizadas (manter sessão)
  sock.ev.on('creds.update', saveCreds);

  /**
   * Handler de atualizações de conexão
   * Gerencia reconexões automáticas e estados de erro
   */
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // QR Code gerado - exibir para usuário
    if (qr) {
      console.log('\n📱 Escaneie o QR Code acima com seu WhatsApp\n');
    }

    // Conexão fechada - tentar reconectar
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      
      console.log('🔄 Conexão fechada. Reconectando:', shouldReconnect);
      
      if (shouldReconnect) {
        // Aguardar 5 segundos antes de reconectar
        setTimeout(() => startWhatsAppBot(config), 5000);
      } else {
        console.log('❌ Desconectado do WhatsApp. Reinicie o bot e escaneie o QR novamente.');
      }
    }

    // Conexão estabelecida com sucesso
    if (connection === 'open') {
      console.log('✅ Bot conectado ao WhatsApp com sucesso!');
      console.log('💗 Gina está pronta para ajudar!\n');
    }
  });

  /**
   * Handler de mensagens recebidas
   * Processa apenas mensagens de texto de usuários (não de grupos)
   */
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return; // Ignorar notificações do sistema

    for (const message of messages) {
      try {
        // Ignorar mensagens do próprio bot
        if (message.key.fromMe) continue;

        // Ignorar mensagens de grupos (apenas conversas individuais)
        if (message.key.remoteJid.endsWith('@g.us')) continue;

        // Extrair dados da mensagem
        const from = message.key.remoteJid;
        const messageText = message.message?.conversation || 
                           message.message?.extendedTextMessage?.text || '';

        // Ignorar mensagens vazias
        if (!messageText.trim()) continue;

        console.log(`📩 Mensagem de ${from.split('@')[0]}: ${messageText.substring(0, 50)}...`);

        // Processar mensagem com IA e lógica do bot
        const response = await processMessage(from, messageText, config);

        // Enviar resposta ao usuário
        if (response) {
          await sock.sendMessage(from, { text: response });
          console.log(`📤 Resposta enviada para ${from.split('@')[0]}`);
        }

      } catch (error) {
        console.error('❌ Erro ao processar mensagem:', error.message);
        
        // Tentar enviar mensagem de erro ao usuário
        try {
          await sock.sendMessage(message.key.remoteJid, { 
            text: '😔 Desculpe, ocorreu um erro. Tente novamente em alguns segundos.' 
          });
        } catch (sendError) {
          console.error('❌ Não foi possível enviar mensagem de erro');
        }
      }
    }
  });

  return sock;
}

/**
 * Função principal de inicialização
 * Coordena o start de todos os módulos
 */
async function main() {
  console.log('═══════════════════════════════════════');
  console.log('💗  BOT GINECOLÓGICO - GINA');
  console.log('    WhatsApp + Gemini AI');
  console.log('═══════════════════════════════════════\n');

  try {
    // 1. Carregar configurações
    console.log('📝 Carregando configurações...');
    const config = loadConfig();
    console.log('✅ Configurações carregadas\n');

    // 2. Inicializar banco de dados local
    console.log('💾 Inicializando banco de dados...');
    initializeDatabase();
    console.log('✅ Banco de dados pronto\n');

    // 3. Inicializar conexão com Gemini AI
    console.log('🤖 Conectando ao Gemini AI...');
    await initializeGemini(config.gemini.apiKey, config.gemini.model);
    console.log('✅ Gemini AI conectado\n');

    // 4. Iniciar bot WhatsApp
    console.log('📱 Iniciando bot WhatsApp...');
    await startWhatsAppBot(config);

  } catch (error) {
    console.error('❌ Erro fatal ao iniciar bot:', error.message);
    console.error(error);
    process.exit(1);
  }
}

/**
 * Tratamento de erros não capturados
 * Evita crash do bot por erros inesperados
 */
process.on('uncaughtException', (error) => {
  console.error('❌ Erro não capturado:', error.message);
  logger.error(error, 'Uncaught exception');
  // Não encerrar o processo - tentar continuar rodando
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rejeitada não tratada:', reason);
  logger.error({ reason, promise }, 'Unhandled rejection');
});

/**
 * Tratamento de sinais de encerramento (CTRL+C, kill, etc)
 * Garante limpeza adequada antes de desligar
 */
process.on('SIGINT', () => {
  console.log('\n\n👋 Encerrando bot graciosamente...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 Bot encerrado pelo sistema');
  process.exit(0);
});

// Iniciar aplicação
main();