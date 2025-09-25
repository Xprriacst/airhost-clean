/**
 * Device Cleanup Service
 * Manages cleanup of inactive devices and old FCM tokens
 */

import { supabase } from '../lib/supabase';
import { getDeviceInfo, updateDeviceActivity } from '../utils/device-fingerprint';

export interface DeviceCleanupStats {
  totalDevices: number;
  activeDevices: number;
  inactiveDevices: number;
  cleanedDevices: number;
}

export class DeviceCleanupService {
  private static readonly INACTIVE_DAYS_THRESHOLD = 30;
  private static readonly CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
  private static cleanupTimer: NodeJS.Timeout | null = null;

  /**
   * Initialize the device cleanup service
   */
  static async init(): Promise<void> {
    console.log('[DEVICE_CLEANUP] Initializing device cleanup service');
    
    // Update current device activity
    updateDeviceActivity();
    
    // Start periodic cleanup
    this.startPeriodicCleanup();
    
    // Clean up on page visibility change (when user returns to app)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        updateDeviceActivity();
        this.performCleanup();
      }
    });
    
    console.log('[DEVICE_CLEANUP] Device cleanup service initialized');
  }

  /**
   * Start periodic cleanup of inactive devices
   */
  private static startPeriodicCleanup(): void {
    // Clear existing timer if any
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Set up periodic cleanup
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.CLEANUP_INTERVAL_MS);

    console.log('[DEVICE_CLEANUP] Periodic cleanup started (every 24 hours)');
  }

  /**
   * Stop periodic cleanup
   */
  static stopPeriodicCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      console.log('[DEVICE_CLEANUP] Periodic cleanup stopped');
    }
  }

  /**
   * Perform cleanup of inactive devices
   */
  static async performCleanup(): Promise<DeviceCleanupStats | null> {
    try {
      console.log('[DEVICE_CLEANUP] Starting device cleanup...');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('[DEVICE_CLEANUP] User not authenticated, skipping cleanup');
        return null;
      }

      // Get cleanup stats before cleanup
      const statsBefore = await this.getDeviceStats(user.id);
      
      // Perform cleanup using the database function
      const { data, error } = await supabase.rpc('cleanup_inactive_devices', {
        p_inactive_days: this.INACTIVE_DAYS_THRESHOLD
      });

      if (error) {
        console.error('[DEVICE_CLEANUP] Error during cleanup:', error);
        return null;
      }

      // Get stats after cleanup
      const statsAfter = await this.getDeviceStats(user.id);
      
      const cleanupStats: DeviceCleanupStats = {
        totalDevices: statsBefore.totalDevices,
        activeDevices: statsAfter.activeDevices,
        inactiveDevices: statsBefore.inactiveDevices,
        cleanedDevices: data || 0
      };

      console.log('[DEVICE_CLEANUP] Cleanup completed:', cleanupStats);
      return cleanupStats;
    } catch (error) {
      console.error('[DEVICE_CLEANUP] Error during cleanup:', error);
      return null;
    }
  }

  /**
   * Get device statistics for a user
   */
  static async getDeviceStats(userId: string): Promise<Omit<DeviceCleanupStats, 'cleanedDevices'>> {
    try {
      // Get total devices
      const { count: totalDevices } = await supabase
        .from('push_subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Get active devices (last 30 days)
      const { count: activeDevices } = await supabase
        .from('push_subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('last_active', new Date(Date.now() - this.INACTIVE_DAYS_THRESHOLD * 24 * 60 * 60 * 1000).toISOString());

      return {
        totalDevices: totalDevices || 0,
        activeDevices: activeDevices || 0,
        inactiveDevices: (totalDevices || 0) - (activeDevices || 0)
      };
    } catch (error) {
      console.error('[DEVICE_CLEANUP] Error getting device stats:', error);
      return {
        totalDevices: 0,
        activeDevices: 0,
        inactiveDevices: 0
      };
    }
  }

  /**
   * Get all active devices for the current user
   */
  static async getUserActiveDevices(): Promise<any[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('[DEVICE_CLEANUP] User not authenticated');
        return [];
      }

      const { data, error } = await supabase.rpc('get_user_active_devices', {
        p_user_id: user.id,
        p_platform: 'fcm'
      });

      if (error) {
        console.error('[DEVICE_CLEANUP] Error getting active devices:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[DEVICE_CLEANUP] Error getting active devices:', error);
      return [];
    }
  }

  /**
   * Manually remove a specific device
   */
  static async removeDevice(deviceId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('[DEVICE_CLEANUP] User not authenticated');
        return false;
      }

      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('device_id', deviceId);

      if (error) {
        console.error('[DEVICE_CLEANUP] Error removing device:', error);
        return false;
      }

      console.log('[DEVICE_CLEANUP] Device removed successfully:', deviceId);
      return true;
    } catch (error) {
      console.error('[DEVICE_CLEANUP] Error removing device:', error);
      return false;
    }
  }

  /**
   * Update the current device's activity timestamp
   */
  static async updateCurrentDeviceActivity(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return;
      }

      const deviceInfo = getDeviceInfo();
      
      const { error } = await supabase
        .from('push_subscriptions')
        .update({ 
          last_active: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('device_id', deviceInfo.deviceId);

      if (error) {
        console.error('[DEVICE_CLEANUP] Error updating device activity:', error);
      } else {
        console.log('[DEVICE_CLEANUP] Device activity updated for:', deviceInfo.deviceId);
      }
    } catch (error) {
      console.error('[DEVICE_CLEANUP] Error updating device activity:', error);
    }
  }

  /**
   * Get cleanup configuration
   */
  static getCleanupConfig() {
    return {
      inactiveDaysThreshold: this.INACTIVE_DAYS_THRESHOLD,
      cleanupIntervalMs: this.CLEANUP_INTERVAL_MS,
      isRunning: this.cleanupTimer !== null
    };
  }

  /**
   * Force cleanup with custom parameters
   */
  static async forceCleanup(inactiveDays: number = this.INACTIVE_DAYS_THRESHOLD): Promise<DeviceCleanupStats | null> {
    try {
      console.log(`[DEVICE_CLEANUP] Force cleanup with ${inactiveDays} days threshold`);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('[DEVICE_CLEANUP] User not authenticated');
        return null;
      }

      const statsBefore = await this.getDeviceStats(user.id);
      
      const { data, error } = await supabase.rpc('cleanup_inactive_devices', {
        p_inactive_days: inactiveDays
      });

      if (error) {
        console.error('[DEVICE_CLEANUP] Error during force cleanup:', error);
        return null;
      }

      const statsAfter = await this.getDeviceStats(user.id);
      
      const cleanupStats: DeviceCleanupStats = {
        totalDevices: statsBefore.totalDevices,
        activeDevices: statsAfter.activeDevices,
        inactiveDevices: statsBefore.inactiveDevices,
        cleanedDevices: data || 0
      };

      console.log('[DEVICE_CLEANUP] Force cleanup completed:', cleanupStats);
      return cleanupStats;
    } catch (error) {
      console.error('[DEVICE_CLEANUP] Error during force cleanup:', error);
      return null;
    }
  }
}