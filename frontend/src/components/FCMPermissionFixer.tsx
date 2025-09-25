import React, { useState, useEffect } from 'react';

/**
 * Component to diagnose and fix FCM permission issues
 */
export const FCMPermissionFixer: React.FC = () => {
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const [logs, setLogs] = useState<string[]>([]);
  const [isHttps, setIsHttps] = useState(false);
  const [hasServiceWorker, setHasServiceWorker] = useState(false);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[PERMISSION FIX] ${message}`);
  };

  useEffect(() => {
    checkEnvironment();
  }, []);

  const checkEnvironment = () => {
    // Check HTTPS
    const isSecure = location.protocol === 'https:' || location.hostname === 'localhost';
    setIsHttps(isSecure);
    addLog(`HTTPS Status: ${isSecure ? 'OK' : 'REQUIRED'}`);

    // Check Service Worker support
    const swSupported = 'serviceWorker' in navigator;
    setHasServiceWorker(swSupported);
    addLog(`Service Worker Support: ${swSupported ? 'OK' : 'NOT SUPPORTED'}`);

    // Check current permission status
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
      addLog(`Current Permission: ${Notification.permission}`);
    } else {
      addLog('Notifications NOT SUPPORTED in this browser');
    }

    // Check if notifications are supported
    addLog(`Push Manager: ${'PushManager' in window ? 'OK' : 'NOT SUPPORTED'}`);
    addLog(`User Agent: ${navigator.userAgent}`);
  };

  const resetPermissions = async () => {
    addLog('🔄 Attempting to reset notification state...');
    
    try {
      // Clear any cached permission state
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'notifications' as PermissionName });
        addLog(`Permission API Status: ${permission.state}`);
      }

      // Clear localStorage FCM data
      const fcmKeys = Object.keys(localStorage).filter(key => 
        key.includes('fcm') || key.includes('firebase') || key.includes('messaging')
      );
      fcmKeys.forEach(key => {
        localStorage.removeItem(key);
        addLog(`Cleared localStorage: ${key}`);
      });

      // Clear sessionStorage FCM data
      const sessionFcmKeys = Object.keys(sessionStorage).filter(key => 
        key.includes('fcm') || key.includes('firebase') || key.includes('messaging')
      );
      sessionFcmKeys.forEach(key => {
        sessionStorage.removeItem(key);
        addLog(`Cleared sessionStorage: ${key}`);
      });

      addLog('✅ Reset complete. Try requesting permission again.');
      
    } catch (error) {
      addLog(`❌ Reset error: ${error}`);
    }
  };

  const requestPermissionDirect = async () => {
    addLog('🔔 Requesting notification permission directly...');
    
    try {
      if (!('Notification' in window)) {
        addLog('❌ Notifications not supported');
        return;
      }

      // Force a fresh permission request
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      addLog(`Permission result: ${permission}`);

      if (permission === 'granted') {
        addLog('✅ Permission granted! Now try getting FCM token.');
        
        // Test notification
        try {
          new Notification('Test Notification', {
            body: 'Notifications are working!',
            icon: '/favicon.ico'
          });
          addLog('✅ Test notification sent');
        } catch (notifError) {
          addLog(`⚠️ Test notification failed: ${notifError}`);
        }
      } else {
        addLog(`❌ Permission ${permission}. Check browser settings.`);
      }
      
    } catch (error) {
      addLog(`❌ Permission request error: ${error}`);
    }
  };

  const checkBrowserSettings = () => {
    addLog('🔍 Checking browser notification settings...');
    
    // Check if notifications are blocked at browser level
    if (Notification.permission === 'denied') {
      addLog('❌ Notifications are BLOCKED. To fix:');
      addLog('1. Click the lock/info icon in address bar');
      addLog('2. Set Notifications to "Allow"');
      addLog('3. Refresh the page');
      addLog('4. Try again');
    }

    // Check for common blocking scenarios
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      addLog('❌ HTTPS required for notifications (except localhost)');
    }

    // Check if in incognito/private mode
    if (navigator.webdriver) {
      addLog('⚠️ Running in automated browser (may affect notifications)');
    }
  };

  const testServiceWorker = async () => {
    addLog('🔧 Testing Service Worker...');
    
    try {
      if (!('serviceWorker' in navigator)) {
        addLog('❌ Service Worker not supported');
        return;
      }

      // Check current registration
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        addLog(`✅ Service Worker registered: ${registration.scope}`);
        addLog(`Active: ${registration.active ? 'Yes' : 'No'}`);
        addLog(`Installing: ${registration.installing ? 'Yes' : 'No'}`);
        addLog(`Waiting: ${registration.waiting ? 'Yes' : 'No'}`);
      } else {
        addLog('⚠️ No Service Worker registered');
        
        // Try to register
        try {
          const newReg = await navigator.serviceWorker.register('/sw.js');
          addLog(`✅ Service Worker registered successfully: ${newReg.scope}`);
        } catch (regError) {
          addLog(`❌ Service Worker registration failed: ${regError}`);
        }
      }
      
    } catch (error) {
      addLog(`❌ Service Worker test error: ${error}`);
    }
  };

  const getDetailedInfo = () => {
    addLog('📋 Detailed Environment Info:');
    addLog(`URL: ${window.location.href}`);
    addLog(`Protocol: ${window.location.protocol}`);
    addLog(`Host: ${window.location.host}`);
    addLog(`User Agent: ${navigator.userAgent}`);
    addLog(`Language: ${navigator.language}`);
    addLog(`Online: ${navigator.onLine}`);
    addLog(`Cookies Enabled: ${navigator.cookieEnabled}`);
    
    if ('permissions' in navigator) {
      addLog('✅ Permissions API available');
    } else {
      addLog('❌ Permissions API not available');
    }
  };

  const clearLogs = () => setLogs([]);

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      left: '10px', 
      width: '450px', 
      background: 'white', 
      border: '2px solid #ff6b6b', 
      borderRadius: '8px', 
      padding: '16px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: 10000,
      fontSize: '12px'
    }}>
      <h3 style={{ margin: '0 0 16px 0', color: '#ff6b6b' }}>🔧 FCM Permission Fixer</h3>
      
      <div style={{ marginBottom: '16px', padding: '8px', background: '#f8f9fa', borderRadius: '4px' }}>
        <div><strong>Permission:</strong> <span style={{ color: permissionStatus === 'granted' ? 'green' : 'red' }}>{permissionStatus}</span></div>
        <div><strong>HTTPS:</strong> <span style={{ color: isHttps ? 'green' : 'red' }}>{isHttps ? 'OK' : 'REQUIRED'}</span></div>
        <div><strong>Service Worker:</strong> <span style={{ color: hasServiceWorker ? 'green' : 'red' }}>{hasServiceWorker ? 'OK' : 'NOT SUPPORTED'}</span></div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
        <button onClick={requestPermissionDirect} style={{ padding: '8px', fontSize: '11px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px' }}>
          🔔 Request Permission
        </button>
        <button onClick={resetPermissions} style={{ padding: '8px', fontSize: '11px', background: '#ff9800', color: 'white', border: 'none', borderRadius: '4px' }}>
          🔄 Reset State
        </button>
        <button onClick={checkBrowserSettings} style={{ padding: '8px', fontSize: '11px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '4px' }}>
          🔍 Check Settings
        </button>
        <button onClick={testServiceWorker} style={{ padding: '8px', fontSize: '11px', background: '#9C27B0', color: 'white', border: 'none', borderRadius: '4px' }}>
          🔧 Test SW
        </button>
        <button onClick={getDetailedInfo} style={{ padding: '8px', fontSize: '11px', background: '#607D8B', color: 'white', border: 'none', borderRadius: '4px' }}>
          📋 Detailed Info
        </button>
        <button onClick={clearLogs} style={{ padding: '8px', fontSize: '11px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px' }}>
          🗑️ Clear Logs
        </button>
      </div>
      
      <div style={{ 
        maxHeight: '300px', 
        overflowY: 'auto', 
        background: '#f5f5f5', 
        padding: '8px', 
        borderRadius: '4px',
        fontSize: '10px',
        fontFamily: 'monospace',
        border: '1px solid #ddd'
      }}>
        <strong>Diagnostic Logs:</strong>
        {logs.map((log, index) => (
          <div key={index} style={{ 
            padding: '2px 0',
            borderBottom: index < logs.length - 1 ? '1px solid #eee' : 'none'
          }}>
            {log}
          </div>
        ))}
        {logs.length === 0 && <div style={{ color: '#666', fontStyle: 'italic' }}>Click buttons above to run diagnostics</div>}
      </div>
      
      {permissionStatus === 'denied' && (
        <div style={{ 
          marginTop: '12px', 
          padding: '8px', 
          background: '#ffebee', 
          border: '1px solid #f44336', 
          borderRadius: '4px',
          fontSize: '11px'
        }}>
          <strong>🚨 Notifications Blocked!</strong><br/>
          1. Click the lock/info icon in your address bar<br/>
          2. Set Notifications to "Allow"<br/>
          3. Refresh the page and try again
        </div>
      )}
    </div>
  );
};