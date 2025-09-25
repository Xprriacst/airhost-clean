/**
 * Multi-Device Test Panel
 * Component to test and demonstrate multi-device FCM token functionality
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MobileNotificationService } from '../services/notification/mobile-notification.service';
import { DeviceCleanupService, type DeviceCleanupStats } from '../services/device-cleanup.service';
import { getDeviceInfo, clearDeviceData, type DeviceInfo } from '../utils/device-fingerprint';

interface DeviceSubscription {
  id: string;
  device_id: string;
  device_name: string;
  token: string;
  platform: string;
  last_active: string;
  device_info: any;
  created_at: string;
  updated_at: string;
}

export const MultiDeviceTestPanel: React.FC = () => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [devices, setDevices] = useState<DeviceSubscription[]>([]);
  const [cleanupStats, setCleanupStats] = useState<DeviceCleanupStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    initializePanel();
  }, []);

  const initializePanel = async () => {
    try {
      // Get current device info
      const currentDeviceInfo = getDeviceInfo();
      setDeviceInfo(currentDeviceInfo);

      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);

      // Load devices
      await loadDevices();
      
      // Get cleanup stats
      if (currentUser) {
        const stats = await DeviceCleanupService.getDeviceStats(currentUser.id);
        setCleanupStats({ ...stats, cleanedDevices: 0 });
      }
    } catch (error) {
      console.error('Error initializing panel:', error);
      addTestResult(`❌ Error initializing panel: ${error}`);
    }
  };

  const loadDevices = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        addTestResult('❌ User not authenticated');
        return;
      }

      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('last_active', { ascending: false });

      if (error) {
        console.error('Error loading devices:', error);
        addTestResult(`❌ Error loading devices: ${error.message}`);
        return;
      }

      setDevices(data || []);
      addTestResult(`✅ Loaded ${data?.length || 0} devices`);
    } catch (error) {
      console.error('Error loading devices:', error);
      addTestResult(`❌ Error loading devices: ${error}`);
    }
  };

  const addTestResult = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTestResults(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const testDeviceFingerprinting = () => {
    try {
      const info = getDeviceInfo();
      addTestResult(`✅ Device fingerprinting working`);
      addTestResult(`   Device ID: ${info.deviceId}`);
      addTestResult(`   Device Name: ${info.deviceName}`);
      addTestResult(`   Device Type: ${info.deviceInfo.type}`);
      addTestResult(`   Browser: ${info.deviceInfo.browser}`);
      addTestResult(`   OS: ${info.deviceInfo.os}`);
    } catch (error) {
      addTestResult(`❌ Device fingerprinting failed: ${error}`);
    }
  };

  const testTokenRegistration = async () => {
    setIsLoading(true);
    try {
      addTestResult('🔄 Testing FCM token registration...');
      
      // Initialize mobile notification service
      await MobileNotificationService.init();
      addTestResult('✅ MobileNotificationService initialized');
      
      // Wait a bit for token registration
      setTimeout(async () => {
        await loadDevices();
        addTestResult('✅ Token registration test completed');
        setIsLoading(false);
      }, 3000);
    } catch (error) {
      addTestResult(`❌ Token registration failed: ${error}`);
      setIsLoading(false);
    }
  };

  const testMultipleDeviceSimulation = async () => {
    setIsLoading(true);
    try {
      addTestResult('🔄 Simulating multiple devices...');
      
      if (!user) {
        addTestResult('❌ User not authenticated');
        setIsLoading(false);
        return;
      }

      // Simulate 3 different devices
      const mockDevices = [
        {
          deviceId: 'sim_mobile_001',
          deviceName: 'iPhone 13 Pro (Safari)',
          deviceInfo: {
            type: 'mobile',
            browser: 'Safari',
            os: 'iOS',
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
            platform: 'iPhone',
            language: 'en-US',
            screenResolution: '390x844',
            timezone: 'America/New_York',
            timestamp: new Date().toISOString()
          }
        },
        {
          deviceId: 'sim_desktop_001',
          deviceName: 'Windows Desktop (Chrome)',
          deviceInfo: {
            type: 'desktop',
            browser: 'Chrome',
            os: 'Windows',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            platform: 'Win32',
            language: 'en-US',
            screenResolution: '1920x1080',
            timezone: 'America/New_York',
            timestamp: new Date().toISOString()
          }
        },
        {
          deviceId: 'sim_tablet_001',
          deviceName: 'iPad Pro (Safari)',
          deviceInfo: {
            type: 'tablet',
            browser: 'Safari',
            os: 'iOS',
            userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X)',
            platform: 'iPad',
            language: 'en-US',
            screenResolution: '1024x1366',
            timezone: 'America/New_York',
            timestamp: new Date().toISOString()
          }
        }
      ];

      // Register each simulated device
      for (const device of mockDevices) {
        const mockToken = `mock_fcm_token_${device.deviceId}_${Date.now()}`;
        
        const { error } = await supabase.rpc('upsert_push_token', {
          p_user_id: user.id,
          p_token: mockToken,
          p_platform: 'fcm',
          p_device_id: device.deviceId,
          p_device_name: device.deviceName,
          p_device_info: device.deviceInfo
        });

        if (error) {
          addTestResult(`❌ Failed to register ${device.deviceName}: ${error.message}`);
        } else {
          addTestResult(`✅ Registered ${device.deviceName}`);
        }
      }

      // Reload devices to show the new ones
      await loadDevices();
      addTestResult('✅ Multi-device simulation completed');
    } catch (error) {
      addTestResult(`❌ Multi-device simulation failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testCleanup = async () => {
    setIsLoading(true);
    try {
      addTestResult('🔄 Testing device cleanup...');
      
      // Force cleanup with 0 days (clean all devices for testing)
      const stats = await DeviceCleanupService.forceCleanup(0);
      
      if (stats) {
        setCleanupStats(stats);
        addTestResult(`✅ Cleanup completed: ${stats.cleanedDevices} devices removed`);
        await loadDevices();
      } else {
        addTestResult('❌ Cleanup failed');
      }
    } catch (error) {
      addTestResult(`❌ Cleanup test failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const removeDevice = async (deviceId: string) => {
    try {
      const success = await DeviceCleanupService.removeDevice(deviceId);
      if (success) {
        addTestResult(`✅ Device ${deviceId} removed`);
        await loadDevices();
      } else {
        addTestResult(`❌ Failed to remove device ${deviceId}`);
      }
    } catch (error) {
      addTestResult(`❌ Error removing device: ${error}`);
    }
  };

  const clearTestData = () => {
    setTestResults([]);
    addTestResult('🧹 Test results cleared');
  };

  const resetDeviceId = () => {
    clearDeviceData();
    const newDeviceInfo = getDeviceInfo();
    setDeviceInfo(newDeviceInfo);
    addTestResult('🔄 Device ID reset, new ID generated');
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Multi-Device FCM Test Panel</h1>
      
      {/* Current Device Info */}
      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-3">Current Device Information</h2>
        {deviceInfo && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><strong>Device ID:</strong> {deviceInfo.deviceId}</div>
            <div><strong>Device Name:</strong> {deviceInfo.deviceName}</div>
            <div><strong>Type:</strong> {deviceInfo.deviceInfo.type}</div>
            <div><strong>Browser:</strong> {deviceInfo.deviceInfo.browser}</div>
            <div><strong>OS:</strong> {deviceInfo.deviceInfo.os}</div>
            <div><strong>Screen:</strong> {deviceInfo.deviceInfo.screenResolution}</div>
          </div>
        )}
      </div>

      {/* Test Controls */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-3">Test Controls</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={testDeviceFingerprinting}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Test Device Fingerprinting
          </button>
          <button
            onClick={testTokenRegistration}
            disabled={isLoading}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            Test Token Registration
          </button>
          <button
            onClick={testMultipleDeviceSimulation}
            disabled={isLoading}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
          >
            Simulate Multiple Devices
          </button>
          <button
            onClick={testCleanup}
            disabled={isLoading}
            className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
          >
            Test Cleanup
          </button>
          <button
            onClick={resetDeviceId}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
          >
            Reset Device ID
          </button>
          <button
            onClick={clearTestData}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Clear Results
          </button>
        </div>
      </div>

      {/* Cleanup Stats */}
      {cleanupStats && (
        <div className="bg-yellow-50 p-4 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-3">Cleanup Statistics</h2>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div><strong>Total Devices:</strong> {cleanupStats.totalDevices}</div>
            <div><strong>Active Devices:</strong> {cleanupStats.activeDevices}</div>
            <div><strong>Inactive Devices:</strong> {cleanupStats.inactiveDevices}</div>
            <div><strong>Cleaned Devices:</strong> {cleanupStats.cleanedDevices}</div>
          </div>
        </div>
      )}

      {/* Registered Devices */}
      <div className="bg-white border rounded-lg mb-6">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold">Registered Devices ({devices.length})</h2>
        </div>
        <div className="p-4">
          {devices.length === 0 ? (
            <p className="text-gray-500">No devices registered</p>
          ) : (
            <div className="space-y-3">
              {devices.map((device) => (
                <div key={device.id} className="border p-3 rounded">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium">{device.device_name}</div>
                      <div className="text-sm text-gray-600">
                        ID: {device.device_id} | Platform: {device.platform}
                      </div>
                      <div className="text-sm text-gray-600">
                        Token: {device.token.substring(0, 20)}...
                      </div>
                      <div className="text-sm text-gray-600">
                        Last Active: {new Date(device.last_active).toLocaleString()}
                      </div>
                      {device.device_info && (
                        <div className="text-sm text-gray-600">
                          Type: {device.device_info.type} | Browser: {device.device_info.browser} | OS: {device.device_info.os}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removeDevice(device.device_id)}
                      className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Test Results */}
      <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm">
        <h2 className="text-xl font-semibold mb-3 text-white">Test Results</h2>
        <div className="h-64 overflow-y-auto">
          {testResults.length === 0 ? (
            <p className="text-gray-400">No test results yet. Run some tests!</p>
          ) : (
            testResults.map((result, index) => (
              <div key={index} className="mb-1">
                {result}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};