# 💗 Bot Ginecológico - WhatsApp + Gemini AI

Sistema completo de assistente virtual para saúde ginecológica educativa, rodando 24/7 no Termux (Android) com Node.js, WhatsApp (Baileys) e Google Gemini AI.

---

## 📋 Índice

1. [Visão Geral](#-visão-geral)
2. [Estrutura do Projeto](#-estrutura-do-projeto)
3. [Instalação no Termux](#-instalação-no-termux)
4. [Configuração](#-configuração)
5. [Uso do Bot](#-uso-do-bot)
6. [Comandos Disponíveis](#-comandos-disponíveis)
7. [Segurança e Privacidade](#-segurança-e-privacidade)
8. [Manutenção 24/7](#-manutenção-247)
9. [Desenvolvimento](#-desenvolvimento)

---

## 🎯 Visão Geral

Este bot WhatsApp funciona como uma **ginecologista virtual educativa** que:

- ✅ Conversa naturalmente em português
- ✅ Registra informações de saúde automaticamente
- ✅ Organiza dados por data e categoria
- ✅ Gera insights simples e seguros
- ✅ Mantém privacidade absoluta (dados locais)
- ✅ Funciona 24/7 no seu celular Android

**⚠️ IMPORTANTE:** Este bot **NÃO** faz diagnósticos, **NÃO** prescreve medicamentos e **NÃO** substitui profissionais de saúde.

---

## 📁 Estrutura do Projeto

```
gyneco-bot/
├── src/
│   ├── index.js              # Ponto de entrada principal
│   ├── whatsapp.js           # Gerenciador WhatsApp (Baileys)
│   ├── gemini.js             # Integração com Google Gemini API
│   ├── database.js           # Sistema de armazenamento local
│   ├── processor.js          # Processamento de mensagens e lógica
│   ├── security.js           # Sistema de segurança e criptografia
│   └── utils.js              # Funções auxiliares
├── data/
│   ├── users/                # Dados isolados por usuário
│   └── sessions/             # Sessões WhatsApp
├── config/
│   └── config.json           # Configurações (API key, etc)
├── logs/
│   └── app.log               # Logs do sistema (sem dados sensíveis)
├── package.json
└── README.md
```

---

## 🚀 Instalação no Termux

### Passo 1: Preparar o Termux

```bash
# Atualizar pacotes
pkg update && pkg upgrade -y

# Instalar Node.js e Git
pkg install nodejs git -y

# Verificar instalação
node --version
npm --version
```

### Passo 2: Clonar/Criar o Projeto

```bash
# Criar diretório do projeto
cd ~
mkdir gyneco-bot
cd gyneco-bot

# Inicializar projeto Node.js
npm init -y
```

### Passo 3: Instalar Dependências

```bash
npm install @whiskeysockets/baileys@latest
npm install @google/generative-ai
npm install qrcode-terminal
npm install pino
npm install node-cache
npm install bcryptjs
npm install crypto-js
```

### Passo 4: Criar Estrutura de Pastas

```bash
mkdir -p src config data/users data/sessions logs
```

---

## ⚙️ Configuração

### 1. Obter API Key do Google Gemini

1. Acesse: https://makersuite.google.com/app/apikey
2. Crie uma nova API key (gratuita)
3. Copie a chave

### 2. Configurar o Bot

Crie o arquivo `config/config.json`:

```json
{
  "gemini": {
    "apiKey": "SUA_API_KEY_AQUI",
    "model": "gemini-1.5-flash"
  },
  "security": {
    "enableEncryption": true,
    "enablePIN": false,
    "sessionTimeout": 1800000
  },
  "bot": {
    "botName": "Gina",
    "language": "pt-BR"
  }
}
```

### 3. Copiar os Arquivos de Código

Copie todos os arquivos `.js` fornecidos para a pasta `src/`.

---

## 🎮 Uso do Bot

### Iniciar o Bot

```bash
cd ~/gyneco-bot
node src/index.js
```

### Primeira Conexão

1. Um QR Code aparecerá no terminal
2. Abra o WhatsApp no seu celular
3. Vá em **Aparelhos Conectados** → **Conectar Aparelho**
4. Escaneie o QR Code
5. Pronto! O bot está conectado

### Conversar com o Bot

Envie uma mensagem para o número conectado:

```
"Minha menstruação começou hoje"
"Tomei anticoncepcional às 8h"
"Tô com cólica forte e dor de cabeça"
```

O bot irá:
- Entender a mensagem naturalmente
- Registrar automaticamente
- Responder de forma empática

---

## 📱 Comandos Disponíveis

| Comando | Descrição | Exemplo |
|---------|-----------|---------|
| `/hoje` | Ver registros de hoje | `/hoje` |
| `/ontem` | Ver registros de ontem | `/ontem` |
| `/relatorio DD/MM/AA` | Ver dia específico | `/relatorio 02/08/25` |
| `/resumo` | Resumo dos últimos 30 dias | `/resumo` |
| `/insights` | Análise de padrões | `/insights` |
| `/ajuda` | Lista de comandos | `/ajuda` |
| `/exportar` | Exportar todos os dados | `/exportar` |
| `/limpar` | Apagar todos os dados | `/limpar` |

---

## 🔐 Segurança e Privacidade

### Princípios

✅ **Dados 100% locais** - Nada é enviado para servidores externos  
✅ **Isolamento por usuário** - Cada número tem seus próprios dados  
✅ **Criptografia opcional** - AES-256 para dados sensíveis  
✅ **PIN opcional** - Proteja o acesso com senha  
✅ **Sem logs sensíveis** - Apenas logs técnicos do sistema  

### Ativar PIN de Segurança

No arquivo `config/config.json`:

```json
"security": {
  "enablePIN": true,
  "pinHash": ""
}
```

Ao iniciar, o bot pedirá para criar um PIN de 4-6 dígitos.

### Criptografia de Dados

Habilitada por padrão. Para desabilitar:

```json
"security": {
  "enableEncryption": false
}
```

---

## 🔄 Manutenção 24/7

### Manter Bot Rodando Após Fechar Termux

#### Opção 1: Termux:Boot (Recomendado)

```bash
# Instalar Termux:Boot da Play Store
# Criar script de inicialização
mkdir -p ~/.termux/boot
nano ~/.termux/boot/start-bot.sh
```

Adicione:
```bash
#!/data/data/com.termux/files/usr/bin/bash
cd ~/gyneco-bot
node src/index.js > logs/bot.log 2>&1 &
```

Torne executável:
```bash
chmod +x ~/.termux/boot/start-bot.sh
```

#### Opção 2: PM2 (Gerenciador de Processos)

```bash
npm install -g pm2

# Iniciar com PM2
pm2 start src/index.js --name gyneco-bot

# Salvar configuração
pm2 save

# Ver status
pm2 status

# Ver logs
pm2 logs gyneco-bot

# Parar
pm2 stop gyneco-bot

# Reiniciar
pm2 restart gyneco-bot
```

### Monitoramento

Ver logs em tempo real:
```bash
tail -f logs/app.log
```

Verificar uso de recursos:
```bash
pm2 monit
```

---

## 👨‍💻 Desenvolvimento

### Adicionar Novo Comando

Edite `src/processor.js`:

```javascript
// Na função processCommand()
case '/meucomando':
  return await handleMeuComando(userId, args);
```

Crie a função:

```javascript
async function handleMeuComando(userId, args) {
  // Sua lógica aqui
  return "Resposta do comando";
}
```

### Adicionar Nova Categoria de Dados

Edite `src/gemini.js` no prompt do sistema:

```javascript
const systemPrompt = `
...
• Classificar informações em categorias:
  - ciclo menstrual
  - anticoncepcional
  - sintomas
  - atividade sexual
  - nova_categoria  // <-- Adicionar aqui
  - observações gerais
...
`;
```

### Modificar Comportamento da IA

Edite o `systemPrompt` em `src/gemini.js` conforme necessário.

---

## 🐛 Troubleshooting

### Bot não conecta ao WhatsApp

```bash
# Limpar sessão antiga
rm -rf data/sessions/*
# Reiniciar
node src/index.js
```

### Erro de API Gemini

- Verifique se a API key está correta
- Confirme que a API está ativa em https://makersuite.google.com
- Verifique limites de uso gratuito

### Bot para sozinho

- Use PM2 para manter rodando
- Verifique logs: `pm2 logs gyneco-bot`
- Desabilite economia de bateria para o Termux

### Dados não são salvos

- Verifique permissões: `ls -la data/users/`
- Confirme que `enableEncryption` não está causando erros
- Veja logs: `tail -f logs/app.log`

---

## 📞 Suporte

Para dúvidas sobre:
- **Google Gemini API**: https://ai.google.dev/docs
- **Baileys (WhatsApp)**: https://github.com/WhiskeySockets/Baileys
- **Termux**: https://termux.dev/en/

---

## 📄 Licença

Este projeto é de uso pessoal e educativo. Desenvolvido com foco em privacidade, segurança e utilidade real.

**⚠️ Aviso Legal:** Este bot é uma ferramenta educativa e organizacional. NÃO substitui consultas médicas profissionais. Sempre procure um ginecologista qualificado para avaliação e tratamento adequados.

---

## 🎯 Próximos Passos

1. Instalar o Termux
2. Seguir o guia de instalação
3. Configurar API do Gemini
4. Iniciar o bot
5. Conectar via QR Code
6. Começar a usar!

**Boa saúde! 💗**