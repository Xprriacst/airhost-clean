import { useState, useEffect } from 'react';
import { UnifiedMessagingService } from '../services/unified-messaging.service';
import { LodgifyService } from '../services/chat/lodgify.service';

export type ConversationChannel = 'whatsapp' | 'lodgify' | null;

export interface ConversationChannelInfo {
  channel: ConversationChannel;
  lodgifyInfo?: any;
  loading: boolean;
  error?: string;
}

export function useConversationChannel(conversationId: string): ConversationChannelInfo {
  const [channel, setChannel] = useState<ConversationChannel>(null);
  const [lodgifyInfo, setLodgifyInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const detectChannel = async () => {
      if (!conversationId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(undefined);

        const detectedChannel = await UnifiedMessagingService.detectConversationChannel(conversationId);
        setChannel(detectedChannel);

        if (detectedChannel === 'lodgify') {
          const info = await LodgifyService.getLodgifyBookingInfo(conversationId);
          setLodgifyInfo(info);
        }
      } catch (err) {
        console.error('Error detecting conversation channel:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setChannel('whatsapp'); // Default fallback
      } finally {
        setLoading(false);
      }
    };

    detectChannel();
  }, [conversationId]);

  return {
    channel,
    lodgifyInfo,
    loading,
    error
  };
}
