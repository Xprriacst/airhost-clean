// Service de notification mobile
export class MobileNotificationService {
  static async init() {
    console.log('Initialisation des notifications mobiles');
    return true;
  }

  static async sendNotification(title: string, body: string) {
    console.log('Notification mobile:', title, body);
  }

  static async sendTestNotification() {
    console.log('Test de notification mobile');
  }

  static async registerToken(token: string) {
    console.log('Enregistrement du token:', token);
  }
}