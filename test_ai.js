import dotenv from 'dotenv';
dotenv.config();
import AIEngine from './src/services/AIEngine.js';

async function test() {
  const ai = new AIEngine();
  console.log("Detecting Intent:");
  const res = await ai.detectIntent("give me my daily routine list", {});
  console.log("AIEngine response for 'give me my daily routine list':", res.intent);
  
  console.log("\\nTesting Goal Breakdown:");
  const breakdown = await ai.generateGoalBreakdown("become a genAI developer in 1 month");
  console.log(JSON.stringify(breakdown, null, 2));
}
test();
