import { supabase } from '../lib/supabase';

export type MessagingChannel = 'whatsapp' | 'lodgify';

export interface MessagingConfig {
  id?: string;
  host_id?: string;
  preferred_channel: MessagingChannel;
  created_at?: string;
  updated_at?: string;
}

export class MessagingConfigService {
  static async getConfig(hostId?: string): Promise<MessagingConfig | null> {
    try {
      console.log("[MessagingConfigService] Récupération de la configuration de messagerie...");
      
      // Get current user if hostId not provided
      if (!hostId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.warn("No authenticated user found");
          return { preferred_channel: 'whatsapp' };
        }
        hostId = session.user.id;
      }
      
      const { data, error } = await supabase
        .from('messaging_config')
        .select('*')
        .eq('host_id', hostId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No config found, return default
          console.log("No messaging config found for user, using default");
          return { preferred_channel: 'whatsapp', host_id: hostId };
        }
        console.error("Erreur lors de la récupération de la configuration de messagerie:", error);
        return null;
      }
      
      return data as MessagingConfig;
    } catch (err) {
      console.error("Exception lors de la récupération de la configuration de messagerie:", err);
      return { preferred_channel: 'whatsapp' };
    }
  }

  static async saveConfig(config: Partial<MessagingConfig>, hostId?: string): Promise<boolean> {
    try {
      console.log("[MessagingConfigService] Sauvegarde de la configuration de messagerie:", config);
      
      // Get current user if hostId not provided
      if (!hostId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.error("No authenticated user found");
          return false;
        }
        hostId = session.user.id;
      }
      
      const dataToSave = {
        ...config,
        host_id: hostId,
        updated_at: new Date().toISOString()
      };
      
      const { error } = await supabase
        .from('messaging_config')
        .upsert(dataToSave, {
          onConflict: 'host_id'
        });
      
      if (error) {
        console.error("Erreur lors de la sauvegarde de la configuration de messagerie:", error);
        return false;
      }
      
      console.log("Configuration de messagerie sauvegardée avec succès");
      return true;
    } catch (err) {
      console.error("Exception lors de la sauvegarde de la configuration de messagerie:", err);
      return false;
    }
  }

  static async getPreferredChannel(hostId?: string): Promise<MessagingChannel> {
    const config = await this.getConfig(hostId);
    return config?.preferred_channel || 'whatsapp';
  }
}
