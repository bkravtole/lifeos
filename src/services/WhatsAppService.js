import axios from 'axios';
import logger from '../utils/logger.js';

/**
 * WhatsApp Service
 * Handles communication with 11za WhatsApp API
 */
export class WhatsAppService {
  constructor() {
    this.baseURL = process.env.WHATSAPP_API_URL || 'https://internal.11za.in/apis';
    this.authToken = process.env.WHATSAPP_API_TOKEN || 'dummy_token_dev';
    this.originWebsite = process.env.ORIGIN_WEBSITE || 'https://localhost';
    this.webhookToken = process.env.WHATSAPP_WEBHOOK_TOKEN;

    if (!this.authToken) {
      logger.warn('⚠️ WhatsApp API credentials not fully configured - messages won\'t be sent');
    }
  }

  /**
   * Send text message to user
   * 11za Endpoint: {{APIUrl}}/sendMessage/sendMessages
   */
  async sendMessage(phoneNumber, message) {
    try {
      const payload = {
        sendto: phoneNumber,
        authToken: this.authToken,
        originWebsite: this.originWebsite,
        contentType: 'text',
        text: message
      };

      const response = await axios.post(
        `${this.baseURL}/sendMessage/sendMessages`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('Message sent successfully:', {
        to: phoneNumber,
        messageId: response.data?.id || response.data?.status
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to send message:', {
        error: error.message,
        to: phoneNumber
      });
      throw error;
    }
  }

  /**
   * Send interactive message (with buttons/list)
   * Using 11za flowbuilder format
   * 11za Endpoint: {{APIUrl}}/sendMessage/sendInteractiveMessage
   */
  async sendInteractiveMessage(phoneNumber, interactive, messageId) {
    try {
      const payload = {
        sendto: phoneNumber,
        id: messageId || this._generateId(),
        authToken: this.authToken,
        originWebsite: this.originWebsite,
        interactive
      };

      const response = await axios.post(
        `${this.baseURL}/sendMessage/sendInteractiveMessage`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('Interactive message sent:', {
        to: phoneNumber,
        messageId: response.data?.id || response.data?.status
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to send interactive message:', {
        error: error.message,
        to: phoneNumber
      });
      throw error;
    }
  }

  /**
   * Send buttons message (AskButton)
   */
  async sendButtonMessage(phoneNumber, bodyText, buttons, messageId) {
    const interactive = {
      subType: 'buttons',
      components: {
        body: {
          type: 'text',
          text: bodyText
        },
        buttons: buttons.map(btn => ({
          type: 'reply',
          reply: {
            payload: btn.payload,
            title: btn.title
          }
        }))
      }
    };

    return this.sendInteractiveMessage(phoneNumber, interactive, messageId);
  }

  /**
   * Send list message (AskList)
   */
  async sendListMessage(phoneNumber, bodyText, listSections, messageId, headerText, footerText) {
    const interactive = {
      subType: 'list',
      components: {
        body: {
          type: 'text',
          text: bodyText
        },
        list: {
          title: 'Select from list',
          sections: listSections
        }
      }
    };

    if (headerText) {
      interactive.components.header = {
        type: 'text',
        text: headerText
      };
    }

    if (footerText) {
      interactive.components.footer = {
        type: 'text',
        text: footerText
      };
    }

    return this.sendInteractiveMessage(phoneNumber, interactive, messageId);
  }

  /**
   * Generate unique message ID
   */
  _generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Verify webhook signature from 11za
   */
  verifyWebhookSignature(signature, body) {
    // TODO: Implement 11za HMAC signature verification
    // For now, basic token check
    return signature === this.webhookToken;
  }

  /**
   * Parse incoming webhook message
   * Handles both text and interactive messages from 11za
   */
  parseWebhookMessage(body) {
    try {
      // Text message format
      if (body?.content?.contentType === 'text') {
        return {
          messageId: body?.messageId || this._generateId(),
          from: body?.from,
          to: body?.to,
          timestamp: body?.timestamp || new Date(),
          type: 'text',
          text: body?.content?.text || '',
          senderName: body?.senderName || ''
        };
      }

      // Interactive message (button/list reply)
      if (body?.content?.contentType === 'interactive') {
        const interactive = body.content.interactive;
        let selectedValue = null;
        let selectedTitle = null;

        if (interactive?.subType === 'buttons') {
          const reply = interactive?.components?.reply;
          selectedValue = reply?.payload;
          selectedTitle = reply?.title;
        } else if (interactive?.subType === 'list') {
          const reply = interactive?.components?.reply;
          selectedValue = reply?.payload;
          selectedTitle = reply?.title;
        }

        return {
          messageId: body?.messageId || this._generateId(),
          from: body?.from,
          to: body?.to,
          timestamp: body?.timestamp || new Date(),
          type: 'interactive',
          interactiveType: interactive?.subType,
          text: selectedTitle || '',
          payload: selectedValue,
          senderName: body?.senderName || ''
        };
      }
      
      // Media message (voice note)
      if (body?.content?.contentType === 'media' && body?.content?.media?.type === 'voice') {
        return {
          messageId: body?.messageId || this._generateId(),
          from: body?.from,
          to: body?.to,
          timestamp: body?.timestamp || new Date(),
          type: 'voice',
          text: '', // To be filled by Whisper
          mediaUrl: body?.content?.media?.url,
          senderName: body?.senderName || ''
        };
      }

      logger.warn('Unknown message format:', body);
      return null;
    } catch (error) {
      logger.error('Failed to parse webhook message:', error.message);
      return null;
    }
  }

  /**
   * Download media file from URL
   */
  async downloadMedia(mediaUrl) {
    try {
      if (!mediaUrl) return null;
      logger.debug('Downloading media from URL:', mediaUrl);
      
      const response = await axios.get(mediaUrl, {
        responseType: 'arraybuffer'
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to download media:', error.message);
      return null;
    }
  }
}

export default WhatsAppService;
