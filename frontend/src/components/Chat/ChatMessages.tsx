import { useEffect, useRef, useState } from 'react';
import { Box, Typography, Paper, Chip, Avatar, Tooltip, useTheme, CircularProgress } from '@mui/material';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Message } from '../../services/chat/message.service';
import { supabase } from '../../lib/supabase';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import HelpIcon from '@mui/icons-material/Help';
import HomeIcon from '@mui/icons-material/Home';

// Préfixe pour les logs liés à ce composant
const DEBUG_PREFIX = 'DEBUG_CHAT_MESSAGES';

interface EmergencyAnalysis {
  id: string;
  conversation_id: string;
  message_content: string;
  is_emergency: boolean;
  emergency_type: 'critical_emergency' | 'ai_uncertain' | 'customer_dissatisfied' | 'accommodation_issue' | null;
  confidence_score: number;
  analysis_result: any;
  created_at: string;
}

interface EnrichedMessage extends Message {
  isEmergency?: boolean;
  emergencyType?: string;
  emergencyAnalysis?: EmergencyAnalysis;
}

interface ChatMessagesProps {
  messages: Message[];
  isInitialLoad: boolean;
  conversationId?: string;
}

export default function ChatMessages({ messages, isInitialLoad, conversationId }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(isInitialLoad);
  const [enrichedMessages, setEnrichedMessages] = useState<EnrichedMessage[]>([]);
  const theme = useTheme();
  
  // Log important pour déboguer
  console.log(`${DEBUG_PREFIX} Re-rendu avec ${messages.length} messages`);
  
  // Afficher les IDs des 5 premiers messages pour débogage
  if (messages.length > 0) {
    const messagesToLog = messages.slice(0, Math.min(5, messages.length));
    console.log(`${DEBUG_PREFIX} Premiers messages:`, messagesToLog.map(m => ({ id: m.id, content: m.content })));
  }

  // Fonction pour récupérer les analyses d'urgence
  const fetchEmergencyAnalyses = async () => {
    if (!conversationId || messages.length === 0) {
      setEnrichedMessages(messages);
      return;
    }

    console.log(`${DEBUG_PREFIX} Récupération des analyses d'urgence pour la conversation ${conversationId}`);
    
    try {
      // Récupération des analyses associées à cette conversation
      const { data: analyses, error } = await supabase
        .from('conversation_analyses')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error(`${DEBUG_PREFIX} Erreur lors de la récupération des analyses:`, error);
        setEnrichedMessages(messages);
        return;
      }

      console.log(`${DEBUG_PREFIX} ${analyses?.length || 0} analyses trouvées`);
      
      // Enrichissement des messages avec les informations d'urgence
      const enriched = messages.map(msg => {
        // Match le message avec son analyse d'urgence
        const analysis = analyses?.find((a: EmergencyAnalysis) => 
          (msg.content && a.message_content && 
           (msg.content.includes(a.message_content) || 
            a.message_content.includes(msg.content)))
        );
        
        return {
          ...msg,
          isEmergency: analysis?.is_emergency || false,
          emergencyType: analysis?.emergency_type || undefined,
          emergencyAnalysis: analysis
        } as EnrichedMessage;
      });

      console.log(`${DEBUG_PREFIX} Messages enrichis:`, enriched.filter(m => m.isEmergency));
      setEnrichedMessages(enriched);
    } catch (error) {
      console.error(`${DEBUG_PREFIX} Erreur lors de l'enrichissement des messages:`, error);
      setEnrichedMessages(messages);
    }
  };

  // Effet pour récupérer les analyses d'urgence quand les messages changent
  useEffect(() => {
    fetchEmergencyAnalyses();
  }, [messages, conversationId]);

  // Fonction pour obtenir l'icône d'urgence appropriée
  const getEmergencyIcon = (emergencyType: string) => {
    switch (emergencyType) {
      case 'critical_emergency':
        return <ErrorIcon sx={{ color: 'error.main', fontSize: 16 }} />;
      case 'ai_uncertain':
        return <HelpIcon sx={{ color: 'warning.main', fontSize: 16 }} />;
      case 'customer_dissatisfied':
        return <WarningIcon sx={{ color: 'warning.main', fontSize: 16 }} />;
      case 'accommodation_issue':
        return <HomeIcon sx={{ color: 'info.main', fontSize: 16 }} />;
      default:
        return <WarningIcon sx={{ color: 'warning.main', fontSize: 16 }} />;
    }
  };

  // Fonction pour obtenir le texte d'urgence
  const getEmergencyText = (emergencyType: string) => {
    switch (emergencyType) {
      case 'critical_emergency':
        return 'Urgence critique';
      case 'ai_uncertain':
        return 'IA incertaine';
      case 'customer_dissatisfied':
        return 'Client mécontent';
      case 'accommodation_issue':
        return 'Problème logement';
      default:
        return 'Situation à surveiller';
    }
  };

  // Fonction pour formater la date du message
  const formatMessageDate = (date: string): string => {
    try {
      const messageDate = new Date(date);
      if (isToday(messageDate)) {
        return "Aujourd'hui";
      } else if (isYesterday(messageDate)) {
        return "Hier";
      } else {
        return format(messageDate, 'EEEE d MMMM', { locale: fr });
      }
    } catch (error) {
      console.error(`${DEBUG_PREFIX} Erreur lors du formatage de la date:`, error, date);
      return 'Date inconnue';
    }
  };

  // Défilement automatique vers le bas
  const scrollToBottom = (instant = false) => {
    try {
      messagesEndRef.current?.scrollIntoView({
        behavior: instant ? 'auto' : 'smooth'
      });
    } catch (error) {
      console.error(`${DEBUG_PREFIX} Erreur lors du défilement:`, error);
    }
  };

  // Effet pour le défilement automatique
  useEffect(() => {
    console.log(`${DEBUG_PREFIX} useEffect déclenché - messages.length: ${messages.length}, isInitialLoad: ${isInitialLoad}`);
    
    if (messages.length > 0) {
      if (isInitialLoad) {
        console.log(`${DEBUG_PREFIX} Chargement initial - défilement immédiat`);
        scrollToBottom(true);
        // Délai pour simuler le chargement et améliorer l'UX
        const timer = setTimeout(() => {
          setLoading(false);
        }, 500);
        return () => clearTimeout(timer);
      } else {
        const scrollContainer = messagesEndRef.current?.parentElement;
        if (scrollContainer) {
          try {
            const isAtBottom = Math.abs(
              (scrollContainer.scrollHeight - scrollContainer.scrollTop) - scrollContainer.clientHeight
            ) < 50;
            
            console.log(`${DEBUG_PREFIX} État du défilement:`, { 
              scrollHeight: scrollContainer.scrollHeight,
              scrollTop: scrollContainer.scrollTop,
              clientHeight: scrollContainer.clientHeight,
              isAtBottom
            });
            
            if (isAtBottom) {
              scrollToBottom();
            }
          } catch (error) {
            console.error(`${DEBUG_PREFIX} Erreur lors du calcul de la position de défilement:`, error);
          }
        }
      }
    }
  }, [messages, isInitialLoad]);

  // Fonction pour créer des groupes de messages par date
  const createMessageGroups = () => {
    const messagesToRender = enrichedMessages.length > 0 ? enrichedMessages : messages;
    console.log(`${DEBUG_PREFIX} Création des groupes de messages, ${messagesToRender.length} messages`); 
    
    if (!Array.isArray(messagesToRender)) {
      console.error(`${DEBUG_PREFIX} messages n'est pas un tableau:`, messagesToRender);
      return [];
    }
    
    try {
      return messagesToRender.reduce((messageGroups: React.ReactNode[], message, index) => {
        // Vérifier que le message est valide
        if (!message || !message.created_at) {
          console.error(`${DEBUG_PREFIX} Message invalide:`, message);
          return messageGroups;
        }
        
        // Vérifier si un nouveau groupe de date est nécessaire
        const showDateSeparator = index === 0 || !isSameDay(
          new Date(message.created_at),
          new Date(messagesToRender[index - 1].created_at)
        );
        
        // Si nécessaire, ajouter un séparateur de date
        if (showDateSeparator) {
          messageGroups.push(
            <Box 
              key={`date-${message.id}`} 
              sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                mb: 3, 
                mt: index > 0 ? 3 : 1,
                position: 'relative'
              }}
            >
              <Chip
                label={formatMessageDate(message.created_at)}
                size="small"
                sx={{ 
                  backgroundColor: theme.palette.background.paper,
                  color: theme.palette.text.secondary,
                  fontWeight: 500,
                  boxShadow: theme.shadows[1],
                  zIndex: 1
                }}
              />
            </Box>
          );
        }
        
        // Ajouter le message actuel au groupe
        const isInbound = message.direction === 'inbound';
        
        messageGroups.push(
          <Box 
            key={message.id} 
            sx={{
              display: 'flex',
              justifyContent: isInbound ? 'flex-start' : 'flex-end',
              mb: 1
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: isInbound ? 'row' : 'row-reverse',
                alignItems: 'flex-end',
                maxWidth: '75%'
              }}
            >
              {isInbound && (
                <Avatar 
                  sx={{ 
                    width: 32, 
                    height: 32, 
                    ml: isInbound ? 0 : 1,
                    mr: isInbound ? 1 : 0,
                    bgcolor: theme.palette.primary.light
                  }}
                >
                  G
                </Avatar>
              )}

              <Box sx={{ position: 'relative' }}>
                <Tooltip 
                  title={format(new Date(message.created_at), 'HH:mm')}
                  placement={isInbound ? 'right' : 'left'}
                  arrow
                >
                  <Paper
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      maxWidth: '100%',
                      backgroundColor: isInbound 
                        ? theme.palette.background.paper
                        : theme.palette.primary.main,
                      color: isInbound
                        ? theme.palette.text.primary
                        : theme.palette.primary.contrastText,
                      wordBreak: 'break-word',
                      boxShadow: theme.shadows[1],
                      opacity: loading ? 0.7 : 1,
                      transform: `translateY(${loading ? '10px' : '0'})`,
                      transition: 'opacity 0.3s ease, transform 0.3s ease',
                      border: (message as EnrichedMessage).isEmergency ? 
                        `2px solid ${theme.palette.warning.main}` : 'none'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <Typography variant="body1" sx={{ flex: 1 }}>
                        {message.content}
                      </Typography>
                      {(message as EnrichedMessage).isEmergency && (message as EnrichedMessage).emergencyType && (
                        <Tooltip 
                          title={`${getEmergencyText((message as EnrichedMessage).emergencyType!)} - Confiance: ${Math.round(((message as EnrichedMessage).emergencyAnalysis?.confidence_score || 0) * 100)}%`}
                          arrow
                        >
                          <Box sx={{ ml: 1, display: 'flex', alignItems: 'center' }}>
                            {getEmergencyIcon((message as EnrichedMessage).emergencyType!)}
                          </Box>
                        </Tooltip>
                      )}
                    </Box>
                  </Paper>
                </Tooltip>
              </Box>
            </Box>
          </Box>
        );
        
        return messageGroups;
      }, []);
    } catch (error) {
      console.error(`${DEBUG_PREFIX} Erreur dans createMessageGroups:`, error);
      return [];
    }
  };
  
  // Générer les groupes de messages
  const messageElements = createMessageGroups();

  return (
    <Box>
      {messages.length === 0 ? (
        // Affichage d'un message lorsqu'il n'y a pas de conversations
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center',
          height: '100%',
          p: 3,
          my: 4
        }}>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
            Aucun message
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center">
            Envoyez un message pour démarrer la conversation
          </Typography>
        </Box>
      ) : (
        // Affichage des messages
        <Box sx={{ width: '100%' }}>
          {/* Debug info pour visualiser les problèmes */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, mb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              {`${messages.length} messages chargés`}
            </Typography>
          </Box>
          
          {/* Afficher les éléments de message */}
          {messageElements.length > 0 ? (
            messageElements
          ) : (
            // Afficher un message de débogage si les éléments ne sont pas générés alors que des messages existent
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="error">
                Problème d'affichage - {messages.length} messages en mémoire
              </Typography>
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress size={20} />
              </Box>
            </Box>
          )}
          
          <div ref={messagesEndRef} />
        </Box>
      )}
    </Box>
  );
}
