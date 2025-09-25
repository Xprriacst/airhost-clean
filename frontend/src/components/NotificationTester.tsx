import React, { useState, useEffect } from 'react';
import { Button, Alert, Box, Typography, Paper, CircularProgress, Chip } from '@mui/material';
import { MobileNotificationService } from '../services/notification/mobile-notification.service';
import { requestFCMPermission, refreshFCMToken } from '../lib/firebase';
import { supabase } from '../lib/supabase';

/**
 * Composant de test des notifications FCM
 * Permet de tester l'enregistrement des tokens et l'envoi des notifications
 */
const NotificationTester: React.FC = () => {
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [dbToken, setDbToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [forceRealToken, setForceRealToken] = useState<boolean>(
    localStorage.getItem('forceRealToken') === 'true'
  );

  // Charger les données initiales
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Récupérer le token depuis le localStorage
        const storedToken = localStorage.getItem('fcm_token');
        if (storedToken) {
          setToken(storedToken);
        }
        
        // Récupérer l'utilisateur actuel
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          setUser(currentUser);
          
          // Vérifier si le token est enregistré dans Supabase
          const { data } = await supabase
            .from('push_subscriptions')
            .select('token')
            .eq('user_id', currentUser.id)
            .single();
            
          if (data) {
            setDbToken(data.token);
          }
        }
      } catch (err) {
        console.error('Erreur lors du chargement des données initiales:', err);
      }
    };
    
    loadInitialData();
  }, []);

  // Demander la permission et obtenir un token FCM
  const requestPermission = async () => {
    setLoading(true);
    setError(null);
    setStatus('Demande de permission...');
    
    try {
      const newToken = await requestFCMPermission();
      if (newToken) {
        setToken(newToken);
        setStatus('Permission accordée, token obtenu');
        
        // Enregistrer le token
        await MobileNotificationService.registerToken(newToken);
        setStatus('Token enregistré avec succès');
        
        // Rafraîchir le token dans la base de données
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          const { data } = await supabase
            .from('push_subscriptions')
            .select('token')
            .eq('user_id', currentUser.id)
            .single();
            
          if (data) {
            setDbToken(data.token);
          }
        }
      } else {
        setError('Impossible d\'obtenir un token FCM');
      }
    } catch (err: any) {
      setError(`Erreur: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Refresh FCM token (useful when token becomes invalid)
  const handleRefreshToken = async () => {
    setLoading(true);
    setError(null);
    setStatus('Refreshing FCM token...');
    
    try {
      const newToken = await refreshFCMToken();
      if (newToken) {
        setToken(newToken);
        setStatus('New FCM token obtained successfully');
        
        // Register the new token
        await MobileNotificationService.registerToken(newToken);
        setStatus('New token registered successfully');
        
        // Update the database token display
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          const { data } = await supabase
            .from('push_subscriptions')
            .select('token')
            .eq('user_id', currentUser.id)
            .single();
            
          if (data) {
            setDbToken(data.token);
          }
        }
      } else {
        setError('Failed to refresh FCM token');
      }
    } catch (err: any) {
      setError(`Error refreshing token: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Toggle force real token mode
  const toggleForceRealToken = () => {
    const newValue = !forceRealToken;
    setForceRealToken(newValue);
    localStorage.setItem('forceRealToken', newValue.toString());
    setStatus(`Force real token mode: ${newValue ? 'ENABLED' : 'DISABLED'}. Refresh tokens to apply.`);
  };

  // Tester l'envoi d'une notification
  const testNotification = async () => {
    setLoading(true);
    setError(null);
    setStatus('Envoi de la notification de test...');
    
    try {
      // Utiliser le token actuel ou un token de test
      const targetToken = token || 'test-fcm-token';
      
      // Créer le payload de la notification
      const payload = {
        fcmToken: targetToken,
        notification: {
          title: 'Test de notification',
          body: `Test envoyé à ${new Date().toLocaleTimeString()}`,
          icon: '/logo192.png'
        },
        data: {
          timestamp: Date.now(),
          testId: Math.random().toString(36).substring(2, 10)
        }
      };
      
      // Utiliser supabase.functions.invoke pour appeler l'Edge Function
      const { data: result, error: functionError } = await supabase.functions.invoke('fcm-proxy', {
        body: payload
      });
      
      if (functionError) {
        throw new Error(`Erreur de fonction: ${functionError.message}`);
      }
      setStatus(`Notification envoyée avec succès: ${result.success ? 'OK' : 'Échec'}`);
    } catch (err: any) {
      setError(`Erreur: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 3, maxWidth: 600, margin: '0 auto', mt: 4 }}>
      <Typography variant="h5" gutterBottom>
        Testeur de Notifications FCM
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1">Statut utilisateur:</Typography>
        <Chip 
          label={user ? `Connecté (${user.email})` : 'Non connecté'} 
          color={user ? 'success' : 'error'} 
          sx={{ mr: 1 }}
        />
      </Box>
      
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1">Statut du token FCM:</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Chip 
            label={token ? 'Token local: Présent' : 'Token local: Absent'} 
            color={token ? 'success' : 'error'} 
          />
          <Chip 
            label={dbToken ? 'Token DB: Présent' : 'Token DB: Absent'} 
            color={dbToken ? 'success' : 'error'} 
          />
          <Chip 
            label={token && dbToken && token === dbToken ? 'Tokens synchronisés' : 'Tokens non synchronisés'} 
            color={token && dbToken && token === dbToken ? 'success' : 'warning'} 
          />
          <Chip 
            label={token && token.startsWith('mock-') ? 'Token: Mock' : token ? 'Token: Real' : 'Token: None'} 
            color={token && token.startsWith('mock-') ? 'warning' : token ? 'success' : 'error'} 
          />
          <Chip 
            label={`Force Real Token: ${forceRealToken ? 'ON' : 'OFF'}`} 
            color={forceRealToken ? 'info' : 'default'} 
          />
        </Box>
      </Box>
      
      {token && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2">Token:</Typography>
          <Typography variant="caption" component="div" sx={{ 
            wordBreak: 'break-all', 
            backgroundColor: '#f5f5f5', 
            p: 1, 
            borderRadius: 1 
          }}>
            {token && token.length > 24 
              ? token.substring(0, 12) + '...' + token.substring(token.length - 12)
              : token || 'Token non disponible'
            }
          </Typography>
        </Box>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {status && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {status}
        </Alert>
      )}
      
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Button 
          variant="contained" 
          onClick={requestPermission} 
          disabled={loading}
          color="primary"
        >
          {loading ? <CircularProgress size={24} /> : 'Demander les permissions'}
        </Button>
        
        <Button 
          variant="outlined" 
          onClick={handleRefreshToken} 
          disabled={loading || !token}
          color="warning"
        >
          {loading ? <CircularProgress size={24} /> : 'Refresh Token'}
        </Button>
        
        <Button 
          variant="outlined" 
          onClick={toggleForceRealToken} 
          disabled={loading}
          color={forceRealToken ? 'info' : 'default'}
        >
          {forceRealToken ? 'Disable' : 'Enable'} Real Token
        </Button>
        
        <Button 
          variant="contained" 
          onClick={testNotification} 
          disabled={loading}
          color="secondary"
        >
          {loading ? <CircularProgress size={24} /> : 'Tester notification'}
        </Button>
      </Box>
    </Paper>
  );
};

export default NotificationTester;
