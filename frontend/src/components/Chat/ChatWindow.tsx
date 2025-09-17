import React, { useState, useCallback, useEffect } from 'react';
import { 
  Box, 
  IconButton, 
  Card, 
  Typography, 
  Divider,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Snackbar,
  Alert
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt';
import SignalCellularConnectedNoInternet0BarIcon from '@mui/icons-material/SignalCellularConnectedNoInternet0Bar';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import PaletteIcon from '@mui/icons-material/Palette';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import HotelIcon from '@mui/icons-material/Hotel';

import ChatMessages from './ChatMessages';
import ChatInput from './ChatInput';
import AIResponseModal from '../AIResponseModal';
import TemplateMenu from './ChatTemplates/TemplateMenu';
import { useMessagesRealtime } from '../../hooks/useMessagesRealtime';
import { useMessageSender } from '../../hooks/useMessageSender';
import { useTemplates } from '../../hooks/useTemplates';
import { useEmergencyAnalysis } from '../../hooks/useEmergencyAnalysis';
import { TemplateService, Template } from '../../services/chat/template.service';
import { UnifiedMessagingService } from '../../services/unified-messaging.service';
import { LodgifyService } from '../../services/chat/lodgify.service';

// Préfixe pour les logs liés à ce composant
const DEBUG_PREFIX = 'DEBUG_CHAT_WINDOW';

interface ChatWindowProps {
  conversationId: string;
  whatsappContactId?: string;
  guestName?: string;
  isMobile?: boolean;
  apartmentId?: string; // ID de l'appartement pour les requêtes IA
}

export default function ChatWindow({ conversationId, whatsappContactId, guestName, isMobile = false, apartmentId }: ChatWindowProps) {
  // États locaux
  const [messageInput, setMessageInput] = useState('');
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [templatesMenuAnchorEl, setTemplatesMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  const [conversationChannel, setConversationChannel] = useState<'whatsapp' | 'lodgify' | null>(null);
  // const [lodgifyInfo, setLodgifyInfo] = useState<any>(null);
  
  // Utilisation des hooks personnalisés
  const { 
    messages, 
    realtimeStatus, 
    refreshing, 
    isPollingActive, 
    forceRefresh 
  } = useMessagesRealtime(conversationId, apartmentId);
  
  const { sendMessage, sending, error: sendError } = useMessageSender();
  const { templates } = useTemplates();
  
  // Hook pour l'analyse d'urgence automatique
  useEmergencyAnalysis(conversationId);
  
  // Detect conversation channel on mount and when conversation changes
  useEffect(() => {
    const detectChannel = async () => {
      if (conversationId) {
        try {
          console.log(`${DEBUG_PREFIX} Détection du canal pour conversation:`, conversationId);
          
          // Debug: Check if conversation is linked to Lodgify
          const isLinked = await LodgifyService.isConversationLinkedToLodgify(conversationId);
          console.log(`${DEBUG_PREFIX} Conversation liée à Lodgify:`, isLinked);
          
          const channel = await UnifiedMessagingService.detectConversationChannel(conversationId);
          console.log(`${DEBUG_PREFIX} Canal détecté:`, channel);
          setConversationChannel(channel);
          
          if (channel === 'lodgify') {
            const info = await LodgifyService.getLodgifyBookingInfo(conversationId);
            console.log(`${DEBUG_PREFIX} Info Lodgify:`, info);
            // setLodgifyInfo(info);
          } 
          // else {
          //   // Clear Lodgify info if not a Lodgify conversation
          //   // setLodgifyInfo(null);
          // }
        } catch (error) {
          console.error('Error detecting conversation channel:', error);
          setConversationChannel('whatsapp'); // Default fallback
          // setLodgifyInfo(null);
        }
      }
    };
    
    detectChannel();
  }, [conversationId]);

  // Listen for configuration changes and re-detect channel if needed
  useEffect(() => {
    const handleConfigChange = () => {
      // Re-detect channel when configuration might have changed
      if (conversationId) {
        const detectChannel = async () => {
          try {
            const channel = await UnifiedMessagingService.detectConversationChannel(conversationId);
            console.log(`${DEBUG_PREFIX} Canal re-détecté après changement de config:`, channel);
            setConversationChannel(channel);
            
            if (channel === 'lodgify') {
              await LodgifyService.getLodgifyBookingInfo(conversationId);
              // const info = await LodgifyService.getLodgifyBookingInfo(conversationId);
              // setLodgifyInfo(info);
            } 
            // else {
            //   // setLodgifyInfo(null);
            // }
          } catch (error) {
            console.error('Error re-detecting conversation channel:', error);
          }
        };
        
        detectChannel();
      }
    };

    // Listen for custom events that indicate configuration changes
    window.addEventListener('messaging-config-changed', handleConfigChange);
    
    return () => {
      window.removeEventListener('messaging-config-changed', handleConfigChange);
    };
  }, [conversationId]);
  
  // Gestionnaire pour l'envoi de message
  const handleSendMessage = useCallback(async (messageToSend: string = messageInput) => {
    const contentToSend = messageToSend.trim();
    if (!contentToSend) return;
    
    try {
      console.log(`${DEBUG_PREFIX} Envoi du message: ${contentToSend}`);
      console.log(`${DEBUG_PREFIX} ID WhatsApp utilisé: ${whatsappContactId || 'NON DÉFINI'}`);
      
      const sentMessage = await sendMessage(
        contentToSend,
        conversationId,
        whatsappContactId
      );
      
      if (sentMessage) {
        console.log(`${DEBUG_PREFIX} Message envoyé avec succès:`, sentMessage);
        setMessageInput('');
      }
    } catch (error) {
      console.error(`${DEBUG_PREFIX} Erreur lors de l'envoi du message:`, error);
    }
  }, [messageInput, conversationId, whatsappContactId, sendMessage]);
  
  // Cette fonction est gérée par le composant ChatInput
  // Aucun gestionnaire handleKeyPress direct n'est nécessaire ici
  
  // Gestionnaire pour la sélection d'un template (copier son contenu dans le champ de message)
  const handleTemplateSelect = useCallback((template: Template) => {
    setMessageInput(template.content);
    setTemplatesMenuAnchorEl(null);
  }, []);
  
  // Gestionnaire pour l'envoi d'un template WhatsApp
  const handleSendWhatsAppTemplate = useCallback(async (template: Template) => {
    if (!whatsappContactId) {
      setSnackbarMessage('Impossible d\'envoyer le template : numéro WhatsApp manquant');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }
    
    try {
      console.log(`${DEBUG_PREFIX} Envoi du template WhatsApp:`, {
        template_name: template.name,
        to: whatsappContactId
      });
      
      await TemplateService.sendTemplate(conversationId, whatsappContactId, template);
      
      setSnackbarMessage('Template WhatsApp envoyé avec succès');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      
      // Force le rafraîchissement des messages pour voir le template envoyé
      forceRefresh();
    } catch (error) {
      console.error(`${DEBUG_PREFIX} Erreur lors de l'envoi du template WhatsApp:`, error);
      setSnackbarMessage(
        `Erreur lors de l'envoi du template: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
      );
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  }, [conversationId, whatsappContactId, forceRefresh]);
  
  // Cette fonctionnalité est déléguée au composant ChatInput
  
  // Fonctions pour les menus
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchorEl(event.currentTarget);
  };
  
  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };
  
  const handleTemplatesMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setTemplatesMenuAnchorEl(event.currentTarget);
    // Fermer le menu principal
    handleMenuClose();
  };
  
  const handleTemplatesMenuClose = () => {
    setTemplatesMenuAnchorEl(null);
  };
  
  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };
  
  // Fonctions pour le modal IA
  const handleOpenAIModal = () => {
    setAiModalOpen(true);
  };
  
  const handleCloseAIModal = () => {
    setAiModalOpen(false);
  };
  
  const handleGeneratedResponse = (response: string) => {
    // Fermer le modal
    setAiModalOpen(false);
    // Effacer le champ de saisie (car on envoie directement)
    setMessageInput('');
    // Appeler directement la fonction d'envoi avec la réponse générée
    handleSendMessage(response);
  };
  
  // Déterminer l'icône et la couleur en fonction du statut de connexion
  const connectionStatusIcon = realtimeStatus === 'SUBSCRIBED'
    ? <SignalCellularAltIcon sx={{ fontSize: 16, color: 'success.main' }} />
    : <SignalCellularConnectedNoInternet0BarIcon sx={{ fontSize: 16, color: 'warning.main' }} />;
  
  const connectionStatusText = realtimeStatus === 'SUBSCRIBED'
    ? 'Realtime'
    : isPollingActive ? 'Polling' : 'Déconnecté';
  
  const connectionStatusColor = realtimeStatus === 'SUBSCRIBED'
    ? 'success'
    : isPollingActive ? 'warning' : 'error';

  console.log(`${DEBUG_PREFIX} Rendu avec ${messages.length} messages, status: ${realtimeStatus}, isMobile: ${isMobile}`);
  
  return (
    <Card sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      borderRadius: 1,
      ...(isMobile ? { boxShadow: 'none' } : {})
    }}>
      {/* En-tête de la conversation */}
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="h6" component="div">
            {guestName || 'Conversation'}
          </Typography>
          <Chip
            size="small"
            icon={connectionStatusIcon}
            label={connectionStatusText}
            color={connectionStatusColor}
            variant="outlined"
            sx={{ ml: 2, height: 24 }}
          />
          {conversationChannel && (
            <Chip
              size="small"
              icon={conversationChannel === 'lodgify' ? <HotelIcon /> : <WhatsAppIcon />}
              label={conversationChannel === 'lodgify' ? 'Lodgify' : 'WhatsApp'}
              color={conversationChannel === 'lodgify' ? 'primary' : 'success'}
              variant="filled"
              sx={{ ml: 1, height: 24 }}
            />
          )}
        </Box>
        <Box>
          <IconButton 
            size="small" 
            onClick={forceRefresh}
            disabled={refreshing}
            title="Rafraîchir les messages"
          >
            {refreshing ? (
              <CircularProgress size={20} />
            ) : (
              <RefreshIcon fontSize="small" />
            )}
          </IconButton>
          <IconButton size="small" onClick={handleMenuOpen}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
      
      <Divider />
      
      {/* Zone de messages */}
      <Box sx={{ 
        flexGrow: 1, 
        overflow: 'auto', 
        p: 2,
        display: 'flex',
        flexDirection: 'column'
      }}>
        <ChatMessages 
          messages={messages}
          isInitialLoad={true}
          conversationId={conversationId}
        />
      </Box>
      
      <Divider />
      
      {/* Zone de saisie de message - Utilisation de ChatInput */}
      <Box sx={{ bgcolor: 'background.default' }}>
        <ChatInput
          onSendMessage={async (message) => {
            // Passage direct du message à handleSendMessage pour éviter le problème de timing du state
            await handleSendMessage(message);
            // On met quand même à jour le state pour garder une cohérence
            setMessageInput('');
          }}
          onOpenAIModal={handleOpenAIModal}
          onOpenTemplates={handleTemplatesMenuOpen}
          disabled={sending}
          sending={sending}
        />
        
        {sendError && (
          <Typography variant="caption" color="error" sx={{ px: 2, pb: 1, display: 'block' }}>
            {sendError}
          </Typography>
        )}
      </Box>
      
      {/* Menu d'options */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleTemplatesMenuOpen}>
          <ListItemIcon>
            <FormatListBulletedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Modèles de message</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon>
            <PaletteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Personnaliser</ListItemText>
        </MenuItem>
      </Menu>
      
      {/* Menu des templates avec la nouvelle interface */}
      <TemplateMenu
        anchorEl={templatesMenuAnchorEl}
        open={Boolean(templatesMenuAnchorEl)}
        onClose={handleTemplatesMenuClose}
        templates={templates}
        onSelectTemplate={handleTemplateSelect}
        onSendWhatsAppTemplate={handleSendWhatsAppTemplate}
        whatsappContactId={whatsappContactId}
      />
      
      {/* Notification pour l'envoi de template */}
      <Snackbar 
        open={snackbarOpen} 
        autoHideDuration={6000} 
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleSnackbarClose} 
          severity={snackbarSeverity} 
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
      
      {/* Modal pour la génération de réponse IA */}
      <AIResponseModal
        open={aiModalOpen}
        onClose={handleCloseAIModal}
        onResponseGenerated={handleGeneratedResponse}
        conversationId={conversationId}
        guestName={guestName || ''}
        apartmentId={apartmentId} // Transmettre l'ID de l'appartement
      />
    </Card>
  );
}
