import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Divider,
  Chip
} from '@mui/material';
import { LodgifyService } from '../../services/chat/lodgify.service';
import { UnifiedMessagingService } from '../../services/unified-messaging.service';
import { MessagingConfigService } from '../../services/messaging-config.service';
import SendIcon from '@mui/icons-material/Send';
import BusinessIcon from '@mui/icons-material/Business';

interface LodgifyTestPanelProps {
  conversationId?: string;
}

const LodgifyTestPanel: React.FC<LodgifyTestPanelProps> = ({ conversationId }) => {
  const [testMessage, setTestMessage] = useState('');
  const [testConversationId, setTestConversationId] = useState(conversationId || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentChannel, setCurrentChannel] = useState<string>('');

  React.useEffect(() => {
    loadCurrentChannel();
  }, []);

  const loadCurrentChannel = async () => {
    try {
      const channel = await MessagingConfigService.getPreferredChannel();
      setCurrentChannel(channel);
    } catch (err) {
      console.error('Error loading current channel:', err);
    }
  };

  const testLodgifyConnection = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const config = await LodgifyService.getConfig();
      if (!config) {
        throw new Error('Configuration Lodgify non trouvée');
      }

      setResult({
        type: 'config',
        data: {
          hasApiKey: !!config.api_key,
          apiUrl: config.api_url || 'URL par défaut',
          message: 'Configuration Lodgify trouvée'
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  const testSendMessage = async () => {
    if (!testMessage || !testConversationId) {
      setError('Message et ID de conversation requis');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Test if conversation is linked to Lodgify
      const isLinked = await LodgifyService.isConversationLinkedToLodgify(testConversationId);
      if (!isLinked) {
        throw new Error('Cette conversation n\'est pas liée à Lodgify');
      }

      // Send message via unified service
      const response = await UnifiedMessagingService.sendMessage('', testMessage, testConversationId);
      
      if (response.success) {
        setResult({
          type: 'message',
          data: {
            success: true,
            messageId: response.message_id,
            message: 'Message envoyé avec succès via Lodgify'
          }
        });
      } else {
        throw new Error(response.error || 'Erreur lors de l\'envoi');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  const testConversationInfo = async () => {
    if (!testConversationId) {
      setError('ID de conversation requis');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const info = await LodgifyService.getLodgifyBookingInfo(testConversationId);
      const isLinked = await LodgifyService.isConversationLinkedToLodgify(testConversationId);

      setResult({
        type: 'info',
        data: {
          isLinked,
          bookingInfo: info,
          message: isLinked ? 'Conversation liée à Lodgify' : 'Conversation non liée à Lodgify'
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 2 }}>
      <Box display="flex" alignItems="center" mb={2}>
        <BusinessIcon sx={{ mr: 1, color: '#1976d2' }} />
        <Typography variant="h6">
          Test Lodgify Integration
        </Typography>
        <Chip
          label={`Canal actuel: ${currentChannel}`}
          size="small"
          color={currentChannel === 'lodgify' ? 'primary' : 'default'}
          sx={{ ml: 2 }}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {result && (
        <Alert severity="success" sx={{ mb: 2 }}>
          <Typography variant="subtitle2">{result.data.message}</Typography>
          {result.type === 'config' && (
            <Box mt={1}>
              <Typography variant="body2">
                API Key: {result.data.hasApiKey ? '✓ Configurée' : '✗ Manquante'}
              </Typography>
              <Typography variant="body2">
                API URL: {result.data.apiUrl}
              </Typography>
            </Box>
          )}
          {result.type === 'message' && (
            <Typography variant="body2">
              Message ID: {result.data.messageId}
            </Typography>
          )}
          {result.type === 'info' && (
            <Box mt={1}>
              <Typography variant="body2">
                Statut: {result.data.isLinked ? '✓ Liée' : '✗ Non liée'}
              </Typography>
              {result.data.bookingInfo && (
                <Typography variant="body2">
                  Booking ID: {result.data.bookingInfo.lodgify_booking_id}
                </Typography>
              )}
            </Box>
          )}
        </Alert>
      )}

      <Box display="flex" gap={2} mb={2}>
        <Button
          variant="outlined"
          onClick={testLodgifyConnection}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : <BusinessIcon />}
        >
          Tester Configuration
        </Button>
      </Box>

      <Divider sx={{ my: 2 }} />

      <TextField
        fullWidth
        label="ID de Conversation"
        value={testConversationId}
        onChange={(e) => setTestConversationId(e.target.value)}
        margin="normal"
        helperText="ID de la conversation à tester"
      />

      <Box display="flex" gap={2} mb={2}>
        <Button
          variant="outlined"
          onClick={testConversationInfo}
          disabled={loading || !testConversationId}
        >
          Vérifier Liaison Lodgify
        </Button>
      </Box>

      <TextField
        fullWidth
        label="Message de Test"
        value={testMessage}
        onChange={(e) => setTestMessage(e.target.value)}
        margin="normal"
        multiline
        rows={3}
        helperText="Message à envoyer via Lodgify"
      />

      <Box display="flex" justifyContent="flex-end" mt={2}>
        <Button
          variant="contained"
          onClick={testSendMessage}
          disabled={loading || !testMessage || !testConversationId}
          startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
        >
          Envoyer via Lodgify
        </Button>
      </Box>
    </Paper>
  );
};

export default LodgifyTestPanel;
