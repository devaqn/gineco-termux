/**
 * gemini.js - Integração Google Gemini AI
 * VERSÃO CORRIGIDA - SEM ERROS
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;
let model = null;

const SYSTEM_PROMPT = `Você é uma assistente virtual especializada em saúde ginecológica educativa.
Seu papel é agir como uma ginecologista profissional, empática e ética.

REGRAS OBRIGATÓRIAS:
• Você NÃO faz diagnóstico médico
• Você NÃO prescreve medicamentos
• Você NÃO substitui um profissional de saúde
• Você SEMPRE usa linguagem acolhedora e respeitosa
• Você SEMPRE deixa claro quando algo exige avaliação médica

SUAS FUNÇÕES:
• Interpretar mensagens em linguagem natural
• Classificar informações em categorias
• Gerar respostas empáticas e educativas
• Produzir insights simples baseados em histórico
• Sugerir acompanhamento médico quando necessário

FORMATO DE RESPOSTA:
• Texto curto, claro e humano
• Sem termos técnicos excessivos
• Use emojis com moderação (💗 🩺 📅)
• Respostas concisas (máximo 3-4 linhas)

Responda sempre em português brasileiro de forma natural, empática e acolhedora.`;

async function initializeGemini(apiKey, modelName = 'gemini-1.5-flash') {
  try {
    if (!apiKey || apiKey === 'SUA_API_KEY_AQUI') {
      throw new Error('API Key do Gemini não configurada! Edite config/config.json');
    }

    genAI = new GoogleGenerativeAI(apiKey);
    
    model = genAI.getGenerativeModel({ 
      model: modelName,
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1024,
      }
    });

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

async function sendToGemini(userMessage, context = {}) {
  try {
    if (!model) {
      throw new Error('Gemini não inicializado. Chame initializeGemini() primeiro.');
    }

    const fullPrompt = buildFullPrompt(userMessage, context);

    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const text = response.text();

    if (!text || text.trim().length === 0) {
      return 'Desculpe, não consegui processar sua mensagem. Pode reformular?';
    }

    return text.trim();

  } catch (error) {
    console.error('❌ Erro ao chamar Gemini:', error.message);

    if (error.message.includes('quota')) {
      return '😔 Limite de uso da IA foi atingido temporariamente. Tente novamente em alguns minutos.';
    }
    
    if (error.message.includes('API key')) {
      return '❌ Erro de configuração da IA. Contate o administrador do bot.';
    }

    return 'Desculpe, tive um problema técnico. Tente novamente.';
  }
}

function buildFullPrompt(userMessage, context) {
  let prompt = SYSTEM_PROMPT + '\n\n';

  if (context.recentHistory && context.recentHistory.length > 0) {
    prompt += '📋 CONTEXTO - Registros recentes da usuária:\n';
    context.recentHistory.forEach((record, index) => {
      prompt += `${index + 1}. [${record.date}] ${record.category}: ${record.content}\n`;
    });
    prompt += '\n';
  }

  if (context.isCommand) {
    prompt += `🔍 TIPO: Consulta de dados históricos\n`;
    prompt += `COMANDO: ${context.commandType}\n\n`;
  } else {
    prompt += `📝 TIPO: Novo registro ou pergunta da usuária\n\n`;
  }

  prompt += `💬 MENSAGEM DA USUÁRIA:\n"${userMessage}"\n\n`;

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

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      category: 'observacao',
      content: message,
      date: 'today'
    };

  } catch (error) {
    console.error('❌ Erro ao classificar mensagem:', error.message);
    
    return {
      category: 'observacao',
      content: message,
      date: 'today'
    };
  }
}

async function generateInsights(records) {
  try {
    if (!records || records.length === 0) {
      return '📊 Ainda não há registros suficientes para gerar insights. Continue registrando suas informações diárias!';
    }

    let dataSummary = '📊 DADOS PARA ANÁLISE:\n\n';
    records.forEach(record => {
      dataSummary += `[${record.date}] ${record.category}: ${record.content}\n`;
    });

    const insightsPrompt = `${SYSTEM_PROMPT}

${dataSummary}

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

module.exports = {
  initializeGemini,
  sendToGemini,
  classifyMessage,
  generateInsights,
  SYSTEM_PROMPT
};