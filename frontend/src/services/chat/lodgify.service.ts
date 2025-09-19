import { supabase } from '../../lib/supabase';

export interface LodgifyConfig {
  api_key: string;
  api_url?: string;
  created_at?: string;
  updated_at?: string;
}

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

export class LodgifyService {
  static async getConfig(): Promise<LodgifyConfig | null> {
    try {
      console.log("[LodgifyService] v1.0.0 - Récupération de la configuration Lodgify...");
      
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        console.error("Utilisateur non authentifié");
        return null;
      }
      
      const { data, error } = await supabase
        .from('lodgify_config')
        .select('*')
        .eq('host_id', user.data.user.id)
        .order('updated_at', { ascending: false })
        .limit(1);
      
      if (error) {
        console.error("Erreur lors de la récupération de la configuration Lodgify:", error);
        return null;
      }
      
      console.log("Configuration Lodgify récupérée avec succès:", data);
      
      if (data && data.length > 0) {
        return data[0] as LodgifyConfig;
      }
      
      console.log("Aucune configuration Lodgify trouvée");
      return null;
    } catch (err) {
      console.error("Exception lors de la récupération de la configuration Lodgify:", err);
      return null;
    }
  }

  static async saveConfig(config: Partial<LodgifyConfig>, hostId?: string): Promise<boolean> {
    try {
      console.log("[LodgifyService] v1.0.0 - Sauvegarde de la configuration Lodgify:", config);
      
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        console.error("Utilisateur non authentifié");
        return false;
      }
      
      const dataToSave = {
        ...config,
        host_id: hostId || user.data.user.id, // Use provided hostId or authenticated user's ID
        updated_at: new Date().toISOString()
      };

      console.log("dataToSave",dataToSave)
      
      const { error } = await supabase
        .from('lodgify_config')
        .upsert(dataToSave, {
          onConflict: 'host_id'
        });
      
      if (error) {
        console.error("Erreur lors de la sauvegarde de la configuration Lodgify:", error);
        return false;
      }
      
      console.log("Configuration Lodgify sauvegardée avec succès");
      return true;
    } catch (err) {
      console.error("Exception lors de la sauvegarde de la configuration Lodgify:", err);
      return false;
    }
  }

  /**
   * Send a message to Lodgify for a specific conversation
   */
  static async sendMessage(params: SendMessageToLodgifyParams): Promise<LodgifyMessageResponse> {
    try {
      console.log('[LodgifyService] Envoi de message Lodgify:', params);
      
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

      console.log('[LodgifyService] Message Lodgify envoyé avec succès:', data);
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
  static async isConversationLinkedToLodgify(conversationId: string): Promise<boolean> {
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
   * Fetch properties from Lodgify API using user's API key
   */
  static async fetchLodgifyProperties(): Promise<{ success: boolean; properties?: any[]; error?: string }> {
    try {
      console.log("[LodgifyService] Fetching properties from Lodgify API...");
      
      // Get user's Lodgify configuration
      const config = await this.getConfig();
      if (!config || !config.api_key) {
        return {
          success: false,
          error: 'Configuration Lodgify non trouvée ou clé API manquante'
        };
      }

      // Make request to Lodgify API
      const response = await fetch('https://api.lodgify.com/v1/properties', {
        method: 'GET',
        headers: {
          'X-ApiKey': config.api_key,
          'accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Lodgify API error:', errorText);
        return {
          success: false,
          error: `Erreur API Lodgify: ${response.status} - ${errorText}`
        };
      }

      const properties = await response.json();
      console.log('Properties fetched from Lodgify:', properties);

      return {
        success: true,
        properties: properties || []
      };
    } catch (error) {
      console.error('Error fetching Lodgify properties:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }

  /**
   * Get Lodgify booking information for a conversation
   */
  static async getLodgifyBookingInfo(conversationId: string) {
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

  /**
   * Setup webhooks for a client's Lodgify integration
   */
  static async setupWebhooks(hostId: string, apiKey: string): Promise<{ success: boolean; webhooks?: any; error?: string }> {
    try {
      console.log('[LodgifyService] Setting up webhooks for host:', hostId);
      
      const { data, error } = await supabase.functions.invoke('lodgify-webhook-manager', {
        body: {
          host_id: hostId,
          api_key: apiKey
        }
      });

      if (error) {
        console.error('Error setting up webhooks:', error);
        return {
          success: false,
          error: error.message
        };
      }

      console.log('[LodgifyService] Webhooks setup result:', data);
      return data;
    } catch (error) {
      console.error('Unexpected error setting up webhooks:', error);
      return {
        success: false,
        error: 'Unexpected error occurred'
      };
    }
  }

  /**
   * Get webhook status for a client
   */
  static async getWebhookStatus(hostId: string): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('lodgify-webhook-manager', {
        method: 'GET',
        body: { host_id: hostId }
      });

      if (error) {
        console.error('Error getting webhook status:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Unexpected error getting webhook status:', error);
      return null;
    }
  }

  /**
   * Unsubscribe webhooks for a client
   */
  static async unsubscribeWebhooks(hostId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[LodgifyService] Unsubscribing webhooks for host:', hostId);
      
      const { data, error } = await supabase.functions.invoke('lodgify-webhook-manager', {
        method: 'DELETE',
        body: { host_id: hostId }
      });

      if (error) {
        console.error('Error unsubscribing webhooks:', error);
        return {
          success: false,
          error: error.message
        };
      }

      console.log('[LodgifyService] Webhooks unsubscribed:', data);
      return data;
    } catch (error) {
      console.error('Unexpected error unsubscribing webhooks:', error);
      return {
        success: false,
        error: 'Unexpected error occurred'
      };
    }
  }
}
