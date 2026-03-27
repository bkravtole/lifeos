# REMINDER Intent Detection & Entity Extraction in LifeOS

## Overview
The LifeOS system detects REMINDER intents and extracts datetime/time/activity entities using a multi-stage process:
1. **AI Intent Detection** (AIEngine.js) - Uses Groq LLM
2. **Entity Extraction** - Extracts activity, time, and other entities
3. **Time Parsing** (webhook.js) - Converts time strings to DateTime objects
4. **Reminder Creation** (ReminderService.js) - Stores reminder in database

---

## 1. REMINDER Intent Detection (AIEngine.js)

### Main Method: `detectIntent()`
**Location:** [src/services/AIEngine.js](src/services/AIEngine.js#L45)

**Returns:** `{ intent, confidence, entities, activity, time, language }`

```javascript
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
```

### Key Points:
- **Uses Groq LLM** (llama-3.3-70b-versatile model)
- **Returns 13 possible intents** including `CREATE_REMINDER`
- **Multi-language support**: English, Hindi, Hinglish
- **Extracted fields for REMINDER**:
  - `activity`: The reminder text (e.g., "Call Mom")
  - `time`: Time/datetime string from user
  - `entities`: Additional metadata object

---

## 2. Entity Extraction (AIEngine.js)

### Method: `extractEntities()`
**Location:** [src/services/AIEngine.js](src/services/AIEngine.js#L126)

```javascript
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
```

### Extracted Entities for REMINDER:
- `activity`: Reminder activity/title
- `time`: Time string (e.g., "09:00", "2:30 PM", "tomorrow 9 AM")
- `date`: Date if specified differently from time
- `duration`: How long to remind for (in minutes)
- `priority`: low|medium|high
- `repeat`: daily|weekly|monthly|none

---

## 3. Language Detection (AIEngine.js)

### Method: `detectLanguage()`
**Location:** [src/services/AIEngine.js](src/services/AIEngine.js#L157)

**Priority:** English > Hinglish > Hindi

```javascript
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
```

### Language Detection Logic:
- **Unicode Range for Hindi:** `[\u0900-\u097F]` (Devanagari script)
- **English Characters:** `[a-zA-Z]`
- **Priority Decision:**
  - Pure English → English
  - Mix with >= English chars → English
  - Mix with more Hindi → Hinglish
  - Mostly/Pure Hindi → Hindi
  - Default → English

---

## 4. Time String Parsing (webhook.js)

### Function: `parseTimeToDateTime()`
**Location:** [src/api/webhook.js](src/api/webhook.js#L35)

```javascript
function parseTimeToDateTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') {
    return null;
  }

  const now = new Date();
  let targetDate = new Date(now);
  let hour = 9, minute = 0; // default to 9 AM

  const lowerStr = timeStr.toLowerCase().trim();

  // Parse hour and minute with REGEX pattern
  const timeMatch = lowerStr.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
  if (timeMatch) {
    hour = parseInt(timeMatch[1]);
    minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    
    // Handle AM/PM
    if (timeMatch[3]) {
      const ampm = timeMatch[3].toLowerCase();
      if (ampm === 'pm' && hour < 12) hour += 12;
      if (ampm === 'am' && hour === 12) hour = 0;
    }
  }

  // Check for "tomorrow", "next day", "day after" etc
  if (lowerStr.includes('tomorrow') || lowerStr.includes('कल') || lowerStr.includes('agle din')) {
    targetDate.setDate(targetDate.getDate() + 1);
  }

  targetDate.setHours(hour, minute, 0, 0);
  return targetDate;
}
```

### Time Parsing Features:

#### Regex Pattern for Time Extraction:
```regex
/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i
```

**Match Groups:**
- Group 1: Hour (1-2 digits) - optional colon separator
- Group 2: Minutes (2 digits) - optional
- Group 3: am/pm - optional

#### Supported Time Formats:
- `09:00` → 9:00 AM
- `9:00` → 9:00 AM
- `900` → 9:00 AM (colon optional)
- `9` → 9:00 AM
- `2:30 PM` → 2:30 PM (14:30)
- `2:30pm` → 2:30 PM
- `9 AM` → 9:00 AM
- `tomorrow 9 AM` → Tomorrow at 9:00 AM

#### Hindi/Hinglish Time Keywords:
```javascript
// Checks for variant spellings of "tomorrow"
if (lowerStr.includes('tomorrow') || 
    lowerStr.includes('कल') ||        // Hindi: kal (tomorrow)
    lowerStr.includes('agle din'))    // Hinglish: agle din (next day)
```

#### Defaults:
- **Default hour:** 9 (9 AM)
- **Default minute:** 0
- **Default date:** If no tomorrow/future date found, uses today
- **If parse fails:** Returns null → Falls back to tomorrow 9 AM

---

## 5. Complete Flow: From User Message to Reminder

### Step-by-Step in webhook.js:

```javascript
// 1. User sends message
const rawMessage = whatsappService.parseWebhookMessage(req.body);

// 2. AI detects REMINDER intent
const aiResult = await aiEngine.detectIntent(processedMessage.text, context);
// Returns: { intent: 'CREATE_REMINDER', activity: 'Call Mom', time: '9 AM', ... }

// 3. In handlers.reminderService.createReminder():
const reminderHandler = async (entities) => {
  // Extract time string from LLM output
  let reminderDateTime = entities.datetime || entities.time;
  
  // Parse time string to DateTime
  if (typeof reminderDateTime === 'string') {
    reminderDateTime = parseTimeToDateTime(reminderDateTime);
    // 'tomorrow 9 AM' → Date object for tomorrow 9:00 AM
  }
  
  // Fallback if parsing fails
  if (!(reminderDateTime instanceof Date)) {
    reminderDateTime = new Date();
    reminderDateTime.setDate(reminderDateTime.getDate() + 1);
    reminderDateTime.setHours(9, 0, 0, 0);
  }
  
  // Create reminder with parsed datetime
  const reminder = await ReminderService.createReminder(user._id, {
    activity: entities.activity || 'Reminder',
    title: entities.activity || 'Reminder',
    datetime: reminderDateTime,
    repeat: entities.repeat || 'none',
    priority: entities.priority || 'medium',
    description: entities.description
  });
};

// 4. Route to handler
const routeResult = await IntentRouter.route(aiResult.intent, aiResult.entities, handlers);

// 5. Generate personalized response
const responseText = await aiEngine.generateResponse(
  aiResult.intent,
  aiResult.entities,
  contextWithProfile,
  processedMessage.text
);

// 6. Send response to user via WhatsApp
await whatsappService.sendMessage(rawMessage.from, responseText);
```

---

## 6. IntentRouter - REMINDER Handling

### Method: `route()`
**Location:** [src/services/IntentRouter.js](src/services/IntentRouter.js#L6)

```javascript
static async route(intent, entities, handlers) {
  try {
    switch (intent) {
      case 'CREATE_REMINDER':
        return await handlers.reminderService?.createReminder(entities);

      case 'UPDATE_REMINDER':
        return await handlers.reminderService?.updateReminder(entities);

      case 'DELETE_REMINDER':
        return await handlers.reminderService?.deleteReminder(entities);

      // ... other intents ...
      
      default:
        logger.warn('Unknown intent:', intent);
        return { success: false, message: 'Intent not recognized' };
    }
  } catch (error) {
    logger.error('Intent routing failed:', error.message);
    throw error;
  }
}
```

---

## 7. ReminderService - Data Storage

### Method: `createReminder()`
**Location:** [src/services/ReminderService.js](src/services/ReminderService.js#L8)

```javascript
static async createReminder(userId, data) {
  try {
    const reminder = new Reminder({
      userId,
      title: data.activity || data.title,
      description: data.description,
      datetime: data.datetime || new Date(),
      repeat: data.repeat || 'none',
      priority: data.priority || 'medium'
    });

    await reminder.save();
    logger.info('Reminder created:', { reminderId: reminder._id, userId });
    return reminder;
  } catch (error) {
    logger.error('Failed to create reminder:', error.message);
    throw error;
  }
}
```

---

## 8. Example User Interactions

### Example 1: English
**User:** "Remind me to call Mom tomorrow at 2 PM"

**Flow:**
1. Language detected: **English**
2. Intent detected: **CREATE_REMINDER**
3. Extracted entities:
   - `activity`: "call Mom"
   - `time`: "tomorrow at 2 PM"
4. Time parsed: Tomorrow @ 14:00 (2:00 PM)
5. Reminder created and saved

### Example 2: Hindi
**User:** "कल 9 बजे मुझे याद दिला देना meeting के बारे में"
*(Kal 9 baje mujhe yaad dila dena meeting ke bare mein)*
*(Tomorrow at 9 AM remind me about the meeting)*

**Flow:**
1. Language detected: **Hindi**
2. Intent detected: **CREATE_REMINDER**
3. Extracted entities:
   - `activity`: "meeting"
   - `time`: "कल 9 बजे" (tomorrow 9 AM)
4. Time parsed: Tomorrow @ 09:00
5. Reminder created

### Example 3: Hinglish
**User:** "Agle din 3:30 PM ko mujhe yaad dilao - project submit karna hai"
*(Remind me tomorrow at 3:30 PM - need to submit project)*

**Flow:**
1. Language detected: **Hinglish**
2. Intent detected: **CREATE_REMINDER**
3. Extracted entities:
   - `activity`: "project submit karna"
   - `time`: "agle din 3:30 PM"
4. Time parsed: Tomorrow @ 15:30 (3:30 PM)
5. Reminder created

---

## 9. Key Technical Implementation Details

### Multi-Language Support:
- **System prompts customized** per language (English, Hindi, Hinglish)
- **Same JSON schema** returned regardless of language
- **Language priority:** English is preferred in mixed text

### Regex Patterns Used:
| Pattern | Purpose | Example |
|---------|---------|---------|
| `[\u0900-\u097F]` | Detect Hindi/Devanagari characters | Matches: क ख ग... |
| `[a-zA-Z]` | Detect English characters | Matches: a-z A-Z |
| `/(\d{1,2}):?(\d{2})?\s*(am\|pm)?/i` | Parse time strings | "9:00 AM", "930pm" |

### Entity Extraction Strategy:
1. LLM extracts natural language to structured JSON
2. Activity extracted as reminder title
3. Time extracted as string (e.g., "9 AM", "tomorrow 2:30 PM")
4. Time string is then parsed to JavaScript Date object
5. All entities stored in Reminder model with datetime field

### Fallback Behavior:
- If time parsing fails → defaults to **tomorrow 9 AM**
- If entity extraction fails → returns empty entities
- If intent detection fails → defaults to **CHAT** intent
- If response generation fails → sends multilingual fallback message

---

## 10. Summary

**REMINDER Intent Detection Process:**
1. ✅ User sends WhatsApp message
2. ✅ AIEngine.detectIntent() uses Groq LLM to identify CREATE_REMINDER intent
3. ✅ AIEngine extracts: activity, time, repeat, priority from message
4. ✅ detectLanguage() identifies if English/Hindi/Hinglish
5. ✅ webhook.js parseTimeToDateTime() converts time string to Date object
6. ✅ IntentRouter routes to ReminderService.createReminder()
7. ✅ Reminder saved to database with parsed datetime
8. ✅ AI generates personalized response in detected language
9. ✅ Response sent back via WhatsApp
