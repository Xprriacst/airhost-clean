/**
 * Device Fingerprinting Utility
 * Generates unique device identifiers for multi-device FCM token support
 */

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  deviceInfo: {
    userAgent: string;
    platform: string;
    language: string;
    screenResolution: string;
    timezone: string;
    type: 'mobile' | 'desktop' | 'tablet';
    browser: string;
    os: string;
    timestamp: string;
  };
}

/**
 * Detects if the current device is mobile
 */
export function isMobileDevice(): boolean {
  const userAgent = navigator.userAgent.toLowerCase();
  const mobileKeywords = [
    'android', 'webos', 'iphone', 'ipad', 'ipod', 
    'blackberry', 'windows phone', 'mobile'
  ];
  
  return mobileKeywords.some(keyword => userAgent.includes(keyword)) ||
         /Mobi|Android/i.test(navigator.userAgent) ||
         (window.innerWidth <= 768 && window.innerHeight <= 1024);
}

/**
 * Detects if the current device is a tablet
 */
export function isTabletDevice(): boolean {
  const userAgent = navigator.userAgent.toLowerCase();
  const isIpad = userAgent.includes('ipad');
  const isAndroidTablet = userAgent.includes('android') && !userAgent.includes('mobile');
  const isLargeScreen = window.innerWidth >= 768 && window.innerWidth <= 1024;
  
  return isIpad || isAndroidTablet || (isLargeScreen && 'ontouchstart' in window);
}

/**
 * Gets device type classification
 */
export function getDeviceType(): 'mobile' | 'desktop' | 'tablet' {
  if (isTabletDevice()) return 'tablet';
  if (isMobileDevice()) return 'mobile';
  return 'desktop';
}

/**
 * Extracts browser information from user agent
 */
export function getBrowserInfo(): string {
  const userAgent = navigator.userAgent;
  
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
    return 'Chrome';
  } else if (userAgent.includes('Firefox')) {
    return 'Firefox';
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    return 'Safari';
  } else if (userAgent.includes('Edg')) {
    return 'Edge';
  } else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
    return 'Opera';
  }
  
  return 'Unknown';
}

/**
 * Extracts operating system information
 */
export function getOperatingSystem(): string {
  const userAgent = navigator.userAgent;
  
  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Mac OS')) return 'macOS';
  if (userAgent.includes('Linux')) return 'Linux';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
  
  return 'Unknown';
}

/**
 * Generates a device-specific fingerprint
 */
function generateDeviceFingerprint(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.platform,
    navigator.cookieEnabled ? '1' : '0',
    typeof(Storage) !== 'undefined' ? '1' : '0'
  ];
  
  // Create a simple hash from the components
  const fingerprint = components.join('|');
  let hash = 0;
  
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(36);
}

/**
 * Generates a human-readable device name
 */
function generateDeviceName(): string {
  const deviceType = getDeviceType();
  const browser = getBrowserInfo();
  const os = getOperatingSystem();
  
  // Create a descriptive name
  if (deviceType === 'mobile') {
    if (os === 'iOS') {
      return `iPhone (${browser})`;
    } else if (os === 'Android') {
      return `Android Phone (${browser})`;
    }
    return `Mobile Device (${browser})`;
  } else if (deviceType === 'tablet') {
    if (os === 'iOS') {
      return `iPad (${browser})`;
    } else if (os === 'Android') {
      return `Android Tablet (${browser})`;
    }
    return `Tablet (${browser})`;
  } else {
    return `${os} Desktop (${browser})`;
  }
}

/**
 * Gets or creates a persistent device ID
 */
export function getDeviceId(): string {
  const storageKey = 'airhost_device_id';
  
  // Try to get existing device ID from localStorage
  let deviceId = localStorage.getItem(storageKey);
  
  if (!deviceId) {
    // Generate new device ID
    const fingerprint = generateDeviceFingerprint();
    const timestamp = Date.now().toString(36);
    deviceId = `dev_${fingerprint}_${timestamp}`;
    
    // Store it for future use
    localStorage.setItem(storageKey, deviceId);
  }
  
  return deviceId;
}

/**
 * Gets comprehensive device information
 */
export function getDeviceInfo(): DeviceInfo {
  const deviceId = getDeviceId();
  const deviceName = generateDeviceName();
  
  const deviceInfo = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    type: getDeviceType(),
    browser: getBrowserInfo(),
    os: getOperatingSystem(),
    timestamp: new Date().toISOString()
  };
  
  return {
    deviceId,
    deviceName,
    deviceInfo
  };
}

/**
 * Updates device activity timestamp
 */
export function updateDeviceActivity(): void {
  const deviceInfo = getDeviceInfo();
  const storageKey = 'airhost_device_last_active';
  
  localStorage.setItem(storageKey, new Date().toISOString());
  
  // Also update device info to track any changes
  const deviceInfoKey = 'airhost_device_info';
  localStorage.setItem(deviceInfoKey, JSON.stringify(deviceInfo));
}

/**
 * Gets the last activity timestamp for this device
 */
export function getLastDeviceActivity(): Date | null {
  const storageKey = 'airhost_device_last_active';
  const timestamp = localStorage.getItem(storageKey);
  
  return timestamp ? new Date(timestamp) : null;
}

/**
 * Clears device identification data (useful for testing or reset)
 */
export function clearDeviceData(): void {
  const keys = [
    'airhost_device_id',
    'airhost_device_last_active',
    'airhost_device_info'
  ];
  
  keys.forEach(key => localStorage.removeItem(key));
}

/**
 * Validates if device ID is properly formatted
 */
export function isValidDeviceId(deviceId: string): boolean {
  return /^dev_[a-z0-9]+_[a-z0-9]+$/.test(deviceId);
}