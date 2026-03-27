import User from '../models/User.js';
import logger from '../utils/logger.js';

/**
 * Simplified Onboarding Service (HLD Aligned)
 * 
 * Flow (according to High Level Design):
 * 1. Name?
 * 2. Wake-up time?
 * 3. Sleep time?
 * 4. Daily activities?
 * 5. Reminder preference?
 */
class OnboardingService {
  // ==================== QUESTIONS ====================
  
  static getQuestions(language = 'english') {
    if (language === 'hindi') {
      return [
        {
          step: 0,
          question: '👋 नमस्ते! मैं आपकी LifeOS सहायक हूँ। आपका नाम क्या है?',
          key: 'name',
          parse: (response) => response.trim()
        },
        {
          step: 1,
          question: '🌅 आप सुबह कितने बजे उठते हो? (HH:MM, जैसे: 06:00)',
          key: 'wakeUpTime',
          parse: (response) => response.trim()
        },
        {
          step: 2,
          question: '🌙 रात को कितने बजे सोते हो? (HH:MM, जैसे: 22:00)',
          key: 'sleepTime',
          parse: (response) => response.trim()
        },
        {
          step: 3,
          question: '📋 आपकी दैनिक गतिविधियाँ क्या हैं? (जैसे: gym, meditation, work - कॉमा से अलग करें)',
          key: 'dailyActivities',
          parse: (response) => response.split(',').map(item => item.trim()).filter(item => item)
        },
        {
          step: 4,
          question: '🔊 क्या मैं आपको रिमाइंडर दे सकता हूँ? (Yes/No)',
          key: 'enableReminders',
          parse: (response) => {
            const ans = response.toLowerCase().trim();
            return ans.includes('yes') || ans.includes('y') || ans.includes('हा') || ans.includes('हाँ') || ans.includes('जी');
          }
        }
      ];
    } else if (language === 'hinglish') {
      return [
        {
          step: 0,
          question: '👋 Namaste! Main aapka LifeOS assistant hoon. Aapka naam kya hai?',
          key: 'name',
          parse: (response) => response.trim()
        },
        {
          step: 1,
          question: '🌅 Aap subah kab uthte ho? (HH:MM, jaise: 06:00)',
          key: 'wakeUpTime',
          parse: (response) => response.trim()
        },
        {
          step: 2,
          question: '🌙 Raat ko kab sote ho? (HH:MM, jaise: 22:00)',
          key: 'sleepTime',
          parse: (response) => response.trim()
        },
        {
          step: 3,
          question: '📋 Aapki daily activities kya hain? (jaise: gym, meditation, work - comma se alag karein)',
          key: 'dailyActivities',
          parse: (response) => response.split(',').map(item => item.trim()).filter(item => item)
        },
        {
          step: 4,
          question: '🔊 Kya main aapko reminders de sakta hoon? (Yes/No)',
          key: 'enableReminders',
          parse: (response) => {
            const ans = response.toLowerCase().trim();
            return ans.includes('yes') || ans.includes('y') || ans.includes('haa');
          }
        }
      ];
    } else {
      // English (default)
      return [
        {
          step: 0,
          question: '👋 Hey! I\'m your LifeOS assistant. What\'s your name?',
          key: 'name',
          parse: (response) => response.trim()
        },
        {
          step: 1,
          question: '🌅 What time do you wake up? (HH:MM, e.g., 06:00)',
          key: 'wakeUpTime',
          parse: (response) => response.trim()
        },
        {
          step: 2,
          question: '🌙 What time do you sleep? (HH:MM, e.g., 22:00)',
          key: 'sleepTime',
          parse: (response) => response.trim()
        },
        {
          step: 3,
          question: '📋 What are your daily activities? (e.g., gym, meditation, work - comma separated)',
          key: 'dailyActivities',
          parse: (response) => response.split(',').map(item => item.trim()).filter(item => item)
        },
        {
          step: 4,
          question: '🔊 Can I send you reminders? (Yes/No)',
          key: 'enableReminders',
          parse: (response) => {
            const ans = response.toLowerCase().trim();
            return ans.includes('yes') || ans.includes('y');
          }
        }
      ];
    }
  }

  /**
   * Get first question
   */
  static getFirstQuestion(language = 'english') {
    const questions = this.getQuestions(language);
    return questions[0].question;
  }

  /**
   * Get current question for user
   */
  static getQuestion(step, language = 'english') {
    const questions = this.getQuestions(language);
    const questionObj = questions.find(q => q.step === step);
    return questionObj ? questionObj.question : null;
  }

  /**
   * Get total steps for onboarding
   */
  static getTotalSteps() {
    return 5; // 5 questions total
  }

  /**
   * Process onboarding response
   */
  static async processResponse(userId, userResponse) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const currentStep = user.onboardingStep;
      const language = user.preferredLanguage;
      const questions = this.getQuestions(language);

      logger.info('📝 Processing onboarding response:', {
        userId,
        step: currentStep,
        totalSteps: questions.length
      });

      // Already completed
      if (user.onboardingCompleted) {
        logger.warn('Onboarding already complete');
        return {
          completed: true,
          message: 'Your profile is already complete!'
        };
      }

      // Current step exceeds total
      if (currentStep >= questions.length) {
        logger.error('Step exceeds total questions', { currentStep, total: questions.length });
        return {
          completed: true,
          message: 'Onboarding complete!'
        };
      }

      // Get current question object
      const questionObj = questions[currentStep];
      if (!questionObj) {
        throw new Error(`Question not found at step ${currentStep}`);
      }

      // Parse response
      const parsedValue = questionObj.parse(userResponse);

      // Update user based on key
      switch (questionObj.key) {
        case 'name':
          user.name = parsedValue;
          break;
        case 'wakeUpTime':
          user.wakeUpTime = parsedValue;
          break;
        case 'sleepTime':
          user.sleepTime = parsedValue;
          break;
        case 'dailyActivities':
          user.dailyActivities = parsedValue;
          break;
        case 'enableReminders':
          user.preferences.notificationsEnabled = parsedValue;
          break;
      }

      // Move to next step
      user.onboardingStep = currentStep + 1;

      // Check if onboarding is complete
      const isComplete = user.onboardingStep >= questions.length;
      if (isComplete) {
        user.onboardingCompleted = true;
        logger.info('✅ Onboarding completed for user:', { userId });
      }

      // Save to database
      await user.save();

      // Get next question or return completion
      let nextQuestion = null;
      if (!isComplete && user.onboardingStep < questions.length) {
        nextQuestion = this.getQuestion(user.onboardingStep, language);
      }

      return {
        completed: isComplete,
        step: user.onboardingStep,
        nextQuestion,
        userType: user.userType,
        message: isComplete ? '🎉 Profile setup complete!' : 'ठीक है! आगला सवाल आ रहा है...'
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
   * Get onboarding state
   */
  static async getOnboardingState(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return null;

      const language = user.preferredLanguage;
      const questions = this.getQuestions(language);

      return {
        completed: user.onboardingCompleted,
        step: user.onboardingStep,
        totalSteps: questions.length,
        profile: {
          name: user.name,
          wakeUpTime: user.wakeUpTime,
          sleepTime: user.sleepTime,
          dailyActivities: user.dailyActivities,
          enableReminders: user.preferences.notificationsEnabled
        }
      };
    } catch (error) {
      logger.error('Failed to get onboarding state:', error.message);
      return null;
    }
  }

  /**
   * Get progress
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
      percentage: progress
    };
  }
}

export default OnboardingService;
