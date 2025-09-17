# Lodgify Webhook Integration

This Edge Function handles webhooks from Lodgify to automatically create conversations and process guest messages.

## Supported Webhook Events

### 1. `booking_change`
Automatically creates a new conversation for any booking status change.

**Webhook Payload Example:**
```json
{
  "action": "booking_change",
  "booking": {
    "id": 123456,
    "date_arrival": "2022-05-21T00:00:00",
    "date_departure": "2022-05-24T00:00:00",
    "property_id": 10000,
    "property_name": "Amazing Property on the Beach",
    "status": "Booked"
  },
  "guest": {
    "name": "John Doe",
    "email": "johndoe@lodgify.com",
    "phone_number": "667675867768"
  }
}
```

### 2. `guest_message_received`
Adds incoming guest messages to existing conversations.

**Webhook Payload Example:**
```json
{
  "action": "guest_message_received",
  "thread_uid": "dd51acc0-ebfb-4659-a6b3-0072538dbfaf",
  "message_id": 12345678,
  "guest_name": "John Doe",
  "message": "Hello, I have a question about my booking",
  "creation_time": "2024-01-30T14:15:00+00:00"
}
```

## Setup

### 1. Environment Variables
Configure these environment variables in your Supabase project:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
LODGIFY_WEBHOOK_SECRET=your_lodgify_webhook_secret (optional)
```

### 2. Database Schema
Run the migration to add Lodgify integration columns:

```sql
-- Properties table
ALTER TABLE properties ADD COLUMN lodgify_property_id INTEGER UNIQUE;

-- Conversations table
ALTER TABLE conversations ADD COLUMN lodgify_booking_id INTEGER UNIQUE;
ALTER TABLE conversations ADD COLUMN lodgify_thread_uid TEXT;

-- Messages table
ALTER TABLE messages ADD COLUMN lodgify_message_id TEXT UNIQUE;
```

### 3. Lodgify Configuration
1. In your Lodgify dashboard, go to Settings > Webhooks
2. Add a new webhook endpoint: `https://your-project.supabase.co/functions/v1/lodgify-webhook`
3. Select events: `booking_change` and `guest_message_received`
4. Configure webhook secret for security (recommended)

### 4. Property Mapping
Ensure your properties in the database have the corresponding `lodgify_property_id`:

```sql
UPDATE properties 
SET lodgify_property_id = YOUR_LODGIFY_PROPERTY_ID 
WHERE id = 'your-property-uuid';
```

## Workflow

### Booking Flow
1. Guest makes a booking on Lodgify
2. Booking status changes (any status)
3. Lodgify sends `booking_change` webhook
4. Function creates new conversation with:
   - Guest details (name, phone, email)
   - Property information
   - Check-in/check-out dates
   - Lodgify booking ID for reference
5. System message is created documenting the booking

### Message Exchange Flow
1. Guest sends message through Lodgify
2. Lodgify sends `guest_message_received` webhook
3. Function finds conversation by `thread_uid`
4. Message is added to conversation
5. Conversation metadata is updated (last message, unread count)

### Outbound Messages
Use the `lodgify-send-message` function to send replies back to Lodgify:

```typescript
const response = await supabase.functions.invoke('lodgify-send-message', {
  body: {
    conversation_id: 'uuid',
    message: 'Hello! Thank you for your booking.',
    message_type: 'text'
  }
});
```

## Security

### Webhook Signature Verification
If `LODGIFY_WEBHOOK_SECRET` is configured, the function will verify webhook signatures using HMAC-SHA256.

Lodgify should send the signature in the `x-lodgify-signature` header as:
```
sha256=<hex_encoded_signature>
```

### Error Handling
- Invalid signatures return 401 Unauthorized
- Missing required data logs errors but doesn't fail
- Database errors are logged and handled gracefully
- Unknown webhook actions are logged and ignored

## Monitoring

Check the Edge Function logs for:
- Successful webhook processing
- Error messages and debugging info
- Conversation creation confirmations
- Message processing status

## Integration with Frontend

Use the `LodgifyService` in your frontend to:
- Send messages to Lodgify
- Check if conversations are linked to Lodgify
- Get Lodgify booking information

```typescript
import LodgifyService from '../services/lodgify/lodgify.service';

// Send message to Lodgify
const result = await LodgifyService.sendMessage({
  conversation_id: conversationId,
  message: 'Your message here'
});

// Check if conversation is linked to Lodgify
const isLinked = await LodgifyService.isConversationLinkedToLodgify(conversationId);
```