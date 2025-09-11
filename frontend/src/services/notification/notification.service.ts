// Service de notification simple
export class NotificationService {
  static async init() {
    console.log('Initialisation du service de notification');
    return true;
  }

  static async sendNotification(title: string, body: string) {
    console.log('Notification:', title, body);
  }

  static async notifyNewMessage(data: any) {
    console.log('Nouvelle notification de message:', data);
  }
}