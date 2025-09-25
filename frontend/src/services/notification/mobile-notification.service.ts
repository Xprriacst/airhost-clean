import { supabase } from '../../lib/supabase';
// @ts-ignore - Ignorer l'erreur de type pour firebase
import { requestFCMPermission, setMessagingCallback } from '../../lib/firebase';
import { getDeviceInfo, updateDeviceActivity, type DeviceInfo } from '../../utils/device-fingerprint';

// Service de notification mobile avec gestion automatique des tokens FCM
export class MobileNotificationService {
  private static fcmToken: string | null = null;
  private static deviceInfo: DeviceInfo | null = null;
  private static isRegistering = false; // Guard against duplicate registrations
  private static isInitialized = false; // Guard against multiple initializations
  private static initPromise: Promise<void> | null = null; // Ensure single init
  private static lastVerificationTime = 0; // Debounce verification calls
  private static verificationDebounceMs = 30000; // 30 seconds minimum between verifications

  /**
   * Initialise le service de notification mobile avec gestion automatique des tokens FCM
   */
  static async init(): Promise<void> {
    // Guard against multiple simultaneous initializations
    if (this.isInitialized) {
      console.log('[NOTIF DEBUG] Service déjà initialisé, ignorer');
      return;
    }
    
    if (this.initPromise) {
      console.log('[NOTIF DEBUG] Initialisation en cours, attendre...');
      return this.initPromise;
    }
    
    this.initPromise = this._doInit();
    await this.initPromise;
    this.initPromise = null;
  }
  
  /**
   * Méthode interne d'initialisation
   */
  private static async _doInit(): Promise<void> {
    console.log('[NOTIF DEBUG] Initialisation du service de notification mobile');
    
    // Capture device information for multi-device support
    this.deviceInfo = getDeviceInfo();
    console.log('[NOTIF DEBUG] Device info captured:', {
      deviceId: this.deviceInfo.deviceId,
      deviceName: this.deviceInfo.deviceName,
      type: this.deviceInfo.deviceInfo.type
    });
    
    // Update device activity
    updateDeviceActivity();
    
    await this.loadFCMToken();
    
    // Configurer le callback pour les messages FCM reçus quand l'app est au premier plan
    setMessagingCallback((payload: any) => {
      console.log('[NOTIF DEBUG] Message FCM reçu au premier plan:', payload);
    });
    
    // Demander la permission et obtenir un token si on n'en a pas déjà un
    if (!this.fcmToken) {
      try {
        console.log('[NOTIF DEBUG] Aucun token FCM trouvé, demande de permission...');
        const token = await requestFCMPermission();
        if (token) {
          console.log('[NOTIF DEBUG] Token FCM obtenu, enregistrement...');
          await this.registerToken(token);
        } else {
          console.warn('[NOTIF DEBUG] Impossible d\'obtenir un token FCM');
        }
      } catch (error) {
        console.error('[NOTIF DEBUG] Erreur lors de l\'initialisation FCM:', error);
      }
    } else {
      console.log('[NOTIF DEBUG] Token FCM existant trouvé, vérification...');
      // Vérifier que le token existant est bien enregistré dans Supabase
      this.verifyTokenRegistration();
    }
    
    // Configurer une vérification périodique du token
    this.setupPeriodicTokenCheck();
    
    // Marquer comme initialisé
    this.isInitialized = true;
    console.log('[NOTIF DEBUG] Service de notification mobile initialisé avec succès');
  }
  
  /**
   * Configure une vérification périodique du token FCM
   */
  private static setupPeriodicTokenCheck(): void {
    // Vérifier le token toutes les 24 heures (réduit de 12h à 24h)
    const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 heures en millisecondes
    
    const performCheck = () => {
      // Update device activity before verification
      updateDeviceActivity();
      this.verifyTokenRegistration();
    };
    
    // Première vérification après 30 minutes (réduit de 5min à 30min)
    setTimeout(performCheck, 30 * 60 * 1000);
    
    // Vérifications périodiques ensuite
    setInterval(performCheck, CHECK_INTERVAL);
    
    // Vérifier également à chaque reprise de l'application (visibilitychange)
    // Mais avec debounce intégré dans verifyTokenRegistration
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('[NOTIF DEBUG] Application revenue au premier plan, vérification du token FCM');
        performCheck();
      }
    });
  }
  
  /**
   * Vérifie que le token FCM actuel est bien enregistré dans Supabase
   */
  private static async verifyTokenRegistration(): Promise<void> {
    try {
      // Debounce: éviter les vérifications trop fréquentes
      const now = Date.now();
      if (now - this.lastVerificationTime < this.verificationDebounceMs) {
        console.log('[NOTIF DEBUG] Vérification ignorée (debounce)');
        return;
      }
      this.lastVerificationTime = now;
      
      if (!this.fcmToken) {
        console.log('[NOTIF DEBUG] Pas de token FCM à vérifier');
        return;
      }
      
      console.log('[NOTIF DEBUG] Vérification de l\'enregistrement du token FCM:', this.fcmToken.substring(0, 10) + '...');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('[NOTIF DEBUG] Impossible de vérifier le token: utilisateur non authentifié');
        return;
      }
      
      // Vérifier si le token est enregistré dans Supabase pour ce device spécifique
      const deviceInfo = this.deviceInfo || getDeviceInfo();
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('id, updated_at, device_id, device_name')
        .eq('user_id', user.id)
        .eq('device_id', deviceInfo.deviceId)
        .eq('platform', 'fcm')
        .single();
      
      if (error || !data) {
        console.warn('[NOTIF DEBUG] Token FCM non trouvé dans la base de données, réenregistrement...');
        await this.registerToken(this.fcmToken);
        return;
      }
      
      // Vérifier si l'enregistrement date de plus de 7 jours
      const lastUpdate = new Date(data.updated_at);
      const current_date = new Date();
      const daysSinceUpdate = Math.floor((current_date.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceUpdate > 7) {
        console.log(`[NOTIF DEBUG] Enregistrement du token datant de ${daysSinceUpdate} jours, mise à jour...`);
        await this.registerToken(this.fcmToken);
      } else {
        console.log('[NOTIF DEBUG] Token FCM correctement enregistré et à jour');
      }
    } catch (error) {
      console.error('[NOTIF DEBUG] Erreur lors de la vérification du token FCM:', error);
    }
  }

  /**
   * Charge le token FCM depuis le stockage local
   */
  private static async loadFCMToken(): Promise<void> {
    try {
      const token = localStorage.getItem('fcm_token');
      if (token) {
        this.fcmToken = token;
        console.log('[NOTIF DEBUG] Token FCM chargé depuis le stockage local');
      }
    } catch (error) {
      console.error('[NOTIF DEBUG] Erreur lors du chargement du token FCM:', error);
    }
  }

  /**
   * Enregistre un nouveau token FCM avec mécanisme de reprise
   */
  static async registerToken(token: string): Promise<void> {
    // Guard against duplicate registrations
    if (this.isRegistering) {
      console.log('[NOTIF DEBUG] Registration already in progress, skipping...');
      return;
    }

    this.isRegistering = true;
    
    try {
      console.log('[NOTIF DEBUG] Enregistrement du token FCM:', token.substring(0, 10) + '...');
      
      // Sauvegarder le token localement immédiatement
      localStorage.setItem('fcm_token', token);
      this.fcmToken = token;
      
      // Variable pour le nombre de tentatives
      let attempts = 0;
      const maxAttempts = 3;
      
      const registerWithRetry = async (): Promise<boolean> => {
        attempts++;
        
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            console.warn('[NOTIF DEBUG] Utilisateur non authentifié, enregistrement différé');
            return false;
          }
          
          // Get device information for multi-device support
          const deviceInfo = this.deviceInfo || getDeviceInfo();
          
          const { error } = await supabase.rpc('upsert_push_token', {
            p_user_id: user.id,
            p_token: token,
            p_platform: 'fcm',
            p_device_id: deviceInfo.deviceId,
            p_device_name: deviceInfo.deviceName,
            p_device_info: deviceInfo.deviceInfo
          });
          
          if (error) {
            console.error(`[NOTIF DEBUG] Erreur lors de l'enregistrement (tentative ${attempts}):`, error);
            
            if (attempts < maxAttempts) {
              console.log(`[NOTIF DEBUG] Nouvelle tentative dans 5 secondes...`);
              setTimeout(() => registerWithRetry(), 5000);
              return false;
            } else {
              console.error('[NOTIF DEBUG] Échec de l\'enregistrement après', maxAttempts, 'tentatives');
              return false;
            }
          }
          
          console.log('[NOTIF DEBUG] Token FCM enregistré avec succès dans Supabase');
          return true;
        } catch (error) {
          console.error(`[NOTIF DEBUG] Erreur lors de l'enregistrement (tentative ${attempts}):`, error);
          
          if (attempts < maxAttempts) {
            console.log(`[NOTIF DEBUG] Nouvelle tentative dans 5 secondes...`);
            setTimeout(() => registerWithRetry(), 5000);
            return false;
          } else {
            console.error('[NOTIF DEBUG] Échec de l\'enregistrement après', maxAttempts, 'tentatives');
            return false;
          }
        }
      };
      
      await registerWithRetry();
    } finally {
      this.isRegistering = false;
    }
  }

  static async sendNotification(title: string, body: string) {
    console.log('[NOTIF DEBUG] Notification mobile:', title, body);
  }

  static async sendTestNotification() {
    console.log('[NOTIF DEBUG] Test de notification mobile');
  }
}