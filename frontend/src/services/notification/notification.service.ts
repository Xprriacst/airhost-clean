import { supabase } from '../../lib/supabase';
import { MobileNotificationService } from './mobile-notification.service';

// Service de notification qui utilise le FCM proxy
export class NotificationService {
  static async init() {
    console.log('[NOTIF] Initialisation du service de notification');
    
    try {
      // Initialiser le service de notification mobile avec gestion automatique des tokens FCM
      await MobileNotificationService.init();
      console.log('[NOTIF] Service de notification mobile initialisé avec succès');
      return true;
    } catch (error) {
      console.error('[NOTIF] Erreur lors de l\'initialisation du service de notification mobile:', error);
      return false;
    }
  }

  static async sendNotification(title: string, body: string) {
    console.log('[NOTIF] Envoi notification:', title, body);
    
    try {
      // Récupérer le token FCM depuis localStorage
      const fcmToken = localStorage.getItem('fcm_token');
      if (!fcmToken) {
        console.warn('[NOTIF] Aucun token FCM trouvé');
        return;
      }

      // Vérifier que l'utilisateur est connecté
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('[NOTIF] Utilisateur non connecté');
        throw new Error('Utilisateur non connecté');
      }

      console.log('[NOTIF] Session trouvée, envoi vers FCM proxy...');

      // Appeler le FCM proxy
      console.log('[NOTIF] Appel du FCM proxy avec token:', fcmToken.substring(0, 20) + '...');
      
      const { data, error } = await supabase.functions.invoke('fcm-proxy', {
        body: {
          to: fcmToken,
          notification: {
            title: title,
            body: body
          },
          data: {
            type: 'notification',
            timestamp: new Date().toISOString(),
            direction: 'inbound'
          }
        }
      });
      
      console.log('[NOTIF] Réponse FCM proxy - data:', data);
      console.log('[NOTIF] Réponse FCM proxy - error:', error);

      if (error) {
        console.error('[NOTIF] Erreur FCM proxy:', error);
        throw error;
      }

      console.log('[NOTIF] Notification envoyée avec succès:', data);
      return data;
    } catch (error) {
      console.error('[NOTIF] Erreur lors de l\'envoi de notification:', error);
      throw error;
    }
  }

  static async notifyNewMessage(message: any) {
    console.log('[NOTIF] Nouvelle notification de message:', message);
    
    try {
      // Récupérer le token FCM depuis localStorage
      const fcmToken = localStorage.getItem('fcm_token');
      if (!fcmToken) {
        console.warn('[NOTIF] Aucun token FCM trouvé pour le message');
        return;
      }

      // Préparer le payload de notification
      const notificationPayload = {
        to: fcmToken,
        notification: {
          title: 'Nouveau message',
          body: message.content || 'Vous avez reçu un nouveau message'
        },
        data: {
          type: 'message',
          messageId: message.id,
          conversationId: message.conversation_id,
          timestamp: message.created_at || new Date().toISOString(),
          direction: message.direction || 'inbound',
          url: `/chat?conversation=${message.conversation_id}`
        }
      };

      console.log('[NOTIF] Envoi notification message via FCM proxy:', notificationPayload);

      // Appeler le FCM proxy
      const { data, error } = await supabase.functions.invoke('fcm-proxy', {
        body: notificationPayload
      });

      if (error) {
        console.error('[NOTIF] Erreur FCM proxy pour message:', error);
        throw error;
      }

      console.log('[NOTIF] Notification message envoyée avec succès:', data);
      return data;
    } catch (error) {
      console.error('[NOTIF] Erreur lors de l\'envoi de notification message:', error);
      throw error;
    }
  }
}