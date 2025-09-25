import React, { useState, useEffect } from 'react';
import { MultiDeviceTestPanel } from '../components/MultiDeviceTestPanel';
import { MultiDeviceFCMTester, type TestResult } from '../test-multidevice-fcm';
import { supabase } from '../lib/supabase';

interface TestPageState {
  isAuthenticated: boolean;
  userEmail: string | null;
  isRunningTests: boolean;
  testResults: TestResult[];
  lastTestRun: Date | null;
}

export const MultiDeviceTestPage: React.FC = () => {
  const [state, setState] = useState<TestPageState>({
    isAuthenticated: false,
    userEmail: null,
    isRunningTests: false,
    testResults: [],
    lastTestRun: null
  });

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setState(prev => ({
        ...prev,
        isAuthenticated: !!user,
        userEmail: user?.email || null
      }));
    } catch (error) {
      console.error('Auth check failed:', error);
    }
  };

  const runComprehensiveTests = async () => {
    if (!state.isAuthenticated) {
      alert('Please authenticate first to run tests');
      return;
    }

    setState(prev => ({ ...prev, isRunningTests: true }));

    try {
      const tester = new MultiDeviceFCMTester();
      const results = await tester.runAllTests();
      
      setState(prev => ({
        ...prev,
        testResults: results,
        lastTestRun: new Date(),
        isRunningTests: false
      }));

      // Also print to console for debugging
      tester.printDetailedResults();
    } catch (error) {
      console.error('Test execution failed:', error);
      setState(prev => ({ ...prev, isRunningTests: false }));
      alert(`Test execution failed: ${error}`);
    }
  };

  const clearTestResults = () => {
    setState(prev => ({
      ...prev,
      testResults: [],
      lastTestRun: null
    }));
  };

  const getTestSummary = () => {
    if (state.testResults.length === 0) return null;
    
    const passed = state.testResults.filter(r => r.success).length;
    const total = state.testResults.length;
    const percentage = Math.round((passed / total) * 100);
    
    return { passed, total, percentage };
  };

  const summary = getTestSummary();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Multi-Device FCM Testing Dashboard
          </h1>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900">Authentication Status</h3>
              <p className={`text-sm ${state.isAuthenticated ? 'text-green-600' : 'text-red-600'}`}>
                {state.isAuthenticated ? `✅ Authenticated as ${state.userEmail}` : '❌ Not authenticated'}
              </p>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-green-900">Last Test Run</h3>
              <p className="text-sm text-gray-600">
                {state.lastTestRun ? state.lastTestRun.toLocaleString() : 'No tests run yet'}
              </p>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="font-semibold text-purple-900">Test Results</h3>
              <p className="text-sm text-gray-600">
                {summary ? `${summary.passed}/${summary.total} tests passed (${summary.percentage}%)` : 'No results'}
              </p>
            </div>
          </div>
        </div>

        {/* Test Controls */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Test Controls</h2>
          
          <div className="flex flex-wrap gap-4">
            <button
              onClick={runComprehensiveTests}
              disabled={!state.isAuthenticated || state.isRunningTests}
              className={`px-6 py-3 rounded-lg font-medium ${
                !state.isAuthenticated || state.isRunningTests
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {state.isRunningTests ? 'Running Tests...' : 'Run Comprehensive Tests'}
            </button>
            
            <button
              onClick={clearTestResults}
              disabled={state.testResults.length === 0}
              className={`px-6 py-3 rounded-lg font-medium ${
                state.testResults.length === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              Clear Results
            </button>
            
            <button
              onClick={checkAuthStatus}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700"
            >
              Refresh Auth Status
            </button>
          </div>
        </div>

        {/* Test Results */}
        {state.testResults.length > 0 && (
          <div className="bg-white shadow rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Test Results</h2>
            
            {summary && (
              <div className={`p-4 rounded-lg mb-4 ${
                summary.percentage === 100 ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
              }`}>
                <h3 className={`font-semibold ${
                  summary.percentage === 100 ? 'text-green-900' : 'text-yellow-900'
                }`}>
                  Test Summary: {summary.passed}/{summary.total} tests passed ({summary.percentage}%)
                </h3>
              </div>
            )}
            
            <div className="space-y-4">
              {state.testResults.map((result, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${
                    result.success
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h4 className={`font-semibold ${
                      result.success ? 'text-green-900' : 'text-red-900'
                    }`}>
                      {result.success ? '✅' : '❌'} {result.testName}
                    </h4>
                  </div>
                  
                  <p className={`text-sm mt-2 ${
                    result.success ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {result.message}
                  </p>
                  
                  {result.details && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium text-gray-600">
                        View Details
                      </summary>
                      <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Interactive Test Panel */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Interactive Test Panel</h2>
          <p className="text-gray-600 mb-6">
            Use this panel to manually test individual components and simulate different scenarios.
          </p>
          <MultiDeviceTestPanel />
        </div>

        {/* Instructions */}
        <div className="bg-white shadow rounded-lg p-6 mt-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Testing Instructions</h2>
          
          <div className="prose max-w-none">
            <h3 className="text-lg font-semibold text-gray-800">How to Test Multi-Device Functionality</h3>
            
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>Ensure you are authenticated (login to your account)</li>
              <li>Click "Run Comprehensive Tests" to execute all automated tests</li>
              <li>Review the test results to ensure all components are working</li>
              <li>Use the Interactive Test Panel to manually test specific features</li>
              <li>Open the app in multiple browsers/devices to test real multi-device scenarios</li>
              <li>Check the browser console for detailed logs and debugging information</li>
            </ol>
            
            <h3 className="text-lg font-semibold text-gray-800 mt-6">What Gets Tested</h3>
            
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li>Device fingerprinting and unique ID generation</li>
              <li>Database schema support for multi-device tokens</li>
              <li>FCM token registration with device information</li>
              <li>Multiple device support (simulated)</li>
              <li>Device cleanup for inactive devices</li>
              <li>Notification delivery to active devices</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiDeviceTestPage;