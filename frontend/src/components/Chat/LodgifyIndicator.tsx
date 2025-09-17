import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';

interface LodgifyIndicatorProps {
  isLodgifyConversation: boolean;
  size?: 'small' | 'medium';
}

const LodgifyIndicator: React.FC<LodgifyIndicatorProps> = ({ 
  isLodgifyConversation, 
  size = 'small' 
}) => {
  if (isLodgifyConversation) {
    return (
      <Tooltip title="Conversation Lodgify">
        <Chip
          icon={<BusinessIcon />}
          label="Lodgify"
          size={size}
          color="primary"
          variant="outlined"
          sx={{
            backgroundColor: '#e3f2fd',
            borderColor: '#1976d2',
            color: '#1976d2',
            '& .MuiChip-icon': {
              color: '#1976d2'
            }
          }}
        />
      </Tooltip>
    );
  }

  return (
    <Tooltip title="Conversation WhatsApp">
      <Chip
        icon={<WhatsAppIcon />}
        label="WhatsApp"
        size={size}
        color="success"
        variant="outlined"
        sx={{
          backgroundColor: '#e8f5e8',
          borderColor: '#25D366',
          color: '#25D366',
          '& .MuiChip-icon': {
            color: '#25D366'
          }
        }}
      />
    </Tooltip>
  );
};

export default LodgifyIndicator;
