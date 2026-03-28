import dotenv from 'dotenv';
dotenv.config();
import AIEngine from './src/services/AIEngine.js';

async function test() {
  const ai = new AIEngine();
  const phrases = [
    "hiii",
    "give me what is my subtask",
    "give me my daily routine list"
  ];

  for (const phrase of phrases) {
    console.log(`\nTesting phrase: "${phrase}"`);
    const res = await ai.detectIntent(phrase, {});
    console.log("Result:", JSON.stringify(res, null, 2));
  }
}
test();
