const { GoogleGenerativeAI } = require('@google/generative-ai');

async function solveAll() {
    const API_KEY = "AIzaSyCFFQpzovYmEDIplhLmhioJ1J0NWHXNTCY";
    const genAI = new GoogleGenerativeAI(API_KEY);

    console.log("--- PASSO 1: LISTANDO MODELOS DISPONÍVEIS ---");
    try {
        // Usando o fetch nativo do Node 24 para perguntar ao Google o que sua chave pode ver
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${API_KEY}`);
        const data = await response.json();
        
        if (data.models) {
            console.log("Modelos encontrados na sua conta:");
            data.models.forEach(m => console.log(` - ${m.name.replace('models/', '')}`));
            
            // Pega o primeiro modelo que encontrar para testar
            const firstModel = data.models[0].name.replace('models/', '');
            
            console.log(`\n--- PASSO 2: TESTANDO O MODELO [${firstModel}] ---`);
            const model = genAI.getGenerativeModel({ model: firstModel });
            const result = await model.generateContent("Oi");
            console.log("✅ SUCESSO! Resposta:", result.response.text());
        } else {
            console.error("❌ O Google não retornou modelos. Verifique se sua API Key está ativa.");
            console.log("Resposta do Google:", JSON.stringify(data));
        }
    } catch (error) {
        console.error("❌ Erro técnico:", error.message);
    }
}

solveAll();