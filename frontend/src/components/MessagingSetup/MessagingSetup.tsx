import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Button,
  Paper,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import { WhatsAppService, WhatsAppConfig } from '../../services/chat/whatsapp.service';
import { LodgifyService, LodgifyConfig } from '../../services/chat/lodgify.service';
import { MessagingConfigService, MessagingChannel } from '../../services/messaging-config.service';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import BusinessIcon from '@mui/icons-material/Business';
import { supabase } from '../../lib/supabase';

interface MessagingSetupProps {
  onConfigSaved?: () => void;
}

const MessagingSetup: React.FC<MessagingSetupProps> = ({ onConfigSaved }) => {
  const [preferredChannel, setPreferredChannel] = useState<MessagingChannel>('whatsapp');
  const [whatsappConfig, setWhatsappConfig] = useState<Partial<WhatsAppConfig>>({
    phone_number_id: '',
    token: ''
  });
  const [lodgifyConfig, setLodgifyConfig] = useState<Partial<LodgifyConfig>>({
    api_key: '',
    api_url: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
 


  useEffect(() => {
    loadConfigurations();
  }, []);

  const loadConfigurations = async () => {
    try {
      setInitialLoading(true);
      
      // Load messaging channel preference
      const messagingConfig = await MessagingConfigService.getConfig();
      if (messagingConfig) {
        setPreferredChannel(messagingConfig.preferred_channel);
      }

      // Load WhatsApp config
      const whatsappData = await WhatsAppService.getConfig();
      if (whatsappData) {
        setWhatsappConfig({
          phone_number_id: whatsappData.phone_number_id,
          token: whatsappData.token
        });
      }

      // Load Lodgify config
      const lodgifyData = await LodgifyService.getConfig();
      if (lodgifyData) {
        setLodgifyConfig({
          api_key: lodgifyData.api_key,
          api_url: lodgifyData.api_url || ''
        });
      }
    } catch (error) {
      console.error('Error loading configurations:', error);
      setMessage({ type: 'error', text: 'Erreur lors du chargement des configurations' });
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSaveConfiguration = async () => {
    setLoading(true);
    setMessage(null);

    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Non authentifié');
      }
      const hostId = session.user.id;

      // Save messaging channel preference
      const messagingConfigSaved = await MessagingConfigService.saveConfig({
        preferred_channel: preferredChannel
      }, hostId);

      if (!messagingConfigSaved) {
        throw new Error('Erreur lors de la sauvegarde de la préférence de canal');
      }

      // Save WhatsApp config if it's the preferred channel and has data
      if (preferredChannel === 'whatsapp' && (whatsappConfig.phone_number_id || whatsappConfig.token)) {
        const whatsappSaved = await WhatsAppService.saveConfig(whatsappConfig);
        if (!whatsappSaved) {
          throw new Error('Erreur lors de la sauvegarde de la configuration WhatsApp');
        }
      }

      // Save Lodgify config if it's the preferred channel and has data
      if (preferredChannel === 'lodgify' && lodgifyConfig.api_key) {
        const lodgifySaved = await LodgifyService.saveConfig(lodgifyConfig,hostId);
        if (!lodgifySaved) {
          throw new Error('Erreur lors de la sauvegarde de la configuration Lodgify');
        }

        // Setup webhooks automatically when Lodgify config is saved
        console.log('Setting up Lodgify webhooks...');
        try {
          // Add timeout to prevent hanging
          const webhookPromise = LodgifyService.setupWebhooks(hostId, lodgifyConfig.api_key);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Webhook setup timeout')), 30000)
          );
          
          const webhookResult = await Promise.race([webhookPromise, timeoutPromise]) as any;
          
          if (!webhookResult.success) {
            console.warn('Webhook setup failed:', webhookResult.error);
            // Don't throw error - config is saved, webhooks can be retried later
          } else {
            console.log('Webhooks configured successfully:', webhookResult.webhooks);
          }
        } catch (webhookError) {
          console.error('Webhook setup error (non-blocking):', webhookError);
          // Continue execution - webhook failure shouldn't prevent config save
          // Don't let webhook errors crash the page
        }
      }

      setMessage({ type: 'success', text: 'Configuration sauvegardée avec succès!' });
      
      // Emit custom event to notify other components of configuration change
      window.dispatchEvent(new CustomEvent('messaging-config-changed', {
        detail: { preferredChannel }
      }));
      
      if (onConfigSaved) {
        onConfigSaved();
      }
    } catch (error) {
      console.error('Error saving configuration:', error);
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Erreur lors de la sauvegarde' 
      });
    } finally {
      setLoading(false);
    }
  };

  const isConfigurationValid = () => {
    if (preferredChannel === 'whatsapp') {
      return whatsappConfig.phone_number_id && whatsappConfig.token;
    } else if (preferredChannel === 'lodgify') {
      return lodgifyConfig.api_key;
    }
    return false;
  };

  if (initialLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Configuration de la messagerie
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Choisissez votre canal de messagerie préféré et configurez les paramètres correspondants.
      </Typography>

      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}

      <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
        <FormControl component="fieldset" fullWidth>
          <FormLabel component="legend" sx={{ mb: 2 }}>
            Canal de messagerie préféré
          </FormLabel>
          <RadioGroup
            value={preferredChannel}
            onChange={(e) => setPreferredChannel(e.target.value as MessagingChannel)}
          >
            <FormControlLabel
              value="whatsapp"
              control={<Radio />}
              label={
                <Box display="flex" alignItems="center">
                  <WhatsAppIcon sx={{ mr: 1, color: '#25D366' }} />
                  WhatsApp Business
                </Box>
              }
            />
            <FormControlLabel
              value="lodgify"
              control={<Radio />}
              label={
                <Box display="flex" alignItems="center">
                  <BusinessIcon sx={{ mr: 1, color: '#1976d2' }} />
                  Lodgify
                </Box>
              }
            />
          </RadioGroup>
        </FormControl>
      </Paper>

      {preferredChannel === 'whatsapp' && (
        <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom display="flex" alignItems="center">
            <WhatsAppIcon sx={{ mr: 1, color: '#25D366' }} />
            Configuration WhatsApp Business
          </Typography>
          <Divider sx={{ mb: 2 }} />
          
          <TextField
            fullWidth
            label="Phone Number ID"
            value={whatsappConfig.phone_number_id || ''}
            onChange={(e) => setWhatsappConfig(prev => ({ ...prev, phone_number_id: e.target.value }))}
            margin="normal"
            helperText="ID du numéro de téléphone WhatsApp Business"
          />
          
          <TextField
            fullWidth
            label="Access Token"
            type="password"
            value={whatsappConfig.token || ''}
            onChange={(e) => setWhatsappConfig(prev => ({ ...prev, token: e.target.value }))}
            margin="normal"
            helperText="Token d'accès WhatsApp Business API"
          />
        </Paper>
      )}

      {preferredChannel === 'lodgify' && (
        <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom display="flex" alignItems="center">
            <BusinessIcon sx={{ mr: 1, color: '#1976d2' }} />
            Configuration Lodgify
          </Typography>
          <Divider sx={{ mb: 2 }} />
          
          <TextField
            fullWidth
            label="API Key"
            type="password"
            value={lodgifyConfig.api_key || ''}
            onChange={(e) => setLodgifyConfig(prev => ({ ...prev, api_key: e.target.value }))}
            margin="normal"
            helperText="Clé API Lodgify"
          />
          
          <TextField
            fullWidth
            label="API URL (optionnel)"
            value={lodgifyConfig.api_url || ''}
            onChange={(e) => setLodgifyConfig(prev => ({ ...prev, api_url: e.target.value }))}
            margin="normal"
            helperText="URL de l'API Lodgify (laissez vide pour utiliser l'URL par défaut)"
          />
        </Paper>
      )}

      <Box display="flex" justifyContent="flex-end">
        <Button
          variant="contained"
          onClick={handleSaveConfiguration}
          disabled={loading || !isConfigurationValid()}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {loading ? 'Sauvegarde...' : 'Sauvegarder la configuration'}
        </Button>
      </Box>
    </Box>
  );
};

export default MessagingSetup;
