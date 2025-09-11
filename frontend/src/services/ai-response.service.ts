import { supabase } from '../lib/supabase';

export class AIResponseService {
  static async generateResponse(apartmentId: string, conversationId: string) {
    console.log('Début de generateResponse avec:', { apartmentId, conversationId });
    try {
      console.log('Envoi de la requête à la fonction Supabase Edge...');
      const { data, error } = await supabase.functions.invoke('generate-ai-response', {
        body: {
          apartmentId,
          conversationId
        }
      });

      if (error) {
        console.error('Erreur Edge Function:', error);
        throw new Error(error.message || 'Erreur lors de la génération de la réponse');
      }

      console.log('Données brutes reçues de l\'Edge Function:', data);
      
      // Vérification du format de la réponse
      if (!data?.response) {
        console.error('Format de réponse invalide:', data);
        throw new Error('Format de réponse invalide');
      }
      
      // Vérification supplémentaire pour éviter les réponses de type "Template envoyé"
      if (data.response.startsWith('Template envoyé:')) {
        console.error('Réponse invalide (template):', data.response);
        throw new Error('Erreur: La réponse semble être un template, pas une réponse IA');
      }
      
      console.log('Réponse IA extraite et validée:', data.response);
      
      // Déclencher l'analyse d'urgence pour chaque message généré
      this.notifyUncertainty(conversationId, data.response);
      
      return data.response;
    } catch (error) {
      console.error('Erreur lors de la génération de la réponse:', error);
      throw error;
    }
  }

  // Méthode pour déclencher l'analyse d'urgence
  static async notifyUncertainty(conversationId: string, messageContent: string) {
    try {
      console.log('Déclenchement analyse d\'urgence pour:', { conversationId, messageContent });
      
      const { data, error } = await supabase.functions.invoke('analyze-emergency', {
        body: {
          conversationId,
          messageContent
        }
      });
      
      if (error) {
        console.error('Erreur lors de l\'analyse d\'urgence:', error);
      } else {
        console.log('Analyse d\'urgence terminée:', data);
      }
    } catch (error) {
      console.error('Erreur lors de l\'appel à analyze-emergency:', error);
    }
  }
}