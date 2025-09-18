import axios from 'axios';
import { supabase } from '../lib/supabase';

export class WhatsAppService {
  private static baseUrl = 'https://graph.facebook.com/v16.0';

  static async sendMessage(userId: string, to: string, message: string) {
    try {
      // Récupérer les credentials de l'utilisateur depuis whatsapp_config
      const { data: whatsappConfig } = await supabase
        .from('whatsapp_config')
        .select('phone_number_id, token')
        .eq('host_id', userId)
        .single();

      if (!whatsappConfig) throw new Error('WhatsApp configuration not found for user');

      const response = await axios.post(
        `${this.baseUrl}/${whatsappConfig.phone_number_id}/messages`,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: { body: message }
        },
        {
          headers: {
            'Authorization': `Bearer ${whatsappConfig.token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('WhatsApp send error:', error);
      throw error;
    }
  }

  static async sendTemplate(
    userId: string,
    to: string,
    templateName: string,
    language: string = "fr",
    components: any[] = []
  ) {
    try {
      const { data: whatsappConfig } = await supabase
        .from('whatsapp_config')
        .select('phone_number_id, token')
        .eq('host_id', userId)
        .single();

      if (!whatsappConfig) throw new Error('WhatsApp configuration not found for user');

      const response = await axios.post(
        `${this.baseUrl}/${whatsappConfig.phone_number_id}/messages`,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "template",
          template: {
            name: templateName,
            language: {
              code: language
            },
            components
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${whatsappConfig.token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('WhatsApp template send error:', error);
      throw error;
    }
  }
}
