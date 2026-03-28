# LifeOS WhatsApp AI - Demo Guide 🚀

## How to Start & Test All Features on WhatsApp

---

## 📋 Prerequisites

Make sure you have:
- ✅ Node.js installed
- ✅ `.env` file configured (already done ✓)
- ✅ MongoDB connection (already set up ✓)
- ✅ Groq API key (already set up ✓)
- ✅ 11za WhatsApp API access (already set up ✓)

---

## 🚀 Step 1: Start the Server Locally

### Option A: Development Mode (Recommended for testing)
```bash
npm run dev
```

Expected output:
```
✅ LifeOS Server running on http://localhost:3000
✅ Database connected to MongoDB
✅ Reminder scheduler started
✅ Ready to receive WhatsApp messages
```

### Option B: Production Mode
```bash
npm start
```

---

## 📱 Step 2: Get Your WhatsApp Testing Number

Find your WhatsApp bot number from the 11za dashboard. You'll send messages to this number.

**WhatsApp Bot Number:** `+1234567890` (replace with your actual number from 11za)

---

## 🎮 Step 3: Complete Demo Guide

### **DEMO 1: Onboarding & Setup** (First time user)

**Message 1: Start conversation**
```
Hey! Hello!
```

**Bot Response:**
```
👋 Welcome to LifeOS!

I'm your AI assistant for managing your personal & professional life.

What's your name?
```

**Message 2: Send your name**
```
John
```

**Bot Response:**
```
Nice to meet you, John! 

What time do you usually wake up? (Format: 9 AM or 09:00)
```

**Message 3: Wake-up time**
```
6 AM
```

**Bot Response:**
```
✅ Wake-up time set to 6:00 AM

What time do you sleep? (Format: 11 PM or 23:00)
```

**Message 4: Sleep time**
```
11 PM
```

**Bot Response:**
```
✅ Sleep time set to 11:00 PM

What activities do you do daily? (e.g., exercise, meditation, work, etc.)
```

**Message 5: Daily activities**
```
exercise, meditation, work, coding
```

**Bot Response:**
```
✅ Daily activities saved: exercise, meditation, work, coding

Onboarding complete! 🎉
You can now:
• Set reminders
• Create routines
• Track activities
• Manage clients & meetings
• And much more!

Let's get started. What can I help you with?
```

---

### **DEMO 2: Create Reminders** ⏰

**Message 1: Simple reminder**
```
remind me to call mom at 2 PM
```

**Bot Response:**
```
✅ Reminder created!
⏰ Call mom
🕐 Today at 2:00 PM
🔔 One-time reminder
```

**Message 2: Daily reminder**
```
remind me to exercise every day at 6:30 AM
```

**Bot Response:**
```
✅ Daily reminder created!
⏰ Exercise
🕐 Every day at 6:30 AM
🔔 Repeating (Daily)
```

**Message 3: Weekly reminder**
```
remind me to attend meeting on Monday at 10 AM
```

**Bot Response:**
```
✅ Weekly reminder created!
⏰ Attend meeting
🕐 Every Monday at 10:00 AM
🔔 Repeating (Weekly)
```

**Message 4: List reminders**
```
show my reminders
```

**Bot Response:**
```
📋 Your Active Reminders:

1. ⏰ Call mom
   🕐 Today at 2:00 PM
   Priority: Medium

2. ⏰ Exercise
   🕐 Every day at 6:30 AM
   Priority: Medium

3. ⏰ Attend meeting
   🕐 Every Monday at 10:00 AM
   Priority: Medium
```

**Message 5: Update reminder**
```
change call mom reminder to 3 PM
```

**Bot Response:**
```
✅ Reminder updated!
⏰ Call mom
🕐 Today at 3:00 PM (changed from 2:00 PM)
```

**Message 6: Delete reminder**
```
delete the exercise reminder
```

**Bot Response:**
```
✅ Reminder deleted!
⏰ Exercise (Every day at 6:30 AM) - REMOVED
```

---

### **DEMO 3: Log Activities** 📊

**Message 1: Log completed activity**
```
log activity - completed 30 minutes yoga
```

**Bot Response:**
```
✅ Activity logged!
✓ Completed
📍 Yoga
⏱️ Duration: 30 minutes
📅 Today at 10:45 AM
```

**Message 2: Log skipped activity**
```
skipped meditation today
```

**Bot Response:**
```
✅ Activity logged!
✗ Skipped
📍 Meditation
📅 Today at 11:00 AM
```

**Message 3: View activity history**
```
show my activity history
```

**Bot Response:**
```
📊 Your Activity History (Last 7 days):

✓ Yoga - 30 min - Completed
✗ Meditation - Skipped
✓ Work - 4 hrs - Completed
✓ Exercise - 45 min - Completed
─────────────────────────────
Summary:
📈 Completed: 3
📉 Skipped: 1
⏭️ Total: 4 activities
✅ Success Rate: 75%
```

---

### **DEMO 4: Manage Routines** 🔄

**Message 1: Create morning routine**
```
create morning routine - 6 AM exercise, 6:30 AM shower, 7 AM breakfast
```

**Bot Response:**
```
✅ Morning routine created!

🌅 Morning Routine:
├─ 6:00 AM - Exercise
├─ 6:30 AM - Shower
└─ 7:00 AM - Breakfast

Status: Active ✓
Repeat: Daily
```

**Message 2: Create evening routine**
```
create evening routine - 8 PM dinner, 8:30 PM family time, 10 PM sleep
```

**Bot Response:**
```
✅ Evening routine created!

🌙 Evening Routine:
├─ 8:00 PM - Dinner
├─ 8:30 PM - Family time
└─ 10:00 PM - Sleep

Status: Active ✓
Repeat: Daily
```

**Message 3: View routines**
```
show my routines
```

**Bot Response:**
```
📋 Your Routines:

🌅 Morning Routine (Active)
├─ 6:00 AM - Exercise
├─ 6:30 AM - Shower
└─ 7:00 AM - Breakfast

🌙 Evening Routine (Active)
├─ 8:00 PM - Dinner
├─ 8:30 PM - Family time
└─ 10:00 PM - Sleep

Next: Morning Routine starts at 6:00 AM tomorrow
```

---

### **DEMO 5: Business - Clients** 👥

**Message 1: Add client**
```
add client - Acme Corp, contact john@acme.com, phone 555-1234
```

**Bot Response:**
```
✅ Client added!
🏢 Acme Corp
📧 john@acme.com
📱 555-1234
💰 Status: Active
```

**Message 2: Multiple clients**
```
add client - TechStart Inc, contact sarah@techstart.com
add client - DesignHub, contact contact@designhub.io
```

**Bot Response:**
```
✅ 2 clients added!

1. 🏢 TechStart Inc
   📧 sarah@techstart.com
   
2. 🏢 DesignHub
   📧 contact@designhub.io
```

**Message 3: List clients**
```
show my clients
```

**Bot Response:**
```
👥 Your Clients (3):

1. 🏢 Acme Corp
   📧 john@acme.com
   📱 555-1234
   💰 Status: Active

2. 🏢 TechStart Inc
   📧 sarah@techstart.com
   💰 Status: Active

3. 🏢 DesignHub
   📧 contact@designhub.io
   💰 Status: Active
```

---

### **DEMO 6: Meetings** 📅

**Message 1: Schedule meeting**
```
schedule meeting with Acme Corp on Monday at 10 AM, topic: Project review
```

**Bot Response:**
```
✅ Meeting scheduled!
🏢 Client: Acme Corp
📅 Monday at 10:00 AM
📌 Topic: Project review
🔗 Participants: john@acme.com
```

**Message 2: More meetings**
```
schedule meeting with TechStart Inc tomorrow at 2 PM, video call
```

**Bot Response:**
```
✅ Meeting scheduled!
🏢 Client: TechStart Inc
📅 Tomorrow at 2:00 PM
📞 Type: Video call
🔗 Video link will be sent to sarah@techstart.com
```

**Message 3: View meetings**
```
show my meetings
```

**Bot Response:**
```
📅 Your Upcoming Meetings:

1. 🏢 Acme Corp - Project review
   📅 Monday at 10:00 AM
   🔗 In-person | 📍 Venue TBD

2. 🏢 TechStart Inc
   📅 Tomorrow at 2:00 PM
   📞 Video call
   🔗 Video link sent

3. 🏢 DesignHub - Design consultation
   📅 Next Friday at 3:00 PM
   🔗 In-person | 📍 Their office
```

---

### **DEMO 7: Invoices** 💰

**Message 1: Create invoice**
```
create invoice for Acme Corp - 5000 for project work, due date 15 April
```

**Bot Response:**
```
✅ Invoice created!
📄 Invoice #INV-001
🏢 Client: Acme Corp
💰 Amount: ₹5,000
📌 Description: Project work
📅 Due: 15 April 2026
🔔 Status: Unpaid
```

**Message 2: Add more invoices**
```
invoice TechStart Inc - 3500 for design, due 10 April
```

**Bot Response:**
```
✅ Invoice created!
📄 Invoice #INV-002
🏢 Client: TechStart Inc
💰 Amount: ₹3,500
📌 Description: Design
📅 Due: 10 April 2026
🔔 Status: Unpaid
```

**Message 3: List invoices**
```
show my invoices
```

**Bot Response:**
```
💼 Your Invoices:

1. 📄 INV-001 - Acme Corp
   💰 ₹5,000
   📌 Project work
   📅 Due: 15 April
   🔔 Status: Unpaid

2. 📄 INV-002 - TechStart Inc
   💰 ₹3,500
   📌 Design
   📅 Due: 10 April
   🔔 Status: Unpaid

💵 Total Pending: ₹8,500
```

**Message 4: Mark invoice paid**
```
mark invoice 1 as paid
```

**Bot Response:**
```
✅ Invoice marked paid!
📄 INV-001 - Acme Corp
💰 ₹5,000 - PAID ✓
📅 Paid on: 28 March 2026
```

---

### **DEMO 8: Sales Leads** 🎯

**Message 1: Create lead**
```
create lead - Contact: Ram from BigCorp, Budget: 50000, Timeline: 2 weeks
```

**Bot Response:**
```
✅ Lead created!
👤 Lead ID: LEAD-001
📝 Contact: Ram from BigCorp
💵 Budget: ₹50,000
⏰ Timeline: 2 weeks
🔔 Status: New
```

**Message 2: Update lead status**
```
update lead 1 - status qualified, next followup tomorrow
```

**Bot Response:**
```
✅ Lead updated!
👤 Lead ID: LEAD-001
🔔 Status: Qualified (upgraded from New)
📅 Follow-up: Tomorrow
```

**Message 3: View leads**
```
show my leads
```

**Bot Response:**
```
🎯 Your Sales Leads (By Stage):

📊 New (1):
  • LEAD-001: Ram from BigCorp
    💵 Budget: ₹50,000
    📅 Follow-up: Tomorrow

💼 Qualified (0):

🤝 Negotiating (0):

✅ Converted (0):

Total Leads: 1 | Conversion Rate: 0%
```

---

### **DEMO 9: Projects** 📦

**Message 1: Create project**
```
create project - Website Redesign, budget 100000, deadline 30 May
```

**Bot Response:**
```
✅ Project created!
📦 Project ID: PRJ-001
📌 Website Redesign
💰 Budget: ₹100,000
📅 Deadline: 30 May 2026
🔔 Status: Active
```

**Message 2: View projects**
```
show my projects
```

**Bot Response:**
```
📋 Your Projects:

1. 📦 PRJ-001 - Website Redesign
   💰 Budget: ₹100,000
   ⏱️ Timeline: 2 months
   📅 Deadline: 30 May
   🔔 Status: Active
   🔗 Assigned to: You

Overview: 1 active project | Total budget: ₹100,000
```

---

### **DEMO 10: Multi-Language Support** 🌐

**Message 1: Hindi message**
```
मुझे कल 3 बजे याद दिलाओ कि जिम जाऊं
```

**Bot Response:**
```
✅ Reminder created! (Detected: Hindi)
⏰ जिम जाना
🕐 कल दोपहर 3:00 बजे
🔔 एक बार की reminder
```

**Message 2: Hinglish**
```
kal 9 PM pe naha lena reminder de
```

**Bot Response:**
```
✅ Reminder created! (Detected: Hinglish)
⏰ नहा लेना
🕐 कल रात 9:00 बजे
🔔 एक बार की reminder
```

---

## 🔔 Demo 11: Automatic Reminder Delivery

When reminder time arrives, bot automatically sends:

```
⏰ Call mom
📅 28-Mar-2026 at 2:00 PM
✅ Reminder sent automatically
```

**Just wait!** Don't need to do anything - reminders auto-deliver at scheduled time.

---

## 💡 Demo 12: Quick Conversations

**Message 1:**
```
what's my status?
```

**Bot Response:**
```
📊 Your Daily Status:

🌅 Wake-up: 6:00 AM
🌙 Sleep: 11:00 PM
⏰ Active Reminders: 2
💪 Today's Activities: 1 completed
📅 Upcoming Meetings: 1
💼 Active Projects: 1

Last Activity: Yoga - 30 min (Completed)
Next Reminder: Exercise at 6:30 AM tomorrow
```

**Message 2:**
```
summarize my week
```

**Bot Response:**
```
📈 Weekly Summary:

Activities:
✓ Completed: 8
✗ Skipped: 2
⏭️ Missed: 1
Success Rate: 80%

Meetings: 3 completed
Invoices: ₹8,500 pending
Leads: 1 lead in pipeline

Top Activity: Exercise (5 times)
Least Done: Meditation (1 time)
```

---

## 🎯 Feature Demo Checklist

- [ ] ✅ Onboarding completed
- [ ] ✅ Created 3+ reminders
- [ ] ✅ Logged activities
- [ ] ✅ Created routines
- [ ] ✅ Added clients
- [ ] ✅ Scheduled meetings
- [ ] ✅ Created invoices
- [ ] ✅ Added sales leads
- [ ] ✅ Created projects
- [ ] ✅ Tested multi-language
- [ ] ✅ Received auto-reminder at scheduled time
- [ ] ✅ Checked status/summary

---

## 🐛 Troubleshooting

### Bot doesn't respond:
```bash
# Check if server is running
curl http://localhost:3000/api/health

# Check logs - look for errors
npm run dev
```

### Reminders not arriving:
```bash
# The fix was applied! ✅ (see reminder bug fix)
# Reminders now trigger at EXACT time, not early
```

### WhatsApp message not received:
- Make sure `.env` credentials are correct
- Check 11za webhook is pointing to: `http://localhost:3000/api/webhook/whatsapp` (for local) or your Vercel URL
- Test webhook: `curl http://localhost:3000/api/webhook/ping`

### AI responses weird:
- Check `GROQ_API_KEY` is valid in `.env`
- Check message language is correct (English, Hindi, or Hinglish)
- Long messages work best

---

## 🚀 Deploy to Production

When ready to go LIVE on WhatsApp publicly:

```bash
# 1. Deploy to Vercel
npm install -g vercel
vercel --prod

# 2. Update 11za webhook URL to your Vercel domain
# 3. Test bot on real WhatsApp
# 4. Share bot number with users!
```

Your Vercel URL will be: `https://your-project-name.vercel.app/`

---

## 📊 Live Data

After demos, you can view all data:

```bash
# View via API
curl http://localhost:3000/api/user/9876543210
curl http://localhost:3000/api/reminders/userid
curl http://localhost:3000/api/activity-history/userid
curl http://localhost:3000/api/routines/userid
```

Or use MongoDB Atlas Web Interface to browse collections directly!

---

**Enjoy your LifeOS demo!** 🎉

*For issues or questions, check the detailed service documentation in `src/services/`*
