// /**
//  * LifeOS WhatsApp AI - Complete TEST & REFERENCE
//  * Run these requests to test the full system integration
//  */

// // ============================================
// // 🚀 TEST 1: Health Check
// // ============================================
//  http://localhost:3000/api/health

// // Expected Response:
// // {
// //   "status": "ok",
// //   "timestamp": "2024-03-27T10:00:00.000Z",
// //   "uptime": 123.456
// // }

// // ============================================
// // 🚀 TEST 2: Send Text Message via Webhook
// // ============================================
// // POST http://localhost:3000/api/webhook/whatsapp
// // Content-Type: application/json
// // x-11za-signature: webhook_token

// {
//   "from": "917016875366",
//   "to": "918866548369",
//   "channel": "whatsapp",
//   "timestamp": 1711353600,
//   "messageId": "msg_test_001",
//   "senderName": "Test User",
//   "content": {
//     "contentType": "text",
//     "text": "kal 7 baje gym yaad dilana"
//   }
// };

// // Expected Response:
// // {
// //   "success": true,
// //   "intent": "CREATE_REMINDER",
// //   "messageId": "msg_test_001"
// // }

// // Expected AI Response to User (WhatsApp):
// // "✅ Kal 7 बजे gym का reminder set कर दिया! 💪"

// // ============================================
// // 🚀 TEST 3: Interactive Button Message Received
// // ============================================
// POST http://localhost:3000/api/webhook/whatsapp
// Content-Type: application/json
// x-11za-signature: webhook_token

// {
//   "from": "917016875366",
//   "to": "918866548369",
//   "channel": "whatsapp",
//   "timestamp": 1711353600,
//   "messageId": "msg_interaction_001",
//   "senderName": "Test User",
//   "content": {
//     "contentType": "interactive",
//     "interactive": {
//       "subType": "buttons",
//       "components": {
//         "body": {
//           "type": "text",
//           "text": "क्या आप gym कर चुके?"
//         },
//         "reply": {
//           "payload": "btn_yes_uuid_001",
//           "title": "✅ हाँ"
//         }
//       }
//     }
//   }
// }

// // Expected Response:
// // {
// //   "success": true,
// //   "intent": "LOG_ACTIVITY",
// //   "messageId": "msg_interaction_001"
// // }

// // ============================================
// // 🚀 TEST 4: Interactive List Message Received
// // ============================================
// POST http://localhost:3000/api/webhook/whatsapp
// Content-Type: application/json
// x-11za-signature: webhook_token

// {
//   "from": "917016875366",
//   "to": "918866548369",
//   "channel": "whatsapp",
//   "timestamp": 1711353600,
//   "messageId": "msg_list_001",
//   "senderName": "Test User",
//   "content": {
//     "contentType": "interactive",
//     "interactive": {
//       "subType": "list",
//       "components": {
//         "body": {
//           "type": "text",
//           "text": "कृपया अपनी activity चुनें:"
//         },
//         "reply": {
//           "payload": "activity_gym_uuid_001",
//           "title": "💪 Gym"
//         }
//       }
//     }
//   }
// }

// // Expected Response:
// // {
// //   "success": true,
// //   "intent": "LOG_ACTIVITY",
// //   "messageId": "msg_list_001"
// // }

// // ============================================
// // 🚀 TEST 5: Get User Profile
// // ============================================
// GET http://localhost:3000/api/user/917016875366

// // Expected Response:
// // {
// //   "_id": "ObjectId",
// //   "phone": "917016875366",
// //   "name": "Test User",
// //   "timezone": "Asia/Kolkata",
// //   "preferences": {
// //     "language": "hi",
// //     "notificationsEnabled": true
// //   },
// //   "metadata": {
// //     "lastMessageAt": "2024-03-27T10:00:00.000Z",
// //     "totalMessages": 3
// //   },
// //   "createdAt": "2024-03-27T10:00:00.000Z",
// //   "updatedAt": "2024-03-27T10:05:00.000Z"
// // }

// // ============================================
// // 🚀 TEST 6: Get Active Reminders
// // ============================================
// GET http://localhost:3000/api/reminders/user_id_here

// // Expected Response:
// // [
// //   {
// //     "_id": "reminder_id",
// //     "userId": "user_id",
// //     "title": "gym",
// //     "datetime": "2024-03-28T19:00:00.000Z",
// //     "repeat": "none",
// //     "status": "active",
// //     "priority": "medium",
// //     "notified": false,
// //     "createdAt": "2024-03-27T10:00:00.000Z"
// //   }
// // ]

// // ============================================
// // 🚀 TEST 7: Get Routines
// // ============================================
// GET http://localhost:3000/api/routines/user_id_here

// // Expected Response:
// // [
// //   {
// //     "_id": "routine_id",
// //     "userId": "user_id",
// //     "activity": "Morning Exercise",
// //     "schedule": "daily",
// //     "time": "06:00",
// //     "daysOfWeek": [0,1,2,3,4,5,6],
// //     "active": true,
// //     "createdAt": "2024-03-27T10:00:00.000Z"
// //   }
// // ]

// // ============================================
// // 🚀 TEST 8: Get Activity History
// // ============================================
// GET http://localhost:3000/api/activity-history/user_id_here?days=30

// // Expected Response:
// // [
// //   {
// //     "_id": "activity_id",
// //     "userId": "user_id",
// //     "activity": "gym",
// //     "status": "done",
// //     "date": "2024-03-27T19:30:00.000Z",
// //     "duration": 60,
// //     "createdAt": "2024-03-27T19:30:00.000Z"
// //   }
// // ]

// // ============================================
// // 🚀 TEST 9: Get User Context
// // ============================================
// GET http://localhost:3000/api/context/user_id_here

// // Expected Response:
// // {
// //   "_id": "conversation_id",
// //   "userId": "user_id",
// //   "messages": [
// //     {
// //       "role": "user",
// //       "content": "kal 7 baje gym yaad dilana",
// //       "timestamp": "2024-03-27T10:00:00.000Z"
// //     },
// //     {
// //       "role": "assistant",
// //       "content": "✅ Kal 7 बजे gym का reminder set कर दिया! 💪",
// //       "timestamp": "2024-03-27T10:00:05.000Z"
// //     }
// //   ],
// //   "context": {
// //     "lastActivity": "gym",
// //     "missedActivities": [],
// //     "preferences": {}
// //   }
// // }

// // ============================================
// // 🎯 TESTING SCENARIOS
// // ============================================

// /**
//  * Scenario 1: Create Reminder
//  * 
//  * User: "kal 7 baje gym yaad dilana"
//  * 
//  * Expected Flow:
//  * 1. Message → Webhook
//  * 2. AI detects → CREATE_REMINDER (confidence: 0.95)
//  * 3. UI extracts → activity: "gym", time: "7pm", date: "tomorrow"
//  * 4. Service creates → Reminder in DB
//  * 5. Response → "✅ Kal 7 बजे gym का reminder set कर दिया! 💪"
//  * 6. Conversation stored in DB
//  * 
//  * Next Day @ 7 PM:
//  * 1. Scheduler runs every minute
//  * 2. Finds reminder where datetime <= now && notified = false
//  * 3. Sends interactive button message
//  * 4. User clicks ✅ Done
//  * 5. Activity logged
//  * 6. Response sent back
//  */

// /**
//  * Scenario 2: Log Activity
//  * 
//  * User selects: ✅ Done (button reply)
//  * 
//  * Expected Flow:
//  * 1. Interactive message received
//  * 2. AI detects → LOG_ACTIVITY
//  * 3. Service logs → ActivityLog in DB with status=done
//  * 4. Response → "🎉 शानदार! आपकी streak 5 दिन की हो गई! 🔥"
//  */

// /**
//  * Scenario 3: Routine Check
//  * 
//  * Daily @ 6 AM
//  * 
//  * Expected Flow:
//  * 1. Scheduler finds routine: "Morning Exercise" at 06:00
//  * 2. User found
//  * 3. Check if user sleeping (quiet hours: 10 PM - 6 AM)
//  * 4. Send button message: "क्या आपने अपना काम पूरा कर लिया?"
//  * 5. Options: [✅ हाँ, ❌ नहीं]
//  */

// // ============================================
// // 📊 USER FLOW DIAGRAM
// // ============================================

// /*
// ┌─────────────────────────────────────────────┐
// │  User sends WhatsApp message                │
// │  "kal 7 baje gym yaad dilana"               │
// └────────────────┬────────────────────────────┘
//                  │
//                  ▼
//         ┌──────────────────┐
//         │ 11za Webhook     │
//         │ /api/webhook/    │
//         │ whatsapp (POST)  │
//         └────────┬─────────┘
//                  │
//          ┌───────┴──────────┐
//          │                  │
//     Parse Message     Verify Signature
//          │                  │
//          └────────┬─────────┘
//                   │
//                   ▼
//         ┌──────────────────────────┐
//         │ Message Processor        │
//         │ Normalize & structure    │
//         └────────┬─────────────────┘
//                  │
//                  ▼
//         ┌──────────────────────────┐
//         │ User lookup/create       │
//         │ MongoDB: User collection │
//         └────────┬─────────────────┘
//                  │
//                  ▼
//         ┌──────────────────────────┐
//         │ Get Context              │
//         │ Conversation history     │
//         └────────┬─────────────────┘
//                  │
//                  ▼
//         ┌──────────────────────────┐
//         │ AI Engine (Groq)         │
//         │ detectIntent()           │
//         │ → CREATE_REMINDER        │
//         └────────┬─────────────────┘
//                  │
//                  ▼
//         ┌──────────────────────────┐
//         │ Intent Router            │
//         │ Route to service         │
//         └────────┬─────────────────┘
//                  │
//                  ▼
//         ┌──────────────────────────┐
//         │ Reminder Service         │
//         │ Create in MongoDB        │
//         └────────┬─────────────────┘
//                  │
//                  ▼
//         ┌──────────────────────────┐
//         │ AI Engine (Groq)         │
//         │ generateResponse()       │
//         └────────┬─────────────────┘
//                  │
//                  ▼
//         ┌──────────────────────────┐
//         │ WhatsApp Service         │
//         │ sendMessage() via 11za   │
//         └────────┬─────────────────┘
//                  │
//                  ▼
//     ┌────────────────────────────────┐
//     │ User receives response          │
//     │ "✅ Kal 7 बजे gym का reminder" │
//     └────────────────────────────────┘
// */

// // ============================================
// // 🔧 ENVIRONMENT VARIABLES
// // ============================================

// /*
// WHATSAPP_API_URL=https://api.11za.in
// WHATSAPP_API_TOKEN=your_token
// WHATSAPP_WEBHOOK_TOKEN=your_webhook_token
// ORIGIN_WEBSITE=https://yourwebsite.com

// MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/lifeos
// DB_NAME=lifeos

// GROQ_API_KEY=your_groq_api_key

// NODE_ENV=development
// PORT=3000
// HOST=0.0.0.0

// LOG_LEVEL=info
// DEFAULT_TIMEZONE=Asia/Kolkata
// */

// // ============================================
// // 📦 DEPLOYMENT (Vercel)
// // ============================================

// /*
// 1. Connect GitHub repo to Vercel
// 2. Set Environment Variables in Vercel dashboard
// 3. Vercel automatically runs: npm install && npm run build
// 4. Deploy runs: node /api/index.js

// 11za Webhook URL should be:
// https://your-vercel-domain.vercel.app/api/webhook/whatsapp
// */

// // ============================================
// // ✅ WHAT'S WORKING
// // ============================================

// /*
// ✅ Message Processor - Raw → Structured
// ✅ AI Engine (Groq) - Intent detection & response  
// ✅ 11za Integration - Text & Interactive messages
// ✅ Reminder Service - Create, update, delete
// ✅ Routine Service - Daily/weekly scheduling
// ✅ Activity Service - Logging & statistics
// ✅ Context Engine - Conversation memory
// ✅ Scheduler (Node-Cron) - Automatic reminders
// ✅ Webhook Handler - Full routing for all intents
// ✅ WhatsApp Service - 11za API integration
// ✅ Winston Logging - File & console logging
// ✅ MongoDB - All collections & relationships
// ✅ Vercel Ready - Serverless deployment
// */

// // ============================================
// // 🚀 RUN FIRST
// // ============================================

// /*
// 1. npm install
// 2. Add .env with credentials
// 3. npm run dev
// 4. Test webhook: POST http://localhost:3000/api/webhook/whatsapp
// 5. Check health: GET http://localhost:3000/api/health
// */
