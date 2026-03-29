import dotenv from 'dotenv';
dotenv.config();
import AIEngine from './src/services/AIEngine.js';

async function test() {
  const ai = new AIEngine();
  const phrases = [
    // 1. Goal Creation
    "i want to become genAI developer in 1 week",
    "mujhe ek nayi car leni hai",
    // 2. Querying Goals
    "give me list of my subtask to get a new bike",
    // 3. Updating via line numbers
    "update 2 to 5 PM",
    // 4. Deleting Goals
    "muje mera developer goal delete karna hai",
    // 5. Normal reminders & routines
    "remind me to call jayesh today at 6pm",
    "muje daily routine set karna he gyma jane ke liye 8 baje"
  ];

  // Mocking the context to test the new line-number parsing rule
  const mockContext = {
    lastAssistantMessage: "1. 🔄 Code Practice @ 8:00 AM\n2. 🔄 Learn New Concept @ 2:00 PM",
  };

  console.log("===================================");
  console.log("🤖 LifeOS System Feature Tests 🤖");
  console.log("===================================\n");

  for (const phrase of phrases) {
    console.log(`🗣️  User: "${phrase}"`);
    try {
      const res = await ai.detectIntent(phrase, mockContext);
      console.log(`🎯  Intent: ${res.intent}`);
      console.log(`📝  Activity: ${res.activity}`);
      if (res.time && res.time !== 'none') console.log(`⏰  Time/Date: ${res.time}`);
      console.log("-----------------------------------");
    } catch(e) {
      console.error("Error testing phrase:", e.message);
    }
  }
}
test();
