import { supabase } from '../../lib/supabase';

export interface WhatsAppConfig {
  phone_number_id: string;
  token: string;
  created_at?: string;
  updated_at?: string;
}

export class WhatsAppService {
  // static async getConfig(): Promise<WhatsAppConfig | null> {
  //   try {
  //     console.log("[WhatsAppService] v3.0.0 - Tentative de récupération de la configuration WhatsApp via API Supabase directe...");
      
  //     // Utiliser directement l'API Supabase pour récupérer la configuration WhatsApp
  //     // On récupère tous les enregistrements, triés par date de mise à jour décroissante
  //     const { data, error } = await supabase
  //       .from('whatsapp_config')
  //       .select('*')
  //       .order('updated_at', { ascending: false })
  //       .limit(1);
      
  //     if (error) {
  //       console.error("Erreur lors de la récupération de la configuration WhatsApp:", error);
  //       return null;
  //     }
      
  //     console.log("Configuration WhatsApp récupérée via API Supabase avec succès:", data);
      
  //     if (data && data.length > 0) {
  //       return data[0] as WhatsAppConfig;
  //     }
      
  //     console.log("Aucune configuration WhatsApp trouvée");
  //     return null;
  //   } catch (err) {
  //     console.error("Exception lors de la récupération de la configuration WhatsApp:", err);
  //     console.log("Aucune configuration WhatsApp trouvée, utilisation des valeurs par défaut");
  //     return null;
  //   }
  // }


   static async getConfig(): Promise<WhatsAppConfig | null> {
  try {
    console.log("[WhatsAppService] v4.0.0 - Récupération de la configuration WhatsApp pour l'utilisateur authentifié...");
    
    // 1. Get the current user's session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      console.error("Erreur: Impossible d'obtenir la session de l'utilisateur.", sessionError);
      return null;
    }
    const hostId = session.user.id;
    
    // 2. Fetch the config specifically for this user
    const { data, error } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('host_id', hostId)
      .single(); // Use .single() as each user should only have one config
    
    if (error) {
      // It's normal for no config to be found initially, so we don't treat every error as a critical issue.
      if (error.code !== 'PGRST116') { // PGRST116 means no rows were found
        console.error("Erreur lors de la récupération de la configuration WhatsApp:", error);
      }
      return null;
    }
    
    console.log("Configuration WhatsApp récupérée avec succès pour l'utilisateur:", hostId);
    return data as WhatsAppConfig;
  } catch (err) {
    console.error("Exception lors de la récupération de la configuration WhatsApp:", err);
    return null;
  }
}

  static async saveConfig(config: Partial<WhatsAppConfig>): Promise<boolean> {
  try {
    console.log("[WhatsAppService] v5.0.0 - Sauvegarde de la configuration WhatsApp:", config); 

    // 1. Get the real user ID from the current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      console.error("Erreur critique: Impossible d'obtenir la session de l'utilisateur pour la sauvegarde.", sessionError);
      return false;
    }
    const host_id = session.user.id;

    // 2. Prepare the data to save using the REAL user ID
    const dataToSave = {
      ...config,
      host_id: host_id, // Use the real ID, no more hardcoded value
      updated_at: new Date().toISOString()
    };
    
    // 3. Upsert the data with the correct conflict column
    const { error } = await supabase
      .from('whatsapp_config')
      .upsert(dataToSave, { onConflict: 'host_id' }); // Explicitly define onConflict
    
    if (error) {
      // Re-check the error details here
      console.error("Erreur lors de la sauvegarde de la configuration WhatsApp:", error);
      return false;
    }
    
    console.log("Configuration WhatsApp sauvegardée avec succès pour l'utilisateur:", host_id);
    return true;
  } catch (err) {
    console.error("Exception lors de la sauvegarde de la configuration WhatsApp:", err);
    return false;
  }
}

  static async sendMessage(to: string, content: string) {
    console.log('[WhatsAppService] DEBUG v1.10.6 - Tentative d\'envoi de message WhatsApp:', { to, content });
    
    try {
      // Récupérer la configuration WhatsApp
      console.log('[WhatsAppService] Avant getConfig()');
      const config = await this.getConfig();
      console.log('[WhatsAppService] Après getConfig(), résultat:', config);
      
      if (!config) {
        console.error('[WhatsAppService] Configuration WhatsApp non trouvée');
        throw new Error('Configuration WhatsApp non trouvée');
      }
      
      console.log('[WhatsAppService] Configuration récupérée, envoi du message...', {
        phone_number_id: config.phone_number_id,
        token_length: config.token ? config.token.length : 0
      });
      
      // Préparer le corps de la requête
      const requestBody = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: {
          body: content
        }
      };
      
      console.log('[WhatsAppService] Corps de la requête:', JSON.stringify(requestBody));
      console.log('[WhatsAppService] URL de l\'API:', `https://graph.facebook.com/v22.0/${config.phone_number_id}/messages`);
      
      // Appel direct à l'API WhatsApp
      const response = await fetch(
        `https://graph.facebook.com/v22.0/${config.phone_number_id}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );
      
      console.log('[WhatsAppService] Réponse reçue, status:', response.status);
      
      const result = await response.json();
      console.log('[WhatsAppService] Réponse JSON:', result);
      
      if (!response.ok) {
        const errorMsg = result?.error?.message || `Erreur ${response.status}: ${response.statusText}`;
        console.error('[WhatsAppService] Erreur lors de l\'envoi du message WhatsApp:', errorMsg, result);
        throw new Error(errorMsg);
      }
      
      console.log('[WhatsAppService] Message WhatsApp envoyé avec succès:', result);
      return result;
    } catch (error) {
      console.error('[WhatsAppService] Erreur lors de l\'envoi du message WhatsApp:', error);
      console.error('[WhatsAppService] Détails de l\'erreur:', error instanceof Error ? error.message : error);
      throw error;
    }
  }
  
  static async sendTemplate(to: string, templateName: string, language: string) {
    console.log('[WhatsAppService] DEBUG v1.10.3 - Tentative d\'envoi de template WhatsApp:', { to, templateName, language });
    
    try {
      // Récupérer la configuration WhatsApp
      console.log('[WhatsAppService] Avant getConfig()');
      const config = await this.getConfig();
      console.log('[WhatsAppService] Après getConfig(), résultat:', config);
      
      if (!config) {
        console.error('[WhatsAppService] Configuration WhatsApp non trouvée');
        throw new Error('Configuration WhatsApp non trouvée');
      }
      
      console.log('[WhatsAppService] Configuration récupérée, envoi du template...', {
        phone_number_id: config.phone_number_id,
        token_length: config.token ? config.token.length : 0
      });
      
      // Préparer le corps de la requête
      const requestBody = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: language
          }
        },
      };
      
      console.log('[WhatsAppService] Corps de la requête:', JSON.stringify(requestBody));
      console.log('[WhatsAppService] URL de l\'API:', `https://graph.facebook.com/v22.0/${config.phone_number_id}/messages`);
      
      // Appel direct à l'API WhatsApp
      const response = await fetch(
        `https://graph.facebook.com/v22.0/${config.phone_number_id}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );
      
      console.log('[WhatsAppService] Réponse reçue, status:', response.status);
      
      const result = await response.json();
      console.log('[WhatsAppService] Réponse JSON:', result);
      
      if (!response.ok) {
        const errorMsg = result?.error?.message || `Erreur ${response.status}: ${response.statusText}`;
        console.error('[WhatsAppService] Erreur lors de l\'envoi du template WhatsApp:', errorMsg, result);
        throw new Error(errorMsg);
      }
      
      console.log('[WhatsAppService] Template WhatsApp envoyé avec succès:', result);
      return result;
    } catch (error) {
      console.error('[WhatsAppService] Erreur lors de l\'envoi du template WhatsApp:', error);
      console.error('[WhatsAppService] Détails de l\'erreur:', error instanceof Error ? error.message : error);
      throw error;
    }
  }
}
