// Service de gestion des conversations
export class ConversationService {
  static async createConversation(data: any) {
    console.log('Création de conversation:', data);
    return { id: 'new-conversation-id',conversation: data , isNew: true};
  }
}