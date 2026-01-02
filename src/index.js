const fs = require('fs');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal'); // Adicionado para exibir o QR
const { initializeGemini } = require('./gemini');
const { initializeDatabase } = require('./database');
const { processMessage } = require('./processor');
const { validateConfig, ensureDirectories } = require('./utils');

// Criar pasta de logs
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFile = path.join(logsDir, 'app.log');
if (!fs.existsSync(logFile)) {
  fs.writeFileSync(logFile, '', 'utf8');
}

const logger = pino({ 
  level: 'info',
  transport: {
    target: 'pino/file',
    options: { destination: logFile }
  }
});

function loadConfig() {
  try {
    const configPath = path.join(__dirname, '../config/config.json');
    
    if (!fs.existsSync(configPath)) {
      console.error('❌ Arquivo config/config.json não encontrado!');
      process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    if (!validateConfig(config)) {
      console.error('❌ Configuração inválida!');
      process.exit(1);
    }

    return config;
  } catch (error) {
    console.error('❌ Erro ao carregar configurações:', error.message);
    process.exit(1);
  }
}

async function startWhatsAppBot(config) {
  ensureDirectories();

  const authPath = path.join(__dirname, '../data/sessions');
  const { state, saveCreds } = await useMultiFileAuthState(authPath);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    printQRInTerminal: false, // Desativado o nativo para usar o qrcode-terminal manual
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: ['Gina Bot', 'Chrome', '1.0.0'],
    defaultQueryTimeoutMs: undefined,
    connectTimeoutMs: 60000, // Aumentado para evitar timeout no Windows
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // GERADOR DE QR CODE MANUAL (Resolve o erro de Deprecated)
    if (qr) {
      console.log('\n✨ GINA: NOVO QR CODE GERADO ✨');
      console.log('📱 Escaneie o código abaixo com o WhatsApp do seu celular:\n');
      qrcode.generate(qr, { small: true });
      console.log('\n💡 Aguardando leitura...');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      
      console.log(`📡 Conexão encerrada (Status: ${statusCode})`);

      if (shouldReconnect) {
        console.log('🔄 Tentando reconectar em 5 segundos...');
        setTimeout(() => startWhatsAppBot(config), 5000);
      } else {
        console.log('❌ Você foi desconectado. Apague a pasta data/sessions e tente novamente.');
        process.exit(0);
      }
    }

    if (connection === 'open') {
      console.log('\n✅ Bot conectado ao WhatsApp!');
      console.log('💗 Gina está pronta para ajudar!\n');
      logger.info('Bot conectado');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const message of messages) {
      try {
        if (message.key.fromMe) continue;
        if (message.key.remoteJid.endsWith('@g.us')) continue;

        const from = message.key.remoteJid;
        const messageText = message.message?.conversation || 
                           message.message?.extendedTextMessage?.text || '';

        if (!messageText.trim()) continue;

        const userPhone = from.split('@')[0];
        console.log(`📩 ${userPhone}: ${messageText.substring(0, 40)}...`);

        const response = await processMessage(from, messageText, config);

        if (response) {
          await sock.sendMessage(from, { text: response });
          console.log(`📤 Resposta enviada para ${userPhone}`);
          
          logger.info({
            from: userPhone,
            message: messageText.substring(0, 100)
          }, 'Mensagem processada');
        }

      } catch (error) {
        console.error('❌ Erro no Processador:', error.message);
        logger.error(error, 'Erro no processamento');
      }
    }
  });

  return sock;
}

async function main() {
  console.clear();
  console.log('═══════════════════════════════════════');
  console.log('💗   BOT GINECOLÓGICO - GINA');
  console.log('     WhatsApp + Gemini AI');
  console.log('═══════════════════════════════════════\n');

  try {
    console.log('📝 Carregando configurações...');
    const config = loadConfig();
    console.log('✅ Configurações carregadas\n');

    console.log('💾 Inicializando banco de dados...');
    initializeDatabase();
    console.log('✅ Banco de dados pronto\n');

    console.log('🤖 Conectando ao Gemini AI...');
    
    // Usando o modelo que testamos e funcionou (Gemini 2.0 Flash)
    const modelName = config.gemini.model || 'gemini-2.0-flash';
    await initializeGemini(config.gemini.apiKey, modelName);
    console.log(`✅ Gemini [${modelName}] conectado\n`);

    console.log('📱 Iniciando bot WhatsApp...');
    await startWhatsAppBot(config);

  } catch (error) {
    console.error('\n❌ Erro fatal:', error.message);
    process.exit(1);
  }
}

// Tratamento de erros globais para evitar que o bot feche do nada
process.on('uncaughtException', (error) => {
  if (error.message.includes('EPIPE')) return; // Ignora erro de pipe quebrado comum no Windows
  console.error('\n❌ Erro crítico:', error.message);
});

process.on('SIGINT', () => {
  console.log('\n\n👋 Encerrando GINA...');
  process.exit(0);
});

main();