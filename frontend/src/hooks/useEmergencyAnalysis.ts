import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AIResponseService } from '../services/ai-response.service';

// Hook pour analyser automatiquement les messages entrants
export const useEmergencyAnalysis = (conversationId: string) => {
  useEffect(() => {
    if (!conversationId) return;

    console.log('[useEmergencyAnalysis] Mise en place de l\'écoute pour la conversation:', conversationId);

    // Écouter les nouveaux messages en temps réel
    const subscription = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const newMessage = payload.new;
          console.log('[useEmergencyAnalysis] Nouveau message détecté:', newMessage);
          
          // Analyser uniquement les messages entrants (du client)
          if (newMessage.direction === 'inbound' && newMessage.content) {
            console.log('[useEmergencyAnalysis] Déclenchement de l\'analyse d\'urgence pour message entrant');
            
            // Déclencher l'analyse d'urgence
            AIResponseService.notifyUncertainty(conversationId, newMessage.content)
              .catch(error => {
                console.error('[useEmergencyAnalysis] Erreur lors de l\'analyse d\'urgence:', error);
              });
          }
        }
      )
      .subscribe();

    return () => {
      console.log('[useEmergencyAnalysis] Nettoyage de l\'abonnement');
      subscription.unsubscribe();
    };
  }, [conversationId]);
};