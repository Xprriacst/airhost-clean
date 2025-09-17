import { WhatsAppService } from './chat/whatsapp.service';
import { LodgifyService } from './chat/lodgify.service';
import { MessagingConfigService, MessagingChannel } from './messaging-config.service';

export interface UnifiedMessageResponse {
  success: boolean;
  message_id?: string;
  error?: string;
}

export class UnifiedMessagingService {
  /**
   * Send a message using automatic channel detection based on conversation
   */
  static async sendMessage(to: string, content: string, conversationId?: string): Promise<UnifiedMessageResponse> {
    try {
      // First, try to detect the channel automatically based on conversation
      let channelToUse: MessagingChannel;

      console.log("unified message sevrice ....")
      
      if (conversationId) {
        const isLodgifyConversation = await LodgifyService.isConversationLinkedToLodgify(conversationId);
        channelToUse = isLodgifyConversation ? 'lodgify' : 'whatsapp';
        console.log("chanell to use",channelToUse)
        console.log(`[UnifiedMessagingService] Auto-détection: conversation ${conversationId} utilise ${channelToUse}`);
      } else {
        // Fallback to preferred channel if no conversation ID
        channelToUse = await MessagingConfigService.getPreferredChannel();
        console.log(`[UnifiedMessagingService] Fallback vers canal préféré: ${channelToUse}`);
      }
      
      console.log(`[UnifiedMessagingService] Envoi de message via ${channelToUse}:`, { to, content, conversationId });

      if (channelToUse === 'whatsapp') {
        const result = await WhatsAppService.sendMessage(to, content);
        return {
          success: true,
          message_id: result.messages?.[0]?.id
        };
      } else if (channelToUse === 'lodgify') {
        if (!conversationId) {
          throw new Error('Conversation ID required for Lodgify messaging');
        }
        
        const result = await LodgifyService.sendMessage({
          conversation_id: conversationId,
          message: content,
          message_type: 'text'
        });


        console.log("lodgify result",result)
        
        return {
          success: result.success,
          message_id: result.message_id,
          error: result.error
        };
      } else {
        throw new Error(`Canal de messagerie non supporté: ${channelToUse}`);
      }
    } catch (error) {
      console.error('[UnifiedMessagingService] Erreur lors de l\'envoi du message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }

  /**
   * Send a template message using automatic channel detection
   */
  static async sendTemplate(to: string, templateName: string, language: string = 'fr', conversationId?: string): Promise<UnifiedMessageResponse> {
    try {
      // Use same auto-detection logic as sendMessage
      let channelToUse: MessagingChannel;
      
      if (conversationId) {
        const isLodgifyConversation = await LodgifyService.isConversationLinkedToLodgify(conversationId);
        channelToUse = isLodgifyConversation ? 'lodgify' : 'whatsapp';
        console.log(`[UnifiedMessagingService] Auto-détection template: conversation ${conversationId} utilise ${channelToUse}`);
      } else {
        // Fallback to preferred channel if no conversation ID
        channelToUse = await MessagingConfigService.getPreferredChannel();
        console.log(`[UnifiedMessagingService] Fallback template vers canal préféré: ${channelToUse}`);
      }
      
      console.log(`[UnifiedMessagingService] Envoi de template via ${channelToUse}:`, { to, templateName, language, conversationId });

      if (channelToUse === 'whatsapp') {
        const result = await WhatsAppService.sendTemplate(to, templateName, language);
        return {
          success: true,
          message_id: result.messages?.[0]?.id
        };
      } else if (channelToUse === 'lodgify') {
        if (!conversationId) {
          throw new Error('Conversation ID required for Lodgify messaging');
        }
        
        const result = await LodgifyService.sendMessage({
          conversation_id: conversationId,
          message: templateName, // For Lodgify, we'll send the template name as message
          message_type: 'template'
        });
        
        return {
          success: result.success,
          message_id: result.message_id,
          error: result.error
        };
      } else {
        throw new Error(`Canal de messagerie non supporté: ${channelToUse}`);
      }
    } catch (error) {
      console.error('[UnifiedMessagingService] Erreur lors de l\'envoi du template:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }

  /**
   * Check if a conversation can use the current messaging channel
   */
  static async canUseCurrentChannel(conversationId: string): Promise<boolean> {
    try {
      const preferredChannel = await MessagingConfigService.getPreferredChannel();
      
      if (preferredChannel === 'whatsapp') {
        // For WhatsApp, check if we have a valid configuration
        const config = await WhatsAppService.getConfig();
        return !!(config?.phone_number_id && config?.token);
      } else if (preferredChannel === 'lodgify') {
        // For Lodgify, check if conversation is linked to Lodgify and we have config
        const isLinked = await LodgifyService.isConversationLinkedToLodgify(conversationId);
        const config = await LodgifyService.getConfig();
        return isLinked && !!config?.api_key;
      }
      
      return false;
    } catch (error) {
      console.error('[UnifiedMessagingService] Erreur lors de la vérification du canal:', error);
      return false;
    }
  }

  /**
   * Get the current messaging channel
   */
  static async getCurrentChannel(hostId?: string): Promise<MessagingChannel> {
    return await MessagingConfigService.getPreferredChannel(hostId);
  }

  /**
   * Get channel-specific information for a conversation
   */
  static async getChannelInfo(conversationId: string) {
    try {
      const isLodgifyConversation = await LodgifyService.isConversationLinkedToLodgify(conversationId);
      
      if (isLodgifyConversation) {
        return await LodgifyService.getLodgifyBookingInfo(conversationId);
      }
      
      return null;
    } catch (error) {
      console.error('[UnifiedMessagingService] Erreur lors de la récupération des informations du canal:', error);
      return null;
    }
  }

  /**
   * Detect which channel a conversation should use
   */
  static async detectConversationChannel(conversationId: string): Promise<MessagingChannel> {
    try {
      const isLodgifyConversation = await LodgifyService.isConversationLinkedToLodgify(conversationId);
      return isLodgifyConversation ? 'lodgify' : 'whatsapp';
    } catch (error) {
      console.error('[UnifiedMessagingService] Erreur lors de la détection du canal:', error);
      return 'whatsapp'; // Default fallback
    }
  }
}
