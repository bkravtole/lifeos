import User from '../models/User.js';
import logger from '../utils/logger.js';

/**
 * Onboarding Service
 * Handles user onboarding flow - collects user info and preferences
 * Language-aware: supports English, Hindi, and Hinglish
 */
class OnboardingService {
  // ==================== ENGLISH QUESTIONS ====================
  static englishQuestions = {
    base: [
      {
        step: 0,
        question: '👋 Hey! I\'m your LifeOS assistant. What\'s your name?',
        key: 'name',
        parse: (response) => response.trim()
      },
      {
        step: 1,
        question: '😊 Great! Can you share your email?',
        key: 'email',
        parse: (response) => response.toLowerCase().trim()
      },
      {
        step: 2,
        question: 'Do you run a business or are an entrepreneur? (Yes/No)',
        key: 'userType',
        parse: (response) => {
          const ans = response.toLowerCase().trim();
          return (ans.includes('yes') || ans.includes('y')) ? 'business' : 'personal';
        }
      }
    ],
    personal: [
      {
        step: 3,
        question: 'What are your daily activities? (e.g., gym, meditation, work, reading)',
        key: 'dailyActivities',
        parse: (response) => response.split(',').map(item => item.trim()).filter(item => item)
      },
      {
        step: 4,
        question: '🎯 What are your hobbies?',
        key: 'hobbies',
        parse: (response) => response.split(',').map(item => item.trim()).filter(item => item)
      },
      {
        step: 5,
        question: 'What time do you start work? (HH:MM, e.g., 09:00)',
        key: 'workStartTime',
        parse: (response) => response.trim()
      },
      {
        step: 6,
        question: 'What time do you finish? (HH:MM, e.g., 18:00)',
        key: 'workEndTime',
        parse: (response) => response.trim()
      },
      {
        step: 7,
        question: 'Can I send you reminders? (Yes/No)',
        key: 'enableReminders',
        parse: (response) => {
          const ans = response.toLowerCase().trim();
          return ans.includes('yes') || ans.includes('y');
        }
      },
      {
        step: 8,
        question: 'What time should I remind you? (HH:MM, e.g., 08:00)',
        key: 'reminderTime',
        parse: (response) => response.trim()
      }
    ],
    business: [
      {
        step: 3,
        question: '🚀 What\'s your company name?',
        key: 'businessName',
        parse: (response) => response.trim()
      },
      {
        step: 4,
        question: 'What kind of business? (e.g., consulting, e-commerce, services)',
        key: 'businessType',
        parse: (response) => response.trim()
      },
      {
        step: 5,
        question: 'Tell me briefly what you do? (1-2 lines)',
        key: 'businessDescription',
        parse: (response) => response.trim()
      },
      {
        step: 6,
        question: '📧 What\'s your business email?',
        key: 'businessEmail',
        parse: (response) => response.toLowerCase().trim()
      },
      {
        step: 7,
        question: 'What time does your business open? (HH:MM, e.g., 09:00)',
        key: 'businessStartTime',
        parse: (response) => response.trim()
      },
      {
        step: 8,
        question: 'What time do you close? (HH:MM, e.g., 18:00)',
        key: 'businessEndTime',
        parse: (response) => response.trim()
      },
      {
        step: 9,
        question: '🎯 What services/products do you offer? (comma separated)',
        key: 'services',
        parse: (response) => response.split(',').map(item => item.trim()).filter(item => item)
      },
      {
        step: 10,
        question: 'How many people in your team? 👥',
        key: 'numberOfEmployees',
        parse: (response) => parseInt(response.trim()) || 0
      },
      {
        step: 11,
        question: '💰 What\'s your monthly revenue target?',
        key: 'monthlyTarget',
        parse: (response) => parseInt(response.trim().replace(/[^0-9]/g, '')) || 0
      },
      {
        step: 12,
        question: '🎉 Can I help you track clients, invoices, meetings, and leads? (Yes/No)',
        key: 'enableBusinessFeatures',
        parse: (response) => {
          const ans = response.toLowerCase().trim();
          return ans.includes('yes') || ans.includes('y');
        }
      }
    ]
  };

  // ==================== HINDI QUESTIONS ====================
  static hindiQuestions = {
    base: [
      {
        step: 0,
        question: '👋 नमस्ते! मैं आपकी LifeOS सहायक हूँ। आपका नाम क्या है?',
        key: 'name',
        parse: (response) => response.trim()
      },
      {
        step: 1,
        question: '😊 बहुत अच्छा! आपका ईमेल पता क्या है?',
        key: 'email',
        parse: (response) => response.toLowerCase().trim()
      },
      {
        step: 2,
        question: 'क्या आप कोई व्यवसाय चलाते हैं या entrepreneur हैं? (हाँ/नहीं)',
        key: 'userType',
        parse: (response) => {
          const ans = response.toLowerCase().trim();
          return (ans.includes('yes') || ans.includes('हा') || ans.includes('हाँ') || ans.includes('जी')) ? 'business' : 'personal';
        }
      }
    ],
    personal: [
      {
        step: 3,
        question: 'आपकी दैनिक गतिविधियाँ क्या हैं? (जैसे: जिम, ध्यान, काम, पढ़ना)',
        key: 'dailyActivities',
        parse: (response) => response.split(',').map(item => item.trim()).filter(item => item)
      },
      {
        step: 4,
        question: '🎯 आपके शौक क्या हैं?',
        key: 'hobbies',
        parse: (response) => response.split(',').map(item => item.trim()).filter(item => item)
      },
      {
        step: 5,
        question: 'सुबह कितने बजे काम शुरू करते हो? (HH:MM, जैसे: 09:00)',
        key: 'workStartTime',
        parse: (response) => response.trim()
      },
      {
        step: 6,
        question: 'और कितने बजे खत्म करते हो? (HH:MM, जैसे: 18:00)',
        key: 'workEndTime',
        parse: (response) => response.trim()
      },
      {
        step: 7,
        question: 'क्या मैं तुम्हें रिमाइंडर दे सकता हूँ? (हाँ/नहीं)',
        key: 'enableReminders',
        parse: (response) => {
          const ans = response.toLowerCase().trim();
          return ans.includes('yes') || ans.includes('हा') || ans.includes('हाँ') || ans.includes('जी');
        }
      },
      {
        step: 8,
        question: '🎉 किस समय सुबह मैं तुम्हें याद दिलाऊँ? (HH:MM, जैसे: 08:00)',
        key: 'reminderTime',
        parse: (response) => response.trim()
      }
    ],
    business: [
      {
        step: 3,
        question: '🚀 आपकी कंपनी का नाम क्या है?',
        key: 'businessName',
        parse: (response) => response.trim()
      },
      {
        step: 4,
        question: 'आपका व्यवसाय किस प्रकार का है? (जैसे: consulting, e-commerce, सेवा)',
        key: 'businessType',
        parse: (response) => response.trim()
      },
      {
        step: 5,
        question: 'संक्षिप्त विवरण दें कि आप क्या करते हैं? (1-2 लाइन)',
        key: 'businessDescription',
        parse: (response) => response.trim()
      },
      {
        step: 6,
        question: '📧 आपके व्यवसाय का ईमेल पता क्या है?',
        key: 'businessEmail',
        parse: (response) => response.toLowerCase().trim()
      },
      {
        step: 7,
        question: 'आपका व्यवसाय कब खुलता है? (समय HH:MM में, जैसे: 09:00)',
        key: 'businessStartTime',
        parse: (response) => response.trim()
      },
      {
        step: 8,
        question: 'कितने बजे बंद करते हो? (HH:MM, जैसे: 18:00)',
        key: 'businessEndTime',
        parse: (response) => response.trim()
      },
      {
        step: 9,
        question: '🎯 आप कौन सी सेवाएं/उत्पाद प्रदान करते हैं? (अल्पविराम से अलग करें)',
        key: 'services',
        parse: (response) => response.split(',').map(item => item.trim()).filter(item => item)
      },
      {
        step: 10,
        question: 'आपकी टीम में कितने लोग हैं? 👥',
        key: 'numberOfEmployees',
        parse: (response) => parseInt(response.trim()) || 0
      },
      {
        step: 11,
        question: '💰 आपका महीने का राजस्व लक्ष्य क्या है?',
        key: 'monthlyTarget',
        parse: (response) => parseInt(response.trim().replace(/[^0-9]/g, '')) || 0
      },
      {
        step: 12,
        question: '🎉 क्या मैं आपको clients, invoices, meetings, और leads track करने में मदद कर सकता हूँ? (हाँ/नहीं)',
        key: 'enableBusinessFeatures',
        parse: (response) => {
          const ans = response.toLowerCase().trim();
          return ans.includes('yes') || ans.includes('हा') || ans.includes('हाँ') || ans.includes('जी');
        }
      }
    ]
  };

  // ==================== HINGLISH QUESTIONS ====================
  static hinglishQuestions = {
    base: [
      {
        step: 0,
        question: '👋 Hey! Mera naam LifeOS AI assistant hai. Aapka naam kya hai?',
        key: 'name',
        parse: (response) => response.trim()
      },
      {
        step: 1,
        question: '😊 Shukriya! Aapka email de sakte ho?',
        key: 'email',
        parse: (response) => response.toLowerCase().trim()
      },
      {
        step: 2,
        question: 'Kya aap koi business chalate ho ya entrepreneur ho? (Yes/No)',
        key: 'userType',
        parse: (response) => {
          const ans = response.toLowerCase().trim();
          return (ans.includes('yes') || ans.includes('y') || ans.includes('haa') || ans.includes('हा')) ? 'business' : 'personal';
        }
      }
    ],
    personal: [
      {
        step: 3,
        question: 'Aapki daily activities kya hain? (jaise gym, meditation, work)',
        key: 'dailyActivities',
        parse: (response) => response.split(',').map(item => item.trim()).filter(item => item)
      },
      {
        step: 4,
        question: '🎯 Aapke hobbies kya hain?',
        key: 'hobbies',
        parse: (response) => response.split(',').map(item => item.trim()).filter(item => item)
      },
      {
        step: 5,
        question: 'Subah kab kaam shuru karte ho? (HH:MM, jaise 09:00)',
        key: 'workStartTime',
        parse: (response) => response.trim()
      },
      {
        step: 6,
        question: 'Aur kab khatam karte ho? (HH:MM, jaise 18:00)',
        key: 'workEndTime',
        parse: (response) => response.trim()
      },
      {
        step: 7,
        question: 'Kya main aapko reminders de sakta hoon? (Yes/No)',
        key: 'enableReminders',
        parse: (response) => {
          const ans = response.toLowerCase().trim();
          return ans.includes('yes') || ans.includes('y') || ans.includes('haa');
        }
      },
      {
        step: 8,
        question: '🎉 Kis time subah main aapko yaad dilaunga? (HH:MM, jaise 08:00)',
        key: 'reminderTime',
        parse: (response) => response.trim()
      }
    ],
    business: [
      {
        step: 3,
        question: '🚀 Aapki company ka naam kya hai?',
        key: 'businessName',
        parse: (response) => response.trim()
      },
      {
        step: 4,
        question: 'Aapka business kis tarah ka hai? (jaise consulting, e-commerce)',
        key: 'businessType',
        parse: (response) => response.trim()
      },
      {
        step: 5,
        question: 'Batao briefly aap kya karte ho? (1-2 lines)',
        key: 'businessDescription',
        parse: (response) => response.trim()
      },
      {
        step: 6,
        question: '📧 Aapke business ka email kya hai?',
        key: 'businessEmail',
        parse: (response) => response.toLowerCase().trim()
      },
      {
        step: 7,
        question: 'Aapka business kab kholte ho? (time HH:MM mein, jaise 09:00)',
        key: 'businessStartTime',
        parse: (response) => response.trim()
      },
      {
        step: 8,
        question: 'Kab band karte ho? (HH:MM, jaise 18:00)',
        key: 'businessEndTime',
        parse: (response) => response.trim()
      },
      {
        step: 9,
        question: '🎯 Aap kaun si services/products dete ho? (comma se alag karo)',
        key: 'services',
        parse: (response) => response.split(',').map(item => item.trim()).filter(item => item)
      },
      {
        step: 10,
        question: 'Aapki team mein kitne log hain? 👥',
        key: 'numberOfEmployees',
        parse: (response) => parseInt(response.trim()) || 0
      },
      {
        step: 11,
        question: '💰 Aapka monthly revenue target kya hai?',
        key: 'monthlyTarget',
        parse: (response) => parseInt(response.trim().replace(/[^0-9]/g, '')) || 0
      },
      {
        step: 12,
        question: '🎉 Kya main aapko clients, invoices, meetings aur leads track karne mein madad kar sakta hoon? (Yes/No)',
        key: 'enableBusinessFeatures',
        parse: (response) => {
          const ans = response.toLowerCase().trim();
          return ans.includes('yes') || ans.includes('y') || ans.includes('haa');
        }
      }
    ]
  };

  /**
   * Get questions for a specific language and user type
   */
  static getQuestionsForUserType(userType, language = 'english') {
    let questionSet = this.englishQuestions; // default to English
    
    if (language === 'hindi') {
      questionSet = this.hindiQuestions;
    } else if (language === 'hinglish') {
      questionSet = this.hinglishQuestions;
    }
    
    if (userType === 'business') {
      return [...questionSet.base, ...questionSet.business];
    } else {
      return [...questionSet.base, ...questionSet.personal];
    }
  }

  /**
   * Get first question for new user in specified language
   */
  static getFirstQuestion(language = 'english') {
    let questionSet = this.englishQuestions; // default
    
    if (language === 'hindi') {
      questionSet = this.hindiQuestions;
    } else if (language === 'hinglish') {
      questionSet = this.hinglishQuestions;
    }
    
    return questionSet.base[0].question;
  }

  /**
   * Get current onboarding question for a user
   */
  static getQuestion(step, userType = 'personal', language = 'english') {
    const questions = this.getQuestionsForUserType(userType, language);
    const questionObj = questions.find(q => q.step === step);
    return questionObj ? questionObj.question : null;
  }

  /**
   * Get question object by step
   */
  static getQuestionObj(step, userType = 'personal', language = 'english') {
    const questions = this.getQuestionsForUserType(userType, language);
    return questions.find(q => q.step === step);
  }

  /**
   * Get onboarding state for user
   */
  static async getOnboardingState(userId) {
    try {
      const user = await User.findById(userId);
      const questions = this.getQuestionsForUserType(user.userType, user.preferredLanguage);
      
      return {
        completed: user.onboardingCompleted,
        step: user.onboardingStep,
        userType: user.userType,
        language: user.preferredLanguage,
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
      const questions = this.getQuestionsForUserType(user.userType, user.preferredLanguage);
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
        nextQuestion = this.getQuestion(user.onboardingStep, user.userType, user.preferredLanguage);
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
   * @param {string} language - User's language preference (english/hindi/hinglish)
   */
  static getFirstQuestion(language = 'english') {
    let questionSet = this.englishQuestions;
    
    if (language === 'hindi') {
      questionSet = this.hindiQuestions;
    } else if (language === 'hinglish') {
      questionSet = this.hinglishQuestions;
    }
    
    // Safety check: ensure base questions exist
    if (!questionSet || !questionSet.base || !questionSet.base[0]) {
      logger.warn(`No first question found for language: ${language}, defaulting to English`);
      return this.englishQuestions.base[0].question;
    }
    
    return questionSet.base[0].question;
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
