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
      console.log("[MessagingConfigService] Récupération de la configuration de messagerie pour hostId:", hostId);
      
      // Get current user if hostId not provided
      if (!hostId) {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error("Error getting session:", sessionError);
          return null;
        }
        if (!session || !session.user) {
          console.error("No authenticated user found");
          return null;
        }
        hostId = session.user.id;
        console.log("[MessagingConfigService] Using authenticated user ID for getConfig:", hostId);
      }
      
      const { data, error } = await supabase
        .from('messaging_config')
        .select('*')
        .eq('host_id', hostId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No config found, return default
          console.log("[MessagingConfigService] Aucune configuration trouvée, retour de la configuration par défaut");
          return { preferred_channel: 'whatsapp', host_id: hostId };
        }
        console.error("Erreur lors de la récupération de la configuration de messagerie:", error);
        console.error("Error details:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return null;
      }
      
      console.log("[MessagingConfigService] Configuration récupérée:", data);
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
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error("Error getting session:", sessionError);
          return false;
        }
        if (!session || !session.user) {
          console.error("No authenticated user found");
          return false;
        }
        hostId = session.user.id;
        console.log("[MessagingConfigService] Using authenticated user ID:", hostId);
      }
      
      const dataToSave = {
        ...config,
        host_id: hostId,
        updated_at: new Date().toISOString()
      };
      
      console.log("[MessagingConfigService] Data to save:", dataToSave);
      
      // Use upsert with proper conflict resolution
       const { data, error } = await supabase
         .from('messaging_config')
         .upsert(dataToSave,{ onConflict: 'host_id' })
         .select();
      
      if (error) {
        console.error("Erreur lors de la sauvegarde de la configuration de messagerie:", error);
        console.error("Error details:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
         return false;
       }

       console.log("[MessagingConfigService] Configuration de messagerie sauvegardée avec succès:", data);
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
