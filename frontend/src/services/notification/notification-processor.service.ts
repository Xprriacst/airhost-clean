// Service de traitement des notifications
export class NotificationProcessorService {
  static startProcessing(interval: number) {
    console.log('Démarrage du traitement des notifications, intervalle:', interval);
  }

  static stopProcessing() {
    console.log('Arrêt du traitement des notifications');
  }
}