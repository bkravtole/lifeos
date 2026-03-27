import { Groq } from 'groq-sdk';
import logger from '../utils/logger.js';

/**
 * Groq AI Engine
 * Handles intent detection, entity extraction, and response generation
 */
export class AIEngine {
  constructor() {
    this.apiKey = process.env.GROQ_API_KEY;
    this.model = 'mixtral-8x7b-32768';

    if (!this.apiKey) {
      throw new Error('GROQ_API_KEY is not defined');
    }

    this.groq = new Groq({
      apiKey: this.apiKey
    });
  }

  /**
   * Call Groq API with chat completion
   */
  async _callGroqAPI(messages) {
    try {
      const response = await this.groq.chat.completions.create({
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 1024
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      logger.error('Groq API call failed:', error.message);
      throw error;
    }
  }

  /**
   * Detect intent from user message
   * Returns: { intent, confidence, entities, activity, time }
   */
  async detectIntent(message, context = {}) {
    try {
      const systemPrompt = `You are LifeOS AI assistant. Analyze the message and detect intent.
Return ONLY valid JSON (no markdown, no code blocks) with this structure:
{
  "intent": "CREATE_REMINDER|LOG_ACTIVITY|CHAT|QUERY_ROUTINE|DELETE_REMINDER|UPDATE_ROUTINE|CREATE_ROUTINE",
  "confidence": 0.95,
  "activity": "activity name if applicable",
  "time": "time/datetime if applicable",
  "entities": {}
}
Message language: Hindi/English (Hinglish)
User context: ${JSON.stringify(context)}`;

      const msgs = [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: message
        }
      ];

      const response = await this._callGroqAPI(msgs);
      const parsed = JSON.parse(response);

      return {
        intent: parsed.intent || 'CHAT',
        confidence: parsed.confidence || 0.7,
        entities: parsed.entities || {},
        activity: parsed.activity,
        time: parsed.time
      };
    } catch (error) {
      logger.error('Intent detection failed:', error.message);
      return {
        intent: 'CHAT',
        confidence: 0.5,
        entities: {},
        activity: null,
        time: null
      };
    }
  }

  /**
   * Extract entities from message
   */
  async extractEntities(message) {
    try {
      const systemPrompt = `Extract entities from this message. Return ONLY valid JSON:
{
  "activity": "activity name or null",
  "time": "time or null",
  "date": "date or null",
  "duration": "duration in minutes or null",
  "priority": "low|medium|high or null",
  "repeat": "daily|weekly|monthly|none"
}`;

      const msgs = [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: message
        }
      ];

      const response = await this._callGroqAPI(msgs);
      return JSON.parse(response);
    } catch (error) {
      logger.error('Entity extraction failed:', error.message);
      return {};
    }
  }

  /**
   * Generate response based on context
   */
  async generateResponse(intent, entities, userContext = {}) {
    try {
      const systemPrompt = `You are LifeOS AI assistant - a friendly Hindi/Hinglish speaking bot.
Generate a helpful, concise response. Use emojis occasionally but not excessively.
Be encouraging and supportive.
Response should be 1-3 sentences max.
Language: Hindi/Hinglish mix`;

      const userPrompt = `Intent: ${intent}
Activity: ${entities?.activity || 'N/A'}
User Context: ${JSON.stringify(userContext)}

Generate a response message.`;

      const msgs = [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ];

      const response = await this._callGroqAPI(msgs);
      return response.trim();
    } catch (error) {
      logger.error('Response generation failed:', error.message);
      return 'समझ नहीं आया 😅 फिर से बताओ';
    }
  }

  /**
   * Parse user input (utility)
   */
  async parseUserInput(message) {
    try {
      const systemPrompt = `Parse this Hindi/Hinglish message and extract information.
Return JSON with parsed details.`;

      const msgs = [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: message
        }
      ];

      const response = await this._callGroqAPI(msgs);
      return JSON.parse(response);
    } catch (error) {
      logger.error('Parse user input failed:', error.message);
      return { raw: message };
    }
  }
}

export default AIEngine;
