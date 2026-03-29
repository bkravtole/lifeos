import Contact from '../models/Contact.js';
import logger from '../utils/logger.js';

/**
 * Contact Service
 * Manages user contacts for quick-call and messaging features
 */
export class ContactService {
  /**
   * Save a new contact
   */
  static async saveContact(userId, name, phone, relationship = 'other', aliases = []) {
    try {
      // Check if contact with same name already exists
      const existing = await Contact.findOne({ userId, nameLower: name.toLowerCase() });
      if (existing) {
        // Update existing contact
        existing.phone = phone;
        if (relationship !== 'other') existing.relationship = relationship;
        if (aliases.length > 0) existing.aliases = [...new Set([...existing.aliases, ...aliases])];
        await existing.save();
        logger.info('📇 Contact updated:', { name, phone });
        return { contact: existing, isNew: false };
      }

      const contact = new Contact({
        userId,
        name,
        phone,
        relationship,
        aliases: aliases.map(a => a.toLowerCase())
      });
      await contact.save();
      logger.info('📇 New contact saved:', { name, phone });
      return { contact, isNew: true };
    } catch (error) {
      logger.error('Failed to save contact:', error.message);
      throw error;
    }
  }

  /**
   * Find a contact by name or alias (fuzzy search)
   */
  static async findContact(userId, searchTerm) {
    try {
      const term = searchTerm.toLowerCase().trim();
      
      // Clean filler words
      const cleanTerm = term.replace(/\b(ko|ke|ki|ka|bhai|sir|madam|ji|se|call|karo|karna|hai|he|bolo|msg|message|bhejo)\b/gi, '').trim();
      const searchWords = cleanTerm.split(/\s+/).filter(w => w.length > 1);

      if (searchWords.length === 0) return null;

      const contacts = await Contact.find({ userId, isActive: true });

      // 1. Exact name match
      let match = contacts.find(c => c.nameLower === cleanTerm);
      if (match) return match;

      // 2. Name contains search term or search term contains name
      match = contacts.find(c => {
        if (c.nameLower.includes(cleanTerm) || cleanTerm.includes(c.nameLower)) return true;
        // Token match
        if (searchWords.some(w => c.nameLower.includes(w))) return true;
        return false;
      });
      if (match) return match;

      // 3. Alias match
      match = contacts.find(c => {
        return c.aliases.some(alias => {
          if (alias === cleanTerm) return true;
          if (searchWords.some(w => alias.includes(w) || w.includes(alias))) return true;
          return false;
        });
      });
      if (match) return match;

      // 4. Relationship match (e.g. "bhai" → family)
      const relationshipKeywords = {
        'bhai': 'family', 'brother': 'family', 'bro': 'family',
        'sister': 'family', 'didi': 'family', 'behan': 'family',
        'mom': 'family', 'mummy': 'family', 'papa': 'family', 'dad': 'family',
        'boss': 'colleague', 'sir': 'colleague'
      };
      
      for (const word of searchWords) {
        if (relationshipKeywords[word]) {
          match = contacts.find(c => 
            c.relationship === relationshipKeywords[word] || 
            c.aliases.includes(word)
          );
          if (match) return match;
        }
      }

      return null;
    } catch (error) {
      logger.error('Failed to find contact:', error.message);
      return null;
    }
  }

  /**
   * Get all contacts for a user
   */
  static async getAllContacts(userId) {
    try {
      return await Contact.find({ userId, isActive: true }).sort({ name: 1 });
    } catch (error) {
      logger.error('Failed to get contacts:', error.message);
      return [];
    }
  }

  /**
   * Delete a contact
   */
  static async deleteContact(userId, searchTerm) {
    try {
      const contact = await this.findContact(userId, searchTerm);
      if (!contact) return { success: false, error: 'Contact not found' };
      
      contact.isActive = false;
      await contact.save();
      logger.info('📇 Contact deleted:', { name: contact.name });
      return { success: true, deleted: contact.name };
    } catch (error) {
      logger.error('Failed to delete contact:', error.message);
      throw error;
    }
  }
}

export default ContactService;
