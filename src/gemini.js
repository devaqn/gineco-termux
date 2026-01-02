const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;
let model = null;

const SYSTEM_PROMPT = `Você é uma assistente virtual especializada em saúde ginecológica educativa.

REGRAS OBRIGATÓRIAS:
- Você NÃO faz diagnóstico médico
- Você NÃO prescreve medicamentos
- Você SEMPRE usa linguagem acolhedora
- Use emojis com moderação (💗 🩺 📅)
- Respostas concisas (máximo 3-4 linhas)

Responda sempre em português brasileiro de forma empática e educativa.`;

async function initializeGemini(apiKey, modelName = 'gemini-1.5-flash-002') {
  try {
    if (!apiKey || apiKey === 'SUA_API_KEY_AQUI') {
      throw new Error('API Key do Gemini não configurada!');
    }

    console.log('   Conectando com Google Gemini...');

    genAI = new GoogleGenerativeAI(apiKey);
    
    // Listar modelos disponíveis
    console.log('   Verificando modelos disponíveis...');
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
    const data = await response.json();
    
    if (!data.models || data.models.length === 0) {
      throw new Error('Nenhum modelo disponível para esta API Key');
    }
    
    // Usar o primeiro modelo disponível
    const availableModel = data.models[0].name.replace('models/', '');
    console.log(`   Modelo disponível: ${availableModel}`);
    
    model = genAI.getGenerativeModel({ 
      model: availableModel,
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1024,
      }
    });

    console.log('   Testando conexão...');
    const testResult = await model.generateContent('Olá');
    const testText = testResult.response.text();
    
    if (!testText) {
      throw new Error('API retornou resposta vazia');
    }

    console.log('   ✅ Gemini conectado com sucesso!');
    return true;

  } catch (error) {
    console.error('❌ Erro ao inicializar Gemini:');
    console.error('   Mensagem:', error.message);
    throw error;
  }
}

async function sendToGemini(userMessage, context = {}) {
  try {
    if (!model) {
      throw new Error('Gemini não inicializado');
    }

    const fullPrompt = buildFullPrompt(userMessage, context);
    const result = await model.generateContent(fullPrompt);
    const text = result.response.text();

    if (!text || text.trim().length === 0) {
      return 'Desculpe, não consegui processar sua mensagem.';
    }

    return text.trim();

  } catch (error) {
    console.error('❌ Erro ao chamar Gemini:', error.message);
    return 'Desculpe, tive um problema técnico. Tente novamente.';
  }
}

function buildFullPrompt(userMessage, context) {
  let prompt = SYSTEM_PROMPT + '\n\n';

  if (context.recentHistory && context.recentHistory.length > 0) {
    prompt += '📋 Registros recentes:\n';
    context.recentHistory.forEach((record, index) => {
      prompt += `${index + 1}. [${record.date}] ${record.content}\n`;
    });
    prompt += '\n';
  }

  prompt += `💬 MENSAGEM: "${userMessage}"\n\n`;
  prompt += `Responda empaticamente (3-4 linhas).`;

  return prompt;
}

async function classifyMessage(message) {
  try {
    const classificationPrompt = `${SYSTEM_PROMPT}

Classifique: "${message}"

Categorias: menstruacao, anticoncepcional, sintomas, sexual, observacao

Responda APENAS em JSON (sem markdown):
{"category":"categoria","content":"resumo","date":"today"}`;

    const result = await model.generateContent(classificationPrompt);
    const responseText = result.response.text();

    const cleanText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      category: 'observacao',
      content: message,
      date: 'today'
    };

  } catch (error) {
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
      return '📊 Ainda não há registros suficientes.';
    }

    let dataSummary = '📊 DADOS:\n\n';
    records.slice(0, 20).forEach(record => {
      dataSummary += `[${record.date}] ${record.content}\n`;
    });

    const insightsPrompt = `${SYSTEM_PROMPT}

${dataSummary}

Gere insights educativos (NÃO diagnósticos). Máximo 5-6 linhas.`;

    const result = await model.generateContent(insightsPrompt);
    return result.response.text().trim();

  } catch (error) {
    return '😔 Não foi possível gerar insights.';
  }
}

module.exports = {
  initializeGemini,
  sendToGemini,
  classifyMessage,
  generateInsights
};