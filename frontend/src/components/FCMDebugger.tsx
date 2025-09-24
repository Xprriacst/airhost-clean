import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MobileNotificationService } from '../services 2/notification/mobile-notification.service';
import { requestFCMPermission } from '../lib/firebase';

/**
 * Composant de débogage pour tester l'enregistrement des tokens FCM
 * Ajoutez ce composant temporairement à votre app pour déboguer
 */
export const FCMDebugger: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [fcmToken, setFcmToken] = useState<string>('');
  const [dbTokens, setDbTokens] = useState<any[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[FCM DEBUG] ${message}`);
  };

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        addLog(`Utilisateur connecté: ${user.email}`);
        await loadDbTokens(user.id);
      } else {
        addLog('Aucun utilisateur connecté');
      }
      
      const localToken = localStorage.getItem('fcm_token');
      if (localToken) {
        setFcmToken(localToken);
        addLog(`Token local trouvé: ${localToken && localToken.length > 20 ? localToken.substring(0, 20) + '...' : localToken}`);
      }
    } catch (error) {
      addLog(`Erreur lors du chargement: ${error}`);
    }
  };

  const loadDbTokens = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) {
        addLog(`Erreur lors du chargement des tokens DB: ${error.message}`);
      } else {
        setDbTokens(data || []);
        addLog(`${data?.length || 0} token(s) trouvé(s) dans la DB`);
      }
    } catch (error) {
      addLog(`Erreur DB: ${error}`);
    }
  };

  const requestPermission = async () => {
    setLoading(true);
    addLog('Demande de permission FCM...');
    
    try {
      const token = await requestFCMPermission();
      if (token) {
        setFcmToken(token);
        addLog(`Token FCM obtenu: ${token && token.length > 20 ? token.substring(0, 20) + '...' : token}`);
      } else {
        addLog('Aucun token FCM obtenu');
      }
    } catch (error) {
      addLog(`Erreur lors de la demande de permission: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const registerToken = async () => {
    if (!fcmToken) {
      addLog('Aucun token à enregistrer');
      return;
    }
    
    setLoading(true);
    addLog('Enregistrement du token...');
    
    try {
      await MobileNotificationService.registerToken(fcmToken);
      addLog('Token enregistré avec succès');
      
      if (user) {
        await loadDbTokens(user.id);
      }
    } catch (error) {
      addLog(`Erreur lors de l'enregistrement: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const testUpsertFunction = async () => {
    if (!user) {
      addLog('Utilisateur non connecté');
      return;
    }
    
    setLoading(true);
    const testToken = `test-token-${Date.now()}`;
    addLog(`Test de la fonction upsert avec token: ${testToken}`);
    
    try {
      const { error } = await supabase.rpc('upsert_push_token', {
        p_user_id: user.id,
        p_token: testToken,
        p_platform: 'fcm'
      });
      
      if (error) {
        addLog(`Erreur upsert: ${error.message}`);
      } else {
        addLog('Fonction upsert fonctionne correctement');
        await loadDbTokens(user.id);
      }
    } catch (error) {
      addLog(`Erreur lors du test upsert: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const testNotification = async () => {
    console.log('[FCM DEBUG] Test notification button clicked');
    addLog('🔘 Bouton test notification cliqué');
    
    // Vérifier d'abord le token local, sinon utiliser les tokens de la DB
    let tokenToUse = fcmToken;
    
    if (!tokenToUse && dbTokens.length > 0) {
      // Utiliser le premier token actif de la DB
      const activeToken = dbTokens.find(token => token.is_active !== false);
      if (activeToken) {
        tokenToUse = activeToken.token;
        addLog(`📱 Utilisation du token DB: ${tokenToUse && tokenToUse.length > 20 ? tokenToUse.substring(0, 20) + '...' : tokenToUse}`);
        console.log('[FCM DEBUG] Using DB token:', tokenToUse && tokenToUse.length > 20 ? tokenToUse.substring(0, 20) + '...' : tokenToUse);
      }
    }
    
    if (!tokenToUse) {
      addLog('❌ Aucun token FCM disponible (ni local ni DB)');
      console.log('[FCM DEBUG] No FCM token available (neither local nor DB)');
      return;
    }
    
    if (fcmToken) {
      console.log('[FCM DEBUG] Using local FCM token:', fcmToken && fcmToken.length > 20 ? fcmToken.substring(0, 20) + '...' : fcmToken);
      addLog(`📱 Token local utilisé: ${fcmToken && fcmToken.length > 20 ? fcmToken.substring(0, 20) + '...' : fcmToken}`);
    }
    
    setLoading(true);
    addLog('📤 Envoi d\'une notification de test...');
    
    try {
      console.log('[FCM DEBUG] Importing NotificationService...');
      // Utiliser le service de notification mis à jour
      const { NotificationService } = await import('../services/notification/notification.service');
      console.log('[FCM DEBUG] NotificationService imported, calling sendNotification...');
      
      // Temporairement définir le token pour ce test
      const originalToken = localStorage.getItem('fcm_token');
      localStorage.setItem('fcm_token', tokenToUse);
      
      await NotificationService.sendNotification(
        'Test FCM Debugger',
        'Ceci est une notification de test depuis le FCM Debugger'
      );
      
      // Restaurer le token original
      if (originalToken) {
        localStorage.setItem('fcm_token', originalToken);
      } else {
        localStorage.removeItem('fcm_token');
      }
      
      addLog('✅ Notification de test envoyée avec succès');
      console.log('[FCM DEBUG] Notification sent successfully');
    } catch (error) {
      console.error('[FCM DEBUG] Error sending notification:', error);
      addLog(`❌ Erreur lors de l'envoi de la notification: ${error}`);
    } finally {
      setLoading(false);
      addLog('🔄 Test terminé');
    }
  };

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      width: '400px', 
      background: 'white', 
      border: '1px solid #ccc', 
      borderRadius: '8px', 
      padding: '16px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      zIndex: 9999,
      fontSize: '12px'
    }}>
      <h3 style={{ margin: '0 0 16px 0', color: '#333' }}>🔧 FCM Debugger</h3>
      
      <div style={{ marginBottom: '16px' }}>
        <strong>Utilisateur:</strong> {user ? user.email : 'Non connecté'}
      </div>
      
      <div style={{ marginBottom: '16px' }}>
        <strong>Token local:</strong> 
        <div style={{ wordBreak: 'break-all', fontSize: '10px' }}>
          {fcmToken ? (fcmToken.length > 30 ? `${fcmToken.substring(0, 30)}...` : fcmToken) : 'Aucun'}
        </div>
      </div>
      
      <div style={{ marginBottom: '16px' }}>
        <strong>Tokens en DB:</strong> {dbTokens.length}
        {dbTokens.map((token, index) => (
          <div key={index} style={{ fontSize: '10px', marginLeft: '8px' }}>
            • {token.token.substring(0, 20)}... ({token.platform})
          </div>
        ))}
      </div>
      
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button 
          onClick={requestPermission} 
          disabled={loading}
          style={{ padding: '4px 8px', fontSize: '10px' }}
        >
          Demander Permission
        </button>
        <button 
          onClick={registerToken} 
          disabled={loading || !fcmToken}
          style={{ padding: '4px 8px', fontSize: '10px' }}
        >
          Enregistrer Token
        </button>
        <button 
          onClick={testUpsertFunction} 
          disabled={loading || !user}
          style={{ padding: '4px 8px', fontSize: '10px' }}
        >
          Test Upsert
        </button>
        <button 
          onClick={loadUserData}
          style={{ padding: '4px 8px', fontSize: '10px' }}
        >
          Rafraîchir
        </button>
        <button 
          onClick={clearLogs}
          style={{ padding: '4px 8px', fontSize: '10px' }}
        >
          Clear Logs
        </button>
        <button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[FCM DEBUG] Button clicked - event fired');
            testNotification();
          }}
          disabled={loading}
          style={{ 
            padding: '6px 12px', 
            fontSize: '11px', 
            backgroundColor: loading ? '#ccc' : '#4CAF50', 
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          {loading ? 'Envoi...' : 'Test Notification'}
        </button>
      </div>
      
      <div style={{ 
        maxHeight: '200px', 
        overflowY: 'auto', 
        background: '#f5f5f5', 
        padding: '8px', 
        borderRadius: '4px',
        fontSize: '10px',
        fontFamily: 'monospace'
      }}>
        <strong>Logs:</strong>
        {logs.map((log, index) => (
          <div key={index}>{log}</div>
        ))}
        {logs.length === 0 && <div style={{ color: '#666' }}>Aucun log</div>}
      </div>
    </div>
  );
};