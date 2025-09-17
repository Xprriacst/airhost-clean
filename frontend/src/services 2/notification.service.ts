// Service de notification (services 2)
export class NotificationService {
  static async notifyNewMessage(data: any) {
    console.log('Nouvelle notification de message (services 2):', data);
  }
   static async requestPermission() {
    console.log('Requesting notification permission');
    return true
  }

  static async areNotificationsEnabled() {
    console.log('Checking if notifications are enabled');
    return true
  }




  
}