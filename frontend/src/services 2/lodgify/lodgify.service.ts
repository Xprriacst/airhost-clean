import { supabase } from '../../lib/supabase';

interface SendMessageToLodgifyParams {
  conversation_id: string;
  message: string;
  message_type?: 'text' | 'template';
}

interface LodgifyMessageResponse {
  success: boolean;
  message_id?: string;
  lodgify_message_id?: string;
  error?: string;
}

class LodgifyService {
  /**
   * Send a message to Lodgify for a specific conversation
   */
  async sendMessage(params: SendMessageToLodgifyParams): Promise<LodgifyMessageResponse> {
    try {
      const { data, error } = await supabase.functions.invoke('lodgify-send-message', {
        body: params
      });

      if (error) {
        console.error('Error sending message to Lodgify:', error);
        return {
          success: false,
          error: error.message
        };
      }

      return data;
    } catch (error) {
      console.error('Unexpected error sending message to Lodgify:', error);
      return {
        success: false,
        error: 'Unexpected error occurred'
      };
    }
  }

  /**
   * Check if a conversation is linked to Lodgify
   */
  async isConversationLinkedToLodgify(conversationId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('lodgify_booking_id')
        .eq('id', conversationId)
        .single();

      if (error || !data) {
        return false;
      }

      return !!data.lodgify_booking_id;
    } catch (error) {
      console.error('Error checking Lodgify link:', error);
      return false;
    }
  }

  /**
   * Get Lodgify booking information for a conversation
   */
  async getLodgifyBookingInfo(conversationId: string) {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          lodgify_booking_id,
          lodgify_thread_uid,
          property:properties(
            lodgify_property_id,
            name
          )
        `)
        .eq('id', conversationId)
        .single();

      if (error) {
        console.error('Error fetching Lodgify booking info:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Unexpected error fetching Lodgify booking info:', error);
      return null;
    }
  }
}

export default new LodgifyService();