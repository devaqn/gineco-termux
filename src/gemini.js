/**
 * ═══════════════════════════════════════════════════════════
 * MÓDULO: INTEGRAÇÃO GEMINI AI
 * Arquivo: gemini.js
 * Descrição: Gerencia comunicação com Google Gemini API
 * ═══════════════════════════════════════════════════════════
 * 
 * Responsabilidades:
 * - Inicializar cliente Gemini com API key
 * - Enviar prompts com contexto de saúde ginecológica
 * - Processar respostas da IA
 * - Aplicar prompt de sistema especializado
 * - Gerenciar erros e limites de API
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Variáveis globais do módulo
let genAI = null;
let model = null;

/**
 * PROMPT DE SISTEMA OBRIGATÓRIO
 * Define o comportamento, personalidade e limites da IA
 * Este prompt é enviado em TODAS as interações
 */
const SYSTEM_PROMPT = `Você é uma assistente virtual especializada em saúde ginecológica educativa.
Seu papel é agir como uma ginecologista profissional, empática e ética, focada em orientação, organização de informações e educação em saúde.

REGRAS OBRIGATÓRIAS:
• Você NÃO faz diagnóstico médico
• Você NÃO prescreve medicamentos
• Você NÃO substitui um profissional de saúde
• Você NÃO faz afirmações alarmistas
• Você SEMPRE usa linguagem acolhedora e respeitosa
• Você SEMPRE deixa claro quando algo exige avaliação médica

SUAS FUNÇÕES:
• Interpretar mensagens em linguagem natural
• Classificar informações em categorias:
  - ciclo menstrual
  - anticoncepcional
  - sintomas
  - atividade sexual
  - observações gerais
• Gerar respostas empáticas e educativas
• Produzir insights simples baseados em histórico
• Sugerir acompanhamento médico quando necessário
• Jamais armazenar dados — apenas responder

FORMATO DE RESPOSTA ESPERADO:
• Texto curto, claro e humano
• Sem termos técnicos excessivos
• Nunca julgador
• Nunca invasivo

LIMITAÇÕES:
• Se a pergunta envolver risco grave ou emergência, oriente procurar atendimento médico
• Se houver incerteza, responda de forma conservadora
• Não crie dados que não foram fornecidos pelo usuário

Responda sempre em português brasileiro de forma natural, empática e acolhedora.`;

/**
 * Inicializa o cliente Gemini AI
 * @param {string} apiKey - Chave de API do Google Gemini
 * @param {string} modelName - Nome do modelo (ex: gemini-1.5-flash)
 * @returns {Promise<boolean>} true se inicialização bem-sucedida
 */
async function initializeGemini(apiKey, modelName = 'gemini-1.5-flash') {
  try {
    if (!apiKey || apiKey === 'SUA_API_KEY_AQUI') {
      throw new Error('API Key do Gemini não configurada! Edite config/config.json');
    }

    // Criar instância do cliente
    genAI = new GoogleGenerativeAI(apiKey);
    
    // Obter modelo especificado
    model = genAI.getGenerativeModel({ 
      model: modelName,
      generationConfig: {
        temperature: 0.7, // Criatividade moderada
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1024, // Respostas concisas
      }
    });

    // Testar conexão com uma chamada simples
    const testResult = await model.generateContent('Olá');
    
    if (!testResult || !testResult.response) {
      throw new Error('Falha ao conectar com Gemini API');
    }

    console.log(`   Modelo: ${modelName}`);
    return true;

  } catch (error) {
    console.error('❌ Erro ao inicializar Gemini:', error.message);
    throw error;
  }
}

/**
 * Envia mensagem para Gemini e recebe resposta
 * @param {string} userMessage - Mensagem do usuário
 * @param {Object} context - Contexto adicional (histórico, dados do usuário)
 * @returns {Promise<string>} Resposta gerada pela IA
 */
async function sendToGemini(userMessage, context = {}) {
  try {
    if (!model) {
      throw new Error('Gemini não inicializado. Chame initializeGemini() primeiro.');
    }

    // Construir prompt completo com sistema + contexto + mensagem
    const fullPrompt = buildFullPrompt(userMessage, context);

    // Enviar para Gemini
    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const text = response.text();

    // Validar resposta
    if (!text || text.trim().length === 0) {
      return 'Desculpe, não consegui processar sua mensagem. Pode reformular?';
    }

    return text.trim();

  } catch (error) {
    console.error('❌ Erro ao chamar Gemini:', error.message);

    // Tratamento específico de erros comuns
    if (error.message.includes('quota')) {
      return '😔 Limite de uso da IA foi atingido temporariamente. Tente novamente em alguns minutos.';
    }
    
    if (error.message.includes('API key')) {
      return '❌ Erro de configuração da IA. Contate o administrador do bot.';
    }

    return 'Desculpe, tive um problema técnico. Tente novamente.';
  }
}

/**
 * Constrói o prompt completo para enviar ao Gemini
 * Combina: prompt de sistema + contexto do usuário + mensagem atual
 * @param {string} userMessage - Mensagem atual do usuário
 * @param {Object} context - Dados contextuais
 * @returns {string} Prompt formatado
 */
function buildFullPrompt(userMessage, context) {
  let prompt = SYSTEM_PROMPT + '\n\n';

  // Adicionar histórico recente se disponível (últimos 5 registros)
  if (context.recentHistory && context.recentHistory.length > 0) {
    prompt += '📋 CONTEXTO - Registros recentes da usuária:\n';
    context.recentHistory.forEach((record, index) => {
      prompt += `${index + 1}. [${record.date}] ${record.category}: ${record.content}\n`;
    });
    prompt += '\n';
  }

  // Adicionar tipo de solicitação (registro ou consulta)
  if (context.isCommand) {
    prompt += `🔍 TIPO: Consulta de dados históricos\n`;
    prompt += `COMANDO: ${context.commandType}\n\n`;
  } else {
    prompt += `📝 TIPO: Novo registro ou pergunta da usuária\n\n`;
  }

  // Adicionar mensagem atual do usuário
  prompt += `💬 MENSAGEM DA USUÁRIA:\n"${userMessage}"\n\n`;

  // Instrução de resposta baseada no tipo
  if (context.isCommand) {
    prompt += `Por favor, analise os dados fornecidos e gere uma resposta clara e útil para o comando solicitado.`;
  } else {
    prompt += `Por favor:
1. Identifique se é um registro de informação ou uma pergunta
2. Se for registro: confirme o registro de forma empática
3. Se for pergunta: responda de forma educativa e acolhedora
4. Use emojis com moderação (💗 🩺 📅)
5. Mantenha resposta concisa (máximo 3-4 linhas)`;
  }

  return prompt;
}

/**
 * Classifica uma mensagem em categorias de saúde
 * Usa Gemini para identificar o tipo de informação
 * @param {string} message - Mensagem a ser classificada
 * @returns {Promise<Object>} { category, content, date }
 */
async function classifyMessage(message) {
  try {
    const classificationPrompt = `${SYSTEM_PROMPT}

Classifique a seguinte mensagem em UMA das categorias:
- menstruacao (início/fim do ciclo, fluxo, duração)
- anticoncepcional (horário, esquecimento, início/pausa)
- sintomas (cólicas, dores, TPM, alterações físicas/emocionais)
- sexual (atividade sexual, uso de preservativo)
- observacao (outros registros de saúde)

Extraia também:
- A data mencionada (hoje, ontem, data específica)
- O conteúdo principal da informação

Mensagem: "${message}"

Responda APENAS no formato JSON:
{
  "category": "categoria_identificada",
  "content": "resumo_da_informacao",
  "date": "YYYY-MM-DD ou 'today' ou 'yesterday'"
}`;

    const result = await model.generateContent(classificationPrompt);
    const responseText = result.response.text();

    // Tentar extrair JSON da resposta
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // Fallback: classificação genérica
    return {
      category: 'observacao',
      content: message,
      date: 'today'
    };

  } catch (error) {
    console.error('❌ Erro ao classificar mensagem:', error.message);
    
    // Retornar classificação padrão em caso de erro
    return {
      category: 'observacao',
      content: message,
      date: 'today'
    };
  }
}

/**
 * Gera insights sobre o histórico da usuária
 * Identifica padrões simples sem fazer diagnósticos
 * @param {Array} records - Array de registros da usuária
 * @returns {Promise<string>} Texto com insights
 */
async function generateInsights(records) {
  try {
    if (!records || records.length === 0) {
      return '📊 Ainda não há registros suficientes para gerar insights. Continue registrando suas informações diárias!';
    }

    // Construir resumo dos dados para análise
    let dataSummary = '📊 DADOS PARA ANÁLISE:\n\n';
    records.forEach(record => {
      dataSummary += `[${record.date}] ${record.category}: ${record.content}\n`;
    });

    const insightsPrompt = `${SYSTEM_PROMPT}

${dataS ummary}

Com base nos dados acima, gere insights EDUCATIVOS e NÃO DIAGNÓSTICOS:
- Identifique padrões simples (ex: "ciclo parece regular")
- Estime duração média do ciclo (se houver dados)
- Note sintomas recorrentes
- Sugira acompanhamento médico se necessário

IMPORTANTE:
- NÃO faça diagnósticos
- NÃO seja alarmista
- Seja acolhedora e informativa
- Máximo 5-6 linhas

Forneça os insights de forma natural e empática:`;

    const result = await model.generateContent(insightsPrompt);
    return result.response.text().trim();

  } catch (error) {
    console.error('❌ Erro ao gerar insights:', error.message);
    return '😔 Não foi possível gerar insights no momento. Tente novamente mais tarde.';
  }
}

// Exportar funções do módulo
module.exports = {
  initializeGemini,
  sendToGemini,
  classifyMessage,
  generateInsights,
  SYSTEM_PROMPT
};