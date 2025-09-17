import React from 'react';
import { Chip } from '@mui/material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import HotelIcon from '@mui/icons-material/Hotel';

interface ConversationChannelIndicatorProps {
  hasLodgifyBookingId: boolean;
  size?: 'small' | 'medium';
}

export const ConversationChannelIndicator: React.FC<ConversationChannelIndicatorProps> = ({ 
  hasLodgifyBookingId, 
  size = 'small' 
}) => {
  if (hasLodgifyBookingId) {
    return (
      <Chip
        size={size}
        icon={<HotelIcon />}
        label="Lodgify"
        color="primary"
        variant="outlined"
        sx={{ height: size === 'small' ? 20 : 24 }}
      />
    );
  }

  return (
    <Chip
      size={size}
      icon={<WhatsAppIcon />}
      label="WhatsApp"
      color="success"
      variant="outlined"
      sx={{ height: size === 'small' ? 20 : 24 }}
    />
  );
};

export default ConversationChannelIndicator;
