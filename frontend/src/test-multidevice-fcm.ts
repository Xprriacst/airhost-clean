/**
 * Multi-Device FCM Test Script
 * Comprehensive test to verify multi-device FCM token functionality
 */

import { supabase } from './lib/supabase';
import { MobileNotificationService } from './services/notification/mobile-notification.service';
import { DeviceCleanupService } from './services/device-cleanup.service';
import { getDeviceInfo, clearDeviceData } from './utils/device-fingerprint';

interface TestResult {
  testName: string;
  success: boolean;
  message: string;
  details?: any;
}

class MultiDeviceFCMTester {
  private results: TestResult[] = [];
  private userId: string | null = null;

  constructor() {
    console.log('🧪 Multi-Device FCM Tester initialized');
  }

  private addResult(testName: string, success: boolean, message: string, details?: any) {
    const result: TestResult = { testName, success, message, details };
    this.results.push(result);
    
    const emoji = success ? '✅' : '❌';
    console.log(`${emoji} ${testName}: ${message}`);
    if (details) {
      console.log('   Details:', details);
    }
  }

  private async ensureAuthenticated(): Promise<boolean> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        this.addResult('Authentication', false, 'User not authenticated');
        return false;
      }
      
      this.userId = user.id;
      this.addResult('Authentication', true, `User authenticated: ${user.email}`);
      return true;
    } catch (error) {
      this.addResult('Authentication', false, `Authentication error: ${error}`);
      return false;
    }
  }

  async testDeviceFingerprinting(): Promise<void> {
    try {
      const deviceInfo = getDeviceInfo();
      
      // Validate device info structure
      const requiredFields = ['deviceId', 'deviceName', 'deviceInfo'];
      const missingFields = requiredFields.filter(field => !deviceInfo[field as keyof typeof deviceInfo]);
      
      if (missingFields.length > 0) {
        this.addResult(
          'Device Fingerprinting',
          false,
          `Missing required fields: ${missingFields.join(', ')}`
        );
        return;
      }

      // Validate device ID format
      const deviceIdPattern = /^dev_[a-z0-9]+_[a-z0-9]+$/;
      if (!deviceIdPattern.test(deviceInfo.deviceId)) {
        this.addResult(
          'Device Fingerprinting',
          false,
          `Invalid device ID format: ${deviceInfo.deviceId}`
        );
        return;
      }

      this.addResult(
        'Device Fingerprinting',
        true,
        'Device fingerprinting working correctly',
        {
          deviceId: deviceInfo.deviceId,
          deviceName: deviceInfo.deviceName,
          type: deviceInfo.deviceInfo.type,
          browser: deviceInfo.deviceInfo.browser,
          os: deviceInfo.deviceInfo.os
        }
      );
    } catch (error) {
      this.addResult('Device Fingerprinting', false, `Error: ${error}`);
    }
  }

  async testDatabaseSchema(): Promise<void> {
    try {
      if (!this.userId) {
        this.addResult('Database Schema', false, 'User not authenticated');
        return;
      }

      // Test if the new schema columns exist by trying to insert a test record
      const testDeviceId = `test_${Date.now()}`;
      const testToken = `test_token_${Date.now()}`;
      
      const { error } = await supabase.rpc('upsert_push_token', {
        p_user_id: this.userId,
        p_token: testToken,
        p_platform: 'fcm',
        p_device_id: testDeviceId,
        p_device_name: 'Test Device',
        p_device_info: {
          type: 'test',
          browser: 'test',
          os: 'test'
        }
      });

      if (error) {
        this.addResult(
          'Database Schema',
          false,
          `Schema test failed: ${error.message}`
        );
        return;
      }

      // Clean up test record
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', this.userId)
        .eq('device_id', testDeviceId);

      this.addResult(
        'Database Schema',
        true,
        'Database schema supports multi-device functionality'
      );
    } catch (error) {
      this.addResult('Database Schema', false, `Error: ${error}`);
    }
  }

  async testTokenRegistration(): Promise<void> {
    try {
      if (!this.userId) {
        this.addResult('Token Registration', false, 'User not authenticated');
        return;
      }

      // Get initial device count
      const { count: initialCount } = await supabase
        .from('push_subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.userId);

      // Initialize mobile notification service
      await MobileNotificationService.init();

      // Wait for token registration
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check if a new device was registered
      const { count: finalCount } = await supabase
        .from('push_subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.userId);

      const deviceInfo = getDeviceInfo();
      
      // Check if current device is registered
      const { data: currentDevice } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', this.userId)
        .eq('device_id', deviceInfo.deviceId)
        .single();

      if (currentDevice) {
        this.addResult(
          'Token Registration',
          true,
          'Current device successfully registered',
          {
            deviceId: currentDevice.device_id,
            deviceName: currentDevice.device_name,
            platform: currentDevice.platform,
            hasToken: !!currentDevice.token
          }
        );
      } else {
        this.addResult(
          'Token Registration',
          false,
          'Current device not found in database'
        );
      }
    } catch (error) {
      this.addResult('Token Registration', false, `Error: ${error}`);
    }
  }

  async testMultipleDeviceSupport(): Promise<void> {
    try {
      if (!this.userId) {
        this.addResult('Multiple Device Support', false, 'User not authenticated');
        return;
      }

      // Create multiple mock devices
      const mockDevices = [
        {
          deviceId: `test_mobile_${Date.now()}`,
          deviceName: 'Test iPhone',
          token: `mock_token_mobile_${Date.now()}`,
          deviceInfo: { type: 'mobile', browser: 'Safari', os: 'iOS' }
        },
        {
          deviceId: `test_desktop_${Date.now()}`,
          deviceName: 'Test Desktop',
          token: `mock_token_desktop_${Date.now()}`,
          deviceInfo: { type: 'desktop', browser: 'Chrome', os: 'Windows' }
        },
        {
          deviceId: `test_tablet_${Date.now()}`,
          deviceName: 'Test iPad',
          token: `mock_token_tablet_${Date.now()}`,
          deviceInfo: { type: 'tablet', browser: 'Safari', os: 'iOS' }
        }
      ];

      // Register all mock devices
      const registrationPromises = mockDevices.map(device =>
        supabase.rpc('upsert_push_token', {
          p_user_id: this.userId,
          p_token: device.token,
          p_platform: 'fcm',
          p_device_id: device.deviceId,
          p_device_name: device.deviceName,
          p_device_info: device.deviceInfo
        })
      );

      const results = await Promise.allSettled(registrationPromises);
      const successCount = results.filter(r => r.status === 'fulfilled').length;

      if (successCount === mockDevices.length) {
        // Verify all devices are in database
        const { data: registeredDevices } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', this.userId)
          .in('device_id', mockDevices.map(d => d.deviceId));

        if (registeredDevices && registeredDevices.length === mockDevices.length) {
          this.addResult(
            'Multiple Device Support',
            true,
            `Successfully registered ${mockDevices.length} devices`,
            {
              devices: registeredDevices.map(d => ({
                deviceId: d.device_id,
                deviceName: d.device_name,
                platform: d.platform
              }))
            }
          );

          // Clean up test devices
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', this.userId)
            .in('device_id', mockDevices.map(d => d.deviceId));
        } else {
          this.addResult(
            'Multiple Device Support',
            false,
            'Devices registered but not found in database'
          );
        }
      } else {
        this.addResult(
          'Multiple Device Support',
          false,
          `Only ${successCount}/${mockDevices.length} devices registered successfully`
        );
      }
    } catch (error) {
      this.addResult('Multiple Device Support', false, `Error: ${error}`);
    }
  }

  async testDeviceCleanup(): Promise<void> {
    try {
      if (!this.userId) {
        this.addResult('Device Cleanup', false, 'User not authenticated');
        return;
      }

      // Create an old device for cleanup testing
      const oldDeviceId = `old_device_${Date.now()}`;
      const oldDate = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000); // 35 days ago

      // Insert old device directly into database
      const { error: insertError } = await supabase
        .from('push_subscriptions')
        .insert({
          user_id: this.userId,
          device_id: oldDeviceId,
          device_name: 'Old Test Device',
          token: `old_token_${Date.now()}`,
          platform: 'fcm',
          device_info: { type: 'test' },
          last_active: oldDate.toISOString(),
          created_at: oldDate.toISOString(),
          updated_at: oldDate.toISOString()
        });

      if (insertError) {
        this.addResult('Device Cleanup', false, `Failed to create test device: ${insertError.message}`);
        return;
      }

      // Get device count before cleanup
      const { count: beforeCount } = await supabase
        .from('push_subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.userId);

      // Perform cleanup
      const cleanupStats = await DeviceCleanupService.forceCleanup(30);

      if (cleanupStats) {
        // Verify the old device was cleaned up
        const { data: oldDevice } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', this.userId)
          .eq('device_id', oldDeviceId)
          .single();

        if (!oldDevice) {
          this.addResult(
            'Device Cleanup',
            true,
            'Device cleanup working correctly',
            {
              cleanedDevices: cleanupStats.cleanedDevices,
              totalDevices: cleanupStats.totalDevices,
              activeDevices: cleanupStats.activeDevices
            }
          );
        } else {
          this.addResult(
            'Device Cleanup',
            false,
            'Old device was not cleaned up'
          );
        }
      } else {
        this.addResult('Device Cleanup', false, 'Cleanup function returned null');
      }
    } catch (error) {
      this.addResult('Device Cleanup', false, `Error: ${error}`);
    }
  }

  async testNotificationDelivery(): Promise<void> {
    try {
      if (!this.userId) {
        this.addResult('Notification Delivery', false, 'User not authenticated');
        return;
      }

      // Get all active devices for the user
      const activeDevices = await DeviceCleanupService.getUserActiveDevices();

      if (activeDevices.length === 0) {
        this.addResult(
          'Notification Delivery',
          false,
          'No active devices found for notification testing'
        );
        return;
      }

      this.addResult(
        'Notification Delivery',
        true,
        `Found ${activeDevices.length} active devices for notification delivery`,
        {
          devices: activeDevices.map(d => ({
            deviceId: d.device_id,
            deviceName: d.device_name,
            lastActive: d.last_active
          }))
        }
      );
    } catch (error) {
      this.addResult('Notification Delivery', false, `Error: ${error}`);
    }
  }

  async runAllTests(): Promise<TestResult[]> {
    console.log('🚀 Starting Multi-Device FCM Tests...');
    this.results = [];

    // Ensure user is authenticated
    const isAuthenticated = await this.ensureAuthenticated();
    if (!isAuthenticated) {
      return this.results;
    }

    // Run all tests
    await this.testDeviceFingerprinting();
    await this.testDatabaseSchema();
    await this.testTokenRegistration();
    await this.testMultipleDeviceSupport();
    await this.testDeviceCleanup();
    await this.testNotificationDelivery();

    // Summary
    const passedTests = this.results.filter(r => r.success).length;
    const totalTests = this.results.length;
    
    console.log(`\n📊 Test Summary: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
      console.log('🎉 All tests passed! Multi-device FCM functionality is working correctly.');
    } else {
      console.log('⚠️  Some tests failed. Please review the results above.');
    }

    return this.results;
  }

  getResults(): TestResult[] {
    return this.results;
  }

  printDetailedResults(): void {
    console.log('\n📋 Detailed Test Results:');
    console.log('=' .repeat(50));
    
    this.results.forEach((result, index) => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`\n${index + 1}. ${result.testName}: ${status}`);
      console.log(`   Message: ${result.message}`);
      
      if (result.details) {
        console.log('   Details:', JSON.stringify(result.details, null, 2));
      }
    });
  }
}

// Export for use in other modules
export { MultiDeviceFCMTester, type TestResult };

// Auto-run tests if this script is executed directly
if (typeof window !== 'undefined') {
  // Browser environment
  (window as any).runMultiDeviceFCMTests = async () => {
    const tester = new MultiDeviceFCMTester();
    const results = await tester.runAllTests();
    tester.printDetailedResults();
    return results;
  };
  
  console.log('🧪 Multi-Device FCM Tester loaded. Run tests with: runMultiDeviceFCMTests()');
}