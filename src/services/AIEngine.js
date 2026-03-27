import { Groq } from 'groq-sdk';
import logger from '../utils/logger.js';

/**
 * Groq AI Engine
 * Handles intent detection, entity extraction, and response generation
 */
export class AIEngine {
  constructor() {
    this.apiKey = process.env.GROQ_API_KEY;
    this.model = 'llama-3.3-70b-versatile';

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
   * Returns: { intent, confidence, entities, activity, time, language }
   */
  async detectIntent(message, context = {}) {
    try {
      // Detect language of current message
      const lang = this.detectLanguage(message);
      
      let systemPrompt = '';
      if (lang === 'english') {
        systemPrompt = `You are LifeOS AI assistant trained to deeply understand what users really need. Analyze their message with context and common sense - don't just look for keywords.
        
Return ONLY valid JSON (no markdown, no code blocks) with this structure:
{
  "intent": "CREATE_REMINDER|LOG_ACTIVITY|CHAT|QUERY_ROUTINE|DELETE_REMINDER|UPDATE_ROUTINE|CREATE_ROUTINE|CREATE_CLIENT|LOG_INVOICE|SCHEDULE_MEETING|LOG_LEAD|CREATE_PROJECT",
  "confidence": 0.95,
  "activity": "activity name if applicable",
  "time": "time/datetime if applicable",
  "entities": {}
}

Context about user: ${JSON.stringify(context)}`;
      } else if (lang === 'hindi') {
        systemPrompt = `आप LifeOS AI सहायक हैं जो गहरी समझ रखते हैं। संदेश का विश्लेषण करें और असली जरूरत समझें।
केवल वैध JSON लौटाएं (कोई मार्कडाउन नहीं):
{
  "intent": "CREATE_REMINDER|LOG_ACTIVITY|CHAT|QUERY_ROUTINE|DELETE_REMINDER|UPDATE_ROUTINE|CREATE_ROUTINE|CREATE_CLIENT|LOG_INVOICE|SCHEDULE_MEETING|LOG_LEAD|CREATE_PROJECT",
  "confidence": 0.95,
  "activity": "गतिविधि का नाम यदि लागू हो",
  "time": "समय/दिनांक यदि लागू हो",
  "entities": {}
}`;
      } else {
        // Hinglish
        systemPrompt = `You are LifeOS AI assistant. Samjhiye kyaa real need hai user ko. Analyze message smartly.
Return ONLY valid JSON:
{
  "intent": "CREATE_REMINDER|LOG_ACTIVITY|CHAT|QUERY_ROUTINE|DELETE_REMINDER|UPDATE_ROUTINE|CREATE_ROUTINE|CREATE_CLIENT|LOG_INVOICE|SCHEDULE_MEETING|LOG_LEAD|CREATE_PROJECT",
  "confidence": 0.95,
  "activity": "activity name agar relevant ho",
  "time": "time/datetime agar relevant ho",
  "entities": {}
}`;
      }

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
        time: parsed.time,
        language: lang
      };
    } catch (error) {
      logger.error('Intent detection failed:', error.message);
      return {
        intent: 'CHAT',
        confidence: 0.5,
        entities: {},
        activity: null,
        time: null,
        language: 'english'
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
   * Detect language with priority: English > Hinglish > Hindi
   * Priority: Whenever in doubt, prefer English
   */
  detectLanguage(text) {
    if (!text) return 'english';
    
    const englishCount = (text.match(/[a-zA-Z]/g) || []).length;
    const hindiCount = (text.match(/[\u0900-\u097F]/g) || []).length;
    const totalChars = text.length;
    
    // If pure English (no Hindi characters at all)
    if (hindiCount === 0 && englishCount > 0) {
      return 'english';
    }
    
    // If it's a mix of English and Hindi - prefer English first, then Hinglish
    if (englishCount > 0 && hindiCount > 0) {
      // If more English than Hindi, use English
      if (englishCount >= hindiCount) {
        return 'english';
      }
      // Mix is significant - use Hinglish
      return 'hinglish';
    }
    
    // If mostly or pure Hindi
    if (hindiCount > englishCount) {
      return 'hindi';
    }
    
    // Default to English (highest priority)
    return 'english';
  }

  async generateResponse(intent, entities, userContext = {}, currentUserMessage = '') {
    try {
      // ALWAYS detect language from CURRENT user message (latest message)
      const lang = this.detectLanguage(currentUserMessage);
      
      // Build rich profile context for personal, warm responses
      let profileContext = this._buildPersonalContext(userContext);

      let systemPrompt = '';
      
      if (lang === 'english') {
        systemPrompt = `You are ${userContext?.userProfile?.name ? userContext.userProfile.name + "'s" : "the"} personal AI assistant - like a helpful friend who genuinely cares about their wellbeing.

PERSONALITY TRAITS:
- Warm, genuine, and conversational (not corporate or robotic)
- Remembers their preferences and references them naturally
- Proactive yet respectful - offers suggestions when relevant
- Uses their name occasionally to feel personal
- Shows genuine interest in their goals and daily life
- Supportive and encouraging, especially during challenges

RESPONSE GUIDELINES:
- Be concise (1-3 sentences max) but warm
- Use occasional emojis naturally (not overdone)
- Reference their profile naturally - don't list it
- If business user: treat responses as if you're their trusted advisor/business partner
- If personal user: be like a supportive friend who knows them
- Always reply in English since they just wrote in English
- Make them feel understood and valued${profileContext}`;
      } else if (lang === 'hindi') {
        systemPrompt = `आप ${userContext?.userProfile?.name ? userContext.userProfile.name + 'के' : 'एक'} व्यक्तिगत AI सहायक हैं - एक सहायक दोस्त की तरह जो उनकी भलाई की परवाह करता है।

व्यक्तित्व गुण:
- गर्मजोशी भरा, प्रामाणिक और बातचीत करने वाला
- उनकी प्राथमिकताओं को याद रखता है और स्वाभाविक रूप से संदर्भ देता है
- सक्रिय फिर भी सम्मानजनक - प्रासंगिक सुझाव देता है
- कभी-कभी उनका नाम उपयोग करता है
- उनके लक्ष्यों में वास्तविक रुचि दिखाता है
- समर्थनकारी और उत्साहवर्धक

जवाब के नियम:
- संक्षिप्त (1-3 वाक्य) लेकिन गर्म रहें
- कभी-कभी इमोजी प्राकृतिक रूप से उपयोग करें
- उनकी प्रोफाइल को स्वाभाविक रूप से संदर्भित करें
- हमेशा हिंदी में जवाब दें${profileContext}`;
      } else {
        // Hinglish - conversational mix
        systemPrompt = `Aap ${userContext?.userProfile?.name ? userContext.userProfile.name + 'ke' : 'ek'} personal AI assistant ho - jaise ek helpful dost jo unhe sach mein care karta hai.

Personality:
- Warm, genuine, conversational (robotic nahi)
- Unke preferences ko yaad rakhte ho aur naturally reference karte ho
- Proactive lekin respectful - suggestions dete ho jab relevant ho
- Unka naam kabhi-kabhi use karte ho
- Genuine interest dikha sakte ho unke goals mein
- Supportive aur encouraging

Response tips:
- 1-3 sentences, warm tone
- Kuch kuch emoji naturally use karo
- Profile ko naturally reference karo
- Hinglish mix use karo jaise vo kar rahe ho${profileContext}`;
      }

      const userPrompt = `Intent: ${intent}
Activity/Topic: ${entities?.activity || 'Not specified'}
User's just said: "${currentUserMessage}"

Generate a warm, personal response that feels like it's coming from their trusted friend/assistant. Make them feel valued and understood.`;

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
      
      // Fallback response with language priority: English > Hinglish > Hindi
      const lang = this.detectLanguage(currentUserMessage);
      const userName = userContext?.userProfile?.name || '';
      
      if (lang === 'hindi') {
        return `${userName ? userName + ', ' : ''}रुको! मैं सोच रहा हूँ... 🤔`;
      } else if (lang === 'hinglish') {
        return `${userName ? userName + ', ' : ''}ek second! Main soch raha hoon... 🤔`;
      } else {
        // English (default/priority)
        return `${userName ? 'Hold on ' + userName + '!' : 'Just a moment!'} I'm thinking... 🤔`;
      }
    }
  }

  /**
   * Build personal context string for warmer responses
   */
  _buildPersonalContext(userContext) {
    if (!userContext || !userContext.userProfile) {
      return '';
    }

    const profile = userContext.userProfile;
    let context = '\n\nKEY CONTEXT ABOUT USER:';

    // Add name
    if (profile.name) {
      context += `\n- Name: ${profile.name}`;
    }

    if (profile.userType === 'business') {
      // Business user context
      if (profile.businessProfile?.businessName) {
        context += `\n- Runs: ${profile.businessProfile.businessName}`;
      }
      if (profile.businessProfile?.businessType) {
        context += `\n- Type: ${profile.businessProfile.businessType}`;
      }
      if (profile.businessProfile?.services && profile.businessProfile.services.length > 0) {
        context += `\n- Offers: ${profile.businessProfile.services.join(', ')}`;
      }
      if (profile.businessProfile?.teamMembers) {
        context += `\n- Team size: ${profile.businessProfile.teamMembers?.length || profile.businessProfile.numberOfEmployees || 'Growing'}`;
      }
      if (profile.businessProfile?.monthlyTarget) {
        context += `\n- Monthly target: ${profile.businessProfile.monthlyTarget} ${profile.businessProfile.currency || 'INR'}`;
      }
      context += `\n- Tone: Professional, advisory, growth-focused. Reference their business goals naturally.`;
    } else {
      // Personal user context
      if (profile.dailyActivities && profile.dailyActivities.length > 0) {
        context += `\n- Daily activities: ${profile.dailyActivities.join(', ')}`;
      }
      if (profile.hobbies && profile.hobbies.length > 0) {
        context += `\n- Hobbies: ${profile.hobbies.join(', ')}`;
      }
      if (profile.workSchedule?.startTime) {
        context += `\n- Works: ${profile.workSchedule.startTime} to ${profile.workSchedule.endTime || 'Evening'}`;
      }
      if (profile.reminderPreferences?.enableReminders) {
        context += `\n- Likes reminders and organization`;
      }
      context += `\n- Tone: Friendly, supportive, encouraging. Like a caring friend who gets them.`;
    }

    return context;
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
