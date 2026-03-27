import User from '../models/User.js';
import logger from '../utils/logger.js';

/**
 * Onboarding Service
 * Handles user onboarding flow - collects user info and preferences
 */
class OnboardingService {
  // Base onboarding questions (same for all)
  static baseQuestions = [
    {
      step: 0,
      question: 'नमस्ते! 👋 मैं आपकी LifeOS सहायक हूँ। आपका नाम क्या है?\n\n(Hey! I\'m your LifeOS assistant. What\'s your name?)',
      key: 'name',
      parse: (response) => response.trim()
    },
    {
      step: 1,
      question: 'बहुत बढ़िया! 😊 आपका ईमेल पता दे सकते हो?\n\n(Great! Can you share your email?)',
      key: 'email',
      parse: (response) => response.toLowerCase().trim()
    },
    {
      step: 2,
      question: 'एक आखिरी बात - क्या तुम कोई व्यवसाय चलाते हो या कोई उद्यमी हो? (हाँ/नहीं)\n\n(One last thing - do you run a business or are an entrepreneur? Yes/No)',
      key: 'userType',
      parse: (response) => {
        const ans = response.toLowerCase().trim();
        return (ans.includes('yes') || ans.includes('हा') || ans.includes('हाँ') || ans.includes('जी')) ? 'business' : 'personal';
      }
    }
  ];

  // Personal user questions (steps 3+)
  static personalQuestions = [
    {
      step: 3,
      question: 'शानदार! तो मुझे तुम्हारे बारे में जानकारी दे। आपकी दैनिक गतिविधियाँ क्या हैं? (जैसे: जिम, ध्यान, काम, पढ़ना)\n\n(Awesome! So I can help you better. What are your daily activities? (e.g., gym, meditation, work, reading)',
      key: 'dailyActivities',
      parse: (response) => response.split(',').map(item => item.trim()).filter(item => item)
    },
    {
      step: 4,
      question: 'बहुत अच्छा! 🎯 और मज़े के समय में क्या करते हो? आपके शौक क्या हैं?\n\n(Nice! And what do you enjoy doing in your free time? What are your hobbies?)',
      key: 'hobbies',
      parse: (response) => response.split(',').map(item => item.trim()).filter(item => item)
    },
    {
      step: 5,
      question: 'समझ गया! 💼 अब तुम्हारे काम के समय के बारे में बताओ। सुबह कितने बजे काम शुरू करते हो? (HH:MM, जैसे: 09:00)\n\n(Got it! Now about your work. What time do you start? (HH:MM, e.g., 09:00)',
      key: 'workStartTime',
      parse: (response) => response.trim()
    },
    {
      step: 6,
      question: 'और कितने बजे खत्म करते हो? (HH:MM, जैसे: 18:00)\n\n(And what time do you finish? (HH:MM, e.g., 18:00)',
      key: 'workEndTime',
      parse: (response) => response.trim()
    },
    {
      step: 7,
      question: 'अब अंतिम सवाल - क्या मैं तुम्हें समय-समय पर रिमाइंडर दे सकता हूँ? (हाँ/नहीं)\n\n(Last question - can I send you reminders sometimes? Yes/No)',
      key: 'enableReminders',
      parse: (response) => {
        const ans = response.toLowerCase().trim();
        return ans.includes('yes') || ans.includes('हा') || ans.includes('हाँ') || ans.includes('जी');
      }
    },
    {
      step: 8,
      question: 'शानदार! 🎉 किस समय सुबह मैं तुम्हें रिमाइंडर भेजूँ? (HH:MM, जैसे: 08:00)\n\n(Awesome! What time in morning should I remind you? (HH:MM, e.g., 08:00)',
      key: 'reminderTime',
      parse: (response) => response.trim()
    }
  ];

  // Business user questions (steps 3+)
  static businessQuestions = [
    {
      step: 3,
      question: 'वाह, एक entrepreneur! 🚀 मुझे तुम्हारे business के बारे में बताओ। आपकी कंपनी का नाम क्या है?\n\n(Wow, an entrepreneur! 🚀 Tell me about your business. What\'s your company name?)',
      key: 'businessName',
      parse: (response) => response.trim()
    },
    {
      step: 4,
      question: 'बहुत बढ़िया! तो आपका व्यवसाय किस चीज़ का है? (जैसे: consulting, e-commerce, services)\n\n(Nice! What kind of business? (e.g., consulting, e-commerce, services)',
      key: 'businessType',
      parse: (response) => response.trim()
    },
    {
      step: 5,
      question: 'समझ गया! एक छोटा सा विवरण दे सकते हो - तुम क्या करते हो? (1-2 लाइन में)\n\n(Got it! Can you briefly tell what you do? (in 1-2 lines)',
      key: 'businessDescription',
      parse: (response) => response.trim()
    },
    {
      step: 6,
      question: 'अच्छा! 📧 आपके business का ईमेल पता क्या है?\n\n(Alright! What\'s your business email?)',
      key: 'businessEmail',
      parse: (response) => response.toLowerCase().trim()
    },
    {
      step: 7,
      question: 'और आपका business कब खोलता है? (शुरू का समय HH:MM में, जैसे: 09:00)\n\n(And what time does your business open? (Start time HH:MM, e.g., 09:00)',
      key: 'businessStartTime',
      parse: (response) => response.trim()
    },
    {
      step: 8,
      question: 'कितने बजे बंद करते हो? (HH:MM में, जैसे: 18:00)\n\n(What time do you close? (HH:MM, e.g., 18:00)',
      key: 'businessEndTime',
      parse: (response) => response.trim()
    },
    {
      step: 9,
      question: 'अच्छा! 🎯 आप कौन सी services/products देते हो? (अल्पविराम से अलग करें)\n\n(Alright! What services/products do you offer? (comma separated)',
      key: 'services',
      parse: (response) => response.split(',').map(item => item.trim()).filter(item => item)
    },
    {
      step: 10,
      question: 'और आपकी टीम में कितने लोग हैं? 👥\n\n(And how many people in your team?)',
      key: 'numberOfEmployees',
      parse: (response) => parseInt(response.trim()) || 0
    },
    {
      step: 11,
      question: 'बहुत अच्छा! 💰 आपका महीने का revenue target क्या है?\n\n(Great! What\'s your monthly revenue target?)',
      key: 'monthlyTarget',
      parse: (response) => parseInt(response.trim().replace(/[^0-9]/g, '')) || 0
    },
    {
      step: 12,
      question: 'अंतिम सवाल! 🎉 क्या मैं तुम्हें clients, invoices, meetings, और leads track करने में मदद कर सकता हूँ? (हाँ/नहीं)\n\n(Final question! Can I help you track clients, invoices, meetings, and leads? Yes/No)',
      key: 'enableBusinessFeatures',
      parse: (response) => {
        const ans = response.toLowerCase().trim();
        return ans.includes('yes') || ans.includes('हा') || ans.includes('हाँ') || ans.includes('जी');
      }
    }
  ];

  // Get all questions for a user type
  static getQuestionsForUserType(userType) {
    if (userType === 'business') {
      return [...this.baseQuestions, ...this.businessQuestions];
    } else {
      return [...this.baseQuestions, ...this.personalQuestions];
    }
  }
      parse: (response) => response.toLowerCase().trim()
    },
    {
      step: 2,
      question: 'आपकी दैनिक गतिविधियाँ क्या हैं? (कृपया अल्पविराम से अलग करें: जैम, ध्यान, काम, आदि)\n\n(What are your daily activities? Please separate with commas: gym, meditation, work, etc.)',
      key: 'dailyActivities',
      parse: (response) => response.split(',').map(item => item.trim()).filter(item => item)
    },
    {
      step: 3,
      question: 'आपके शौक क्या हैं? (कृपया अल्पविराम से अलग करें: पढ़ना, कोडिंग, खेल, आदि)\n\n(What are your hobbies? Please separate with commas: reading, coding, sports, etc.)',
      key: 'hobbies',
      parse: (response) => response.split(',').map(item => item.trim()).filter(item => item)
    },
    {
      step: 4,
      question: 'आपका कार्य समय क्या है? (शुरुआत समय HH:MM प्रारूप में, उदाहरण: 09:00)\n\n(What is your work start time? In HH:MM format, e.g., 09:00)',
      key: 'workStartTime',
      parse: (response) => response.trim()
    },
    {
      step: 5,
      question: 'आपका कार्य समाप्ति समय क्या है? (HH:MM प्रारूप में, उदाहरण: 18:00)\n\n(What is your work end time? In HH:MM format, e.g., 18:00)',
      key: 'workEndTime',
      parse: (response) => response.trim()
    },
    {
      step: 6,
      question: 'क्या आप रिमाइंडर प्राप्त करना चाहते हैं? (हाँ/नहीं)\n\n(Do you want to receive reminders? Yes/No)',
      key: 'enableReminders',
      parse: (response) => {
        const ans = response.toLowerCase().trim();
        return ans.includes('yes') || ans.includes('हा') || ans.includes('हाँ') || ans.includes('yes');
      }
    },
    {
      step: 7,
      question: 'आप किस समय रिमाइंडर पाना पसंद करेंगे? (HH:MM प्रारूप में, उदाहरण: 08:00)\n\n(What time would you prefer reminders? In HH:MM format, e.g., 08:00)',
      key: 'reminderTime',
      parse: (response) => response.trim()
    }
  ];

  /**
   * Get current onboarding question for a user
   */
  static getQuestion(userId, step, userType = 'personal') {
    const questions = this.getQuestionsForUserType(userType);
    const questionObj = questions.find(q => q.step === step);
    return questionObj ? questionObj.question : null;
  }

  /**
   * Get question object by step
   */
  static getQuestionObj(step, userType = 'personal') {
    const questions = this.getQuestionsForUserType(userType);
    return questions.find(q => q.step === step);
  }

  /**
   * Get onboarding state for user
   */
  static async getOnboardingState(userId) {
    try {
      const user = await User.findById(userId);
      const questions = this.getQuestionsForUserType(user.userType);
      
      return {
        completed: user.onboardingCompleted,
        step: user.onboardingStep,
        userType: user.userType,
        totalSteps: questions.length,
        profile: {
          name: user.name,
          email: user.email,
          userType: user.userType,
          dailyActivities: user.dailyActivities,
          hobbies: user.hobbies,
          workSchedule: user.workSchedule,
          reminderPreferences: user.reminderPreferences,
          businessProfile: user.businessProfile
        }
      };
    } catch (error) {
      logger.error('Failed to get onboarding state:', error.message);
      return null;
    }
  }

  /**
   * Process onboarding response
   */
  static async processResponse(userId, userResponse) {
    try {
      const user = await User.findById(userId);
      const questions = this.getQuestionsForUserType(user.userType);
      const currentStep = user.onboardingStep;

      if (currentStep >= questions.length) {
        return {
          completed: true,
          message: 'आपकी प्रोफाइल पूरी हो गई है! 🎉\n\n(Your profile is complete! 🎉)',
          nextQuestion: null
        };
      }

      const questionObj = questions[currentStep];
      const parsedValue = questionObj.parse(userResponse);

      // Save response based on key and user type
      if (user.userType === 'business') {
        this._processBusinessResponse(user, questionObj.key, parsedValue);
      } else {
        this._processPersonalResponse(user, questionObj.key, parsedValue);
      }

      // Move to next step
      user.onboardingStep = currentStep + 1;

      // Mark as completed if all steps done
      if (user.onboardingStep >= questions.length) {
        user.onboardingCompleted = true;
        user.onboardingStep = questions.length; // Cap at max
        logger.info('Onboarding completed for user:', { userId, userType: user.userType });
      }

      await user.save();

      // Get next question or completion message
      let nextQuestion = null;
      if (user.onboardingStep < questions.length) {
        nextQuestion = this.getQuestion(userId, user.onboardingStep, user.userType);
      }

      return {
        completed: user.onboardingCompleted,
        step: user.onboardingStep,
        userType: user.userType,
        message: 'धन्यवाद! 👍\n\n(Thank you! 👍)',
        nextQuestion
      };
    } catch (error) {
      logger.error('Failed to process onboarding response:', error.message);
      return {
        completed: false,
        error: error.message
      };
    }
  }

  /**
   * Process personal user responses
   */
  static _processPersonalResponse(user, key, value) {
    switch (key) {
      case 'name':
        user.name = value;
        break;
      case 'email':
        user.email = value;
        break;
      case 'userType':
        user.userType = value;
        break;
      case 'dailyActivities':
        user.dailyActivities = value;
        break;
      case 'hobbies':
        user.hobbies = value;
        break;
      case 'workStartTime':
        user.workSchedule.startTime = value;
        break;
      case 'workEndTime':
        user.workSchedule.endTime = value;
        break;
      case 'enableReminders':
        user.reminderPreferences.enableReminders = value;
        break;
      case 'reminderTime':
        user.reminderPreferences.reminderTime = value;
        break;
    }
  }

  /**
   * Process business user responses
   */
  static _processBusinessResponse(user, key, value) {
    switch (key) {
      case 'name':
        user.name = value;
        break;
      case 'email':
        user.email = value;
        break;
      case 'userType':
        user.userType = value;
        break;
      case 'businessName':
        user.businessProfile.businessName = value;
        break;
      case 'businessType':
        user.businessProfile.businessType = value;
        break;
      case 'businessDescription':
        user.businessProfile.businessDescription = value;
        break;
      case 'businessEmail':
        user.businessProfile.businessEmail = value;
        break;
      case 'businessStartTime':
        user.businessProfile.businessHours.startTime = value;
        break;
      case 'businessEndTime':
        user.businessProfile.businessHours.endTime = value;
        break;
      case 'services':
        user.businessProfile.services = value;
        break;
      case 'numberOfEmployees':
        user.businessProfile.numberOfEmployees = value;
        break;
      case 'monthlyTarget':
        user.businessProfile.monthlyTarget = value;
        break;
      case 'enableBusinessFeatures':
        user.businessProfile.enableClientTracking = value;
        user.businessProfile.enableInvoiceTracking = value;
        user.businessProfile.enableMeetingScheduling = value;
        user.businessProfile.enableLeadTracking = value;
        break;
    }
  }

  /**
   * Start onboarding for new user (get first question)
   */
  static getFirstQuestion() {
    return this.baseQuestions[0].question;
  }

  /**
   * Get onboarding progress
   */
  static async getProgress(userId) {
    const state = await this.getOnboardingState(userId);
    if (!state) return null;

    const total = state.totalSteps;
    const progress = Math.round((state.step / total) * 100);

    return {
      completed: state.completed,
      step: state.step,
      totalSteps: total,
      userType: state.userType,
      progress: `${progress}%`,
      profile: state.profile
    };
  }
}

export default OnboardingService;
