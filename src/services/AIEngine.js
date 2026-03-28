import { Groq } from 'groq-sdk';
import logger from '../utils/logger.js';

/**
 * Groq AI Engine
 * Handles intent detection, entity extraction, and response generation
 */
export class AIEngine {
  constructor() {
    this.apiKey = process.env.GROQ_API_KEY || 'dummy_key_for_development';
    this.model = 'llama-3.3-70b-versatile';

    if (!this.apiKey || this.apiKey === 'dummy_key_for_development') {
      logger.warn('⚠️ GROQ_API_KEY not configured - AI features will be unavailable in production');
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
        systemPrompt = `You are LifeOS AI assistant. Extract intent and entities from user message with high accuracy.

INTENT DEFINITIONS:
- CREATE_REMINDER: User wants to be reminded to do something at a specific time (keywords: "remind me", "set reminder", "call", "message", "alarm", "notify", "at [time]")
- QUERY_REMINDERS: User wants to see their list of reminders (keywords: "what are my reminders", "show reminders", "daily reminder list", "list of reminders")
- LOG_ACTIVITY: User logs a completed activity (keywords: "done", "completed", "finished", "logged", "tracked")
- CREATE_ROUTINE: User creates a daily/weekly/monthly routine (keywords: "every day", "daily routine", "daily", "weekly")
- UPDATE_REMINDER: User wants to change a reminder (keywords: "update reminder", "change reminder for")
- DELETE_REMINDER: User wants to delete a reminder (keywords: "delete reminder", "remove all reminders", "cancel")
- UPDATE_ROUTINE: User wants to change a routine (keywords: "update routine", "change routine")
- DELETE_ROUTINE: User wants to delete a routine (keywords: "delete routine", "stop routine")
- CHAT: General conversation, question, or unclear intent
- Other intents: CREATE_CLIENT, LOG_INVOICE, SCHEDULE_MEETING, LOG_LEAD, CREATE_PROJECT

EXAMPLES:
- "Set a reminder to call my brother at 6:55 pm today" → CREATE_REMINDER, activity: "call my brother", time: "6:55 pm today"
- "Remind me to send email at 3 PM" → CREATE_REMINDER, activity: "send email", time: "3 PM"
- "What about my daily reminder" → QUERY_REMINDERS
- "I did workout today" → LOG_ACTIVITY, activity: "workout"
- "Daily morning jog at 6 AM" → CREATE_ROUTINE, activity: "morning jog", time: "6 AM"

Return ONLY valid JSON (no markdown, no code blocks):
{
  "intent": "CREATE_REMINDER|LOG_ACTIVITY|CHAT|QUERY_ROUTINE|DELETE_REMINDER|UPDATE_REMINDER|UPDATE_ROUTINE|DELETE_ROUTINE|CREATE_ROUTINE|QUERY_REMINDERS|CREATE_CLIENT|LOG_INVOICE|SCHEDULE_MEETING|LOG_LEAD|CREATE_PROJECT",
  "confidence": 0.90,
  "activity": "what user wants to do",
  "time": "when user wants to do it (extract from message)",
  "entities": {
    "repeat": "none|daily|weekly|monthly if applicable"
  }
}

Context: ${JSON.stringify(context)}`;
      } else if (lang === 'hindi') {
        systemPrompt = `आप LifeOS AI सहायक हो। संदेश से intent और entities निकालो।

INTENT परिभाषाएं:
- CREATE_REMINDER: User को किसी समय कुछ करने के लिए याद दिलाना (शब्द: "remind me", "याद दिलाना", "कॉल", "alert", "[समय] पर")
- QUERY_REMINDERS: User अपने reminder देखना चाहता है (शब्द: "mere reminders", "show reminders", "daily reminder list")
- LOG_ACTIVITY: किया हुआ काम दर्ज करना (शब्द: "done", "किया", "complete", "finished")
- CREATE_ROUTINE: दैनिक/साप्ताहिक routine बनाना (शब्द: "हर दिन", "रोज़", "daily", "weekly")
- UPDATE_REMINDER: Reminder बदलना (शब्द: "update reminder", "change reminder for")
- DELETE_REMINDER: Reminder हटाना (शब्द: "delete reminder", "remove all reminders", "cancel")
- UPDATE_ROUTINE: Routine बदलना (शब्द: "update routine", "change routine")
- DELETE_ROUTINE: Routine हटाना (शब्द: "delete routine", "stop routine")
- CHAT: सामान्य बातचीत

उदाहरण:
- "आज 6:55 बजे मुझे अपने भाई को कॉल करने के लिए याद दिलाना" → CREATE_REMINDER
- "कल 3 बजे email भेजना याद दिलाना" → CREATE_REMINDER
- "मेरे reminders क्या हैं?" → QUERY_REMINDERS
- "आज workout कर लिया" → LOG_ACTIVITY
- "रोज़ सुबह 6 बजे दौड़ना" → CREATE_ROUTINE

केवल JSON लौटाओ:
{
  "intent": "CREATE_REMINDER|LOG_ACTIVITY|CHAT|QUERY_ROUTINE|DELETE_REMINDER|UPDATE_REMINDER|UPDATE_ROUTINE|DELETE_ROUTINE|CREATE_ROUTINE|QUERY_REMINDERS|CREATE_CLIENT|LOG_INVOICE|SCHEDULE_MEETING|LOG_LEAD|CREATE_PROJECT",
  "confidence": 0.90,
  "activity": "क्या करना है",
  "time": "कब करना है",
  "entities": {
    "repeat": "none|daily|weekly|monthly"
  }
}`;
      } else {
        // Hinglish
        systemPrompt = `You are LifeOS AI assistant. Intent aur entities nikalo message se.

INTENT DEFINITIONS:
- CREATE_REMINDER: Remind karna user ko kuch karne ke liye (keywords: "remind me", "yaad dilao", "call", "karo", "[time] par")
- QUERY_REMINDERS: User ko apne reminders dekhne hain (keywords: "mere reminders", "show reminders", "kya reminders list")
- LOG_ACTIVITY: Activity complete karna (keywords: "done", "kiya", "complete", "finished")
- CREATE_ROUTINE: Daily/weekly routine banao (keywords: "har din", "roz", "daily", "weekly")
- UPDATE_REMINDER: Reminder change karna (keywords: "update reminder", "change reminder for")
- DELETE_REMINDER: Reminder delete karna (keywords: "delete reminder", "remove all reminders", "cancel")
- UPDATE_ROUTINE: Routine change karna (keywords: "update routine", "change routine")
- DELETE_ROUTINE: Routine delete karna (keywords: "delete routine", "stop routine")
- CHAT: General baat cheet

Examples:
- "Set a reminder to call my brother at 6:55 pm today" → CREATE_REMINDER, activity: "call brother", time: "6:55 pm today"
- "Aaj 3 baje mujhe email bhejne ke liye yaad dilao" → CREATE_REMINDER
- "Mere reminders dikhao" → QUERY_REMINDERS
- "Mai aaj workout kar liya" → LOG_ACTIVITY
- "Roz subah 6 baje daud lagana" → CREATE_ROUTINE

Return ONLY JSON:
{
  "intent": "CREATE_REMINDER|LOG_ACTIVITY|CHAT|QUERY_ROUTINE|DELETE_REMINDER|UPDATE_REMINDER|UPDATE_ROUTINE|DELETE_ROUTINE|CREATE_ROUTINE|QUERY_REMINDERS|CREATE_CLIENT|LOG_INVOICE|SCHEDULE_MEETING|LOG_LEAD|CREATE_PROJECT",
  "confidence": 0.90,
  "activity": "kya karna hai",
  "time": "kab karna hai",
  "entities": {
    "repeat": "none|daily|weekly|monthly"
  }
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

  async generateResponse(intent, entities, userContext = {}, currentUserMessage = '', routeResult = {}) {
    try {
      const lang = this.detectLanguage(currentUserMessage);
      const userName = userContext?.userProfile?.name || '';

      // INTENT-SPECIFIC RESPONSES (priority over generic AI-generated responses)
      if (intent === 'UPDATE_NAME') {
        let newName = entities?.activity || entities?.name || routeResult?.data?.name || 'buddy';
        
        if (lang === 'hindi') {
          return `✅ शानदार! अब से मैं आपको ${newName} के नाम से बुलूँगा! 😊`;
        } else if (lang === 'hinglish') {
          return `✅ Done! Ab se main aapko ${newName} ke naam se bulaunga! 😊`;
        } else {
          return `✅ Perfect! I'll call you ${newName} from now on! 😊`;
        }
      }

      if (intent === 'QUERY_REMINDERS') {
        // Use formatted reminder list from routeResult
        const formatted = routeResult?.data?.formatted || '';
        const count = routeResult?.data?.count || 0;
        
        if (count === 0) {
          if (lang === 'hindi') {
            return `📋 आपके पास कोई reminder नहीं है 😊\n\nअगर चाहो तो मैं आपके लिए reminder set कर दूँ?`;
          } else if (lang === 'hinglish') {
            return `📋 Aapke paas koi reminder nahi hai 😊\n\nAgar chahte ho to main aapke liye reminder set kar du?`;
          } else {
            return `📋 You don't have any reminders yet 😊\n\nWant me to set one for you?`;
          }
        }
        
        return formatted;
      }

      if (intent === 'CREATE_REMINDER') {
        // Extract activity and time - try multiple sources
        let activity = entities?.activity || this._extractActivity(currentUserMessage) || 'reminder';
        let time = entities?.time || this._extractTime(currentUserMessage) || 'the specified time';
        
        if (lang === 'hindi') {
          return `✅ ठीक है! मैंने आपको ${activity} की याद दिलाने के लिए ${time} पर रिमाइंडर सेट कर दिया है। 🔔`;
        } else if (lang === 'hinglish') {
          return `✅ Done! Maine aapko ${activity} ke liye ${time} par reminder set kar diya hai. 🔔`;
        } else {
          return `✅ Got it! I'll remind you to ${activity} at ${time}. 🔔`;
        }
      }

      if (intent === 'LOG_ACTIVITY') {
        let activity = entities?.activity || this._extractActivity(currentUserMessage) || 'activity';
        
        if (lang === 'hindi') {
          return `✅ शानदार! मैंने दर्ज कर दिया कि आपने ${activity} पूरा कर लिया। शानदार काम! 💪`;
        } else if (lang === 'hinglish') {
          return `✅ Awesome! Maine log kar diya ki aapne ${activity} complete kar liya. Great work! 💪`;
        } else {
          return `✅ Awesome! I've logged that you completed ${activity}. Great work! 💪`;
        }
      }

      if (intent === 'CREATE_ROUTINE') {
        let extractedActivity = this._extractActivity(currentUserMessage);
        let extractedTime = this._extractTime(currentUserMessage);
        
        let activity = entities?.activity;
        if (!activity || activity === 'null') activity = extractedActivity;
        if (!activity || activity === 'null') activity = 'this routine';
        
        let time = entities?.time;
        if (!time || time === 'null') time = extractedTime;
        if (!time || time === 'null') time = 'the specified time';
        
        if (lang === 'hindi') {
          return `✅ बिल्कुल! मैंने आपके लिए ${activity} का daily routine ${time} पर सेट कर दिया है। 📅`;
        } else if (lang === 'hinglish') {
          return `✅ Bilkul! Maine ${activity} ka daily routine ${time} par set kar diya. 📅`;
        } else {
          return `✅ Perfect! I've set up a daily routine for ${activity} at ${time}. 📅`;
        }
      }

      if (intent === 'DELETE_REMINDER' || intent === 'DELETE_ROUTINE') {
        if (routeResult?.success === false) {
          if (lang === 'hindi') return `❌ मुझे डिलीट करने के लिए वह नहीं मिला।`;
          if (lang === 'hinglish') return `❌ Mujhe delete karne ke liye wo nahi mila.`;
          return `❌ I couldn't find a matching item to delete.`;
        }
        
        const deletedItem = routeResult?.deleted || 'it';
        if (lang === 'hindi') return `✅ जैसे चाहो! मैंने **${deletedItem}** को डिलीट कर दिया। 🗑️`;
        if (lang === 'hinglish') return `✅ Bilkul! Maine **${deletedItem}** ko delete kar diya. 🗑️`;
        return `✅ Done! I've deleted **${deletedItem}**. 🗑️`;
      }
      
      if (intent === 'UPDATE_REMINDER' || intent === 'UPDATE_ROUTINE') {
        if (routeResult?.success === false) {
          if (lang === 'hindi') return `❌ मुझे अपडेट करने के लिए वह नहीं मिला।`;
          if (lang === 'hinglish') return `❌ Mujhe update karne ke liye wo nahi mila.`;
          return `❌ I couldn't find a matching item to update.`;
        }
        
        const updatedItem = routeResult?.updated || 'it';
        if (lang === 'hindi') return `✅ डन! मैंने **${updatedItem}** को अपडेट कर दिया है। 🔄`;
        if (lang === 'hinglish') return `✅ Done! Maine **${updatedItem}** ko update kar diya. 🔄`;
        return `✅ You got it! I've updated **${updatedItem}**. 🔄`;
      }

      // For CHAT and other intents, use AI-generated response
      let profileContext = this._buildPersonalContext(userContext);
      let systemPrompt = '';
      
      if (lang === 'english') {
        systemPrompt = `You are ${userName ? userName + "'s" : "the"} personal AI assistant - like a helpful friend who genuinely cares about their wellbeing.

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
- Make them feel understood and valued${profileContext}`;
      } else if (lang === 'hindi') {
        systemPrompt = `आप ${userName ? userName + 'के' : 'एक'} व्यक्तिगत AI सहायक हैं - एक सहायक दोस्त की तरह जो उनकी भलाई की परवाह करता है।

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
- हमेशा हिंदी में जवाब दें${profileContext}`;
      } else {
        // Hinglish - conversational mix
        systemPrompt = `Aap ${userName ? userName + 'ke' : 'ek'} personal AI assistant ho - jaise ek helpful dost jo unhe sach mein care karta hai.

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
- Hinglish mix use karo jaise vo kar rahe ho${profileContext}`;
      }

      const userPrompt = `User just asked: "${currentUserMessage}"

Respond naturally and warmly. Be concise (1-2 sentences). Don't list things.`;

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
      
      const lang = this.detectLanguage(currentUserMessage);
      
      if (lang === 'hindi') {
        return `कुछ गलती हुई 😅 फिर से कोशिश करो।`;
      } else if (lang === 'hinglish') {
        return `Kuch error ho gaya 😅. Phir se try karo na.`;
      } else {
        return `Oops! Something went wrong. Let me try again.`;
      }
    }
  }

  /**
   * Extract activity from message (fallback)
   */
  _extractActivity(message) {
    // Look for common patterns like "remind me to [activity]" or "call [person]"
    const patterns = [
      /remind me to (.+?)(?:at|today|tomorrow|,|$)/i,
      /call (.+?)(?:at|today|,|$)/i,
      /send (.+?)(?:to|at|today|,|$)/i,
      /do (.+?)(?:at|today|,|$)/i,
      /log (.+?)(?:today|$)/i,
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return null;
  }

  /**
   * Extract time from message (fallback)
   */
  _extractTime(message) {
    // Look for time patterns
    const patterns = [
      /(\d{1,2}):(\d{2})\s*(am|pm)?/i,
      /(today|tomorrow|tonight)/i,
      /at (.+?)(?:,|$)/i,
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return match[0];
      }
    }
    return null;
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
