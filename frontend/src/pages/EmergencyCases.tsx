import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Button
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Help as HelpIcon,
  Home as HomeIcon,
  Refresh as RefreshIcon,
  Chat as ChatIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

interface EmergencyAnalysis {
  id: string;
  conversation_id: string;
  message_content: string;
  is_emergency: boolean;
  emergency_type: 'critical_emergency' | 'ai_uncertain' | 'customer_dissatisfied' | 'accommodation_issue';
  confidence_score: number;
  analysis_result: any;
  created_at: string;
  conversations?: {
    id: string;
    guest_name?: string;
    guest_phone?: string;
    property_id: string;
    properties?: {
      name: string;
    };
  };
}

const EmergencyCases: React.FC = () => {
  const [emergencies, setEmergencies] = useState<EmergencyAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Fonction pour récupérer les cas d'urgence
  const fetchEmergencies = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('conversation_analyses')
        .select(`
          *,
          conversations:conversation_id (
            id,
            guest_name,
            guest_phone,
            property_id,
            properties:property_id (
              name
            )
          )
        `)
        .eq('is_emergency', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (fetchError) {
        throw fetchError;
      }

      console.log('Cas d\'urgence récupérés:', data);
      setEmergencies(data || []);
    } catch (err) {
      console.error('Erreur lors de la récupération des urgences:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmergencies();
  }, []);

  // Fonction pour obtenir l'icône selon le type d'urgence
  const getEmergencyIcon = (type: string) => {
    switch (type) {
      case 'critical_emergency':
        return <ErrorIcon color="error" />;
      case 'ai_uncertain':
        return <HelpIcon color="warning" />;
      case 'customer_dissatisfied':
        return <WarningIcon color="warning" />;
      case 'accommodation_issue':
        return <HomeIcon color="info" />;
      default:
        return <WarningIcon color="warning" />;
    }
  };

  // Fonction pour obtenir le texte du type d'urgence
  const getEmergencyText = (type: string) => {
    switch (type) {
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

  // Fonction pour obtenir la couleur du chip
  const getEmergencyColor = (type: string): 'error' | 'warning' | 'info' | 'default' => {
    switch (type) {
      case 'critical_emergency':
        return 'error';
      case 'ai_uncertain':
      case 'customer_dissatisfied':
        return 'warning';
      case 'accommodation_issue':
        return 'info';
      default:
        return 'default';
    }
  };

  // Fonction pour naviguer vers la conversation
  const goToConversation = (conversationId: string) => {
    navigate(`/chat?conversation=${conversationId}`);
  };

  // Grouper les urgences par type (pour usage futur)
  // const groupedEmergencies = emergencies.reduce((acc, emergency) => {
  //   const type = emergency.emergency_type;
  //   if (!acc[type]) {
  //     acc[type] = [];
  //   }
  //   acc[type].push(emergency);
  //   return acc;
  // }, {} as Record<string, EmergencyAnalysis[]>);

  const emergencyStats = {
    total: emergencies.length,
    critical: emergencies.filter(e => e.emergency_type === 'critical_emergency').length,
    aiUncertain: emergencies.filter(e => e.emergency_type === 'ai_uncertain').length,
    dissatisfied: emergencies.filter(e => e.emergency_type === 'customer_dissatisfied').length,
    accommodation: emergencies.filter(e => e.emergency_type === 'accommodation_issue').length,
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Cas d'urgence
        </Typography>
        <IconButton onClick={fetchEmergencies} disabled={loading}>
          <RefreshIcon />
        </IconButton>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Statistiques */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="text.secondary">
                {emergencyStats.total}
              </Typography>
              <Typography variant="body2">
                Total
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="error.main">
                {emergencyStats.critical}
              </Typography>
              <Typography variant="body2">
                Critiques
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="warning.main">
                {emergencyStats.aiUncertain}
              </Typography>
              <Typography variant="body2">
                IA incertaine
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="warning.main">
                {emergencyStats.dissatisfied}
              </Typography>
              <Typography variant="body2">
                Mécontents
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="info.main">
                {emergencyStats.accommodation}
              </Typography>
              <Typography variant="body2">
                Logement
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Liste des urgences */}
      {emergencies.length === 0 ? (
        <Alert severity="info">
          Aucun cas d'urgence détecté pour le moment.
        </Alert>
      ) : (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Cas d'urgence récents
            </Typography>
            <List>
              {emergencies.map((emergency, index) => (
                <React.Fragment key={emergency.id}>
                  <ListItem>
                    <ListItemIcon>
                      {getEmergencyIcon(emergency.emergency_type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Chip
                            label={getEmergencyText(emergency.emergency_type)}
                            color={getEmergencyColor(emergency.emergency_type)}
                            size="small"
                          />
                          <Chip
                            label={`${Math.round(emergency.confidence_score * 100)}%`}
                            variant="outlined"
                            size="small"
                          />
                          <Typography variant="caption" color="text.secondary">
                            {format(new Date(emergency.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            <strong>Conversation:</strong> {emergency.conversations?.guest_name || 'Client inconnu'} 
                            {emergency.conversations?.properties?.name && (
                              <> - {emergency.conversations.properties.name}</>
                            )}
                          </Typography>
                          <Typography variant="body2" sx={{ 
                            backgroundColor: 'grey.100', 
                            p: 1, 
                            borderRadius: 1,
                            fontStyle: 'italic'
                          }}>
                            "{emergency.message_content}"
                          </Typography>
                          {emergency.analysis_result?.reasoning && (
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                              Analyse: {emergency.analysis_result.reasoning}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<ChatIcon />}
                      onClick={() => goToConversation(emergency.conversation_id)}
                      sx={{ ml: 2 }}
                    >
                      Voir conversation
                    </Button>
                  </ListItem>
                  {index < emergencies.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default EmergencyCases;