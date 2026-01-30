import { useState } from 'react';
import { Button } from '../shared/Button';

export const SSOBackendTest = ({ currentUser }) => {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Vercel production domain
  const VERCEL_API_URL = 'https://lumobuild.vercel.app/api/sso-token';

  const testBackend = async () => {
    setTesting(true);
    setResult(null);
    setError(null);

    try {
      if (!currentUser) {
        throw new Error('No user logged in');
      }

      console.log('🔍 Testing SSO Backend...');
      console.log('User:', currentUser.email);

      const googleIdToken = await currentUser.getIdToken();
      console.log('✅ Google ID Token obtained');

      console.log('📡 Sending request to:', VERCEL_API_URL);
      
      const response = await fetch(VERCEL_API_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          googleIdToken,
          email: currentUser.email 
        })
      });

      console.log('📥 Response status:', response.status);

      const data = await response.json();
      console.log('📦 Response data:', data);

      if (data.success) {
        setResult({
          success: true,
          customToken: data.customToken,
          user: data.user,
          googleIdToken: googleIdToken, // MeydanApp test için
        });
      } else {
        throw new Error(data.message || data.error || 'Unknown error');
      }

    } catch (err) {
      console.error('❌ Test failed:', err);
      setError(err.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Test Button */}
      <div>
        <p className="text-dark-muted text-sm mb-3">
          Test the SSO backend to verify it's working correctly.
        </p>
        <Button
          onClick={testBackend}
          disabled={!currentUser || testing}
          variant="primary"
        >
          {testing ? (
            <span className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Testing...
            </span>
          ) : (
            '🚀 Test SSO Backend'
          )}
        </Button>
      </div>

      {/* Success Result */}
      {result && (
        <div className="bg-green-900/20 border border-green-500 rounded-lg p-4">
          <h4 className="text-green-500 font-semibold mb-3">✅ Backend Working!</h4>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-dark-muted mb-1">User Info:</p>
              <pre className="bg-dark-sidebar p-3 rounded text-xs text-dark-text overflow-x-auto">
                {JSON.stringify(result.user, null, 2)}
              </pre>
            </div>
            <div>
              <p className="text-dark-muted mb-1">Custom Token:</p>
              <pre className="bg-dark-sidebar p-3 rounded text-xs text-dark-text overflow-x-auto break-all">
                {result.customToken.substring(0, 100)}...
              </pre>
            </div>
            
            {/* Google ID Token for SSO Testing */}
            <div className="mt-4 pt-4 border-t border-green-500/30">
              <p className="text-dark-muted mb-2">🧪 SSO Test URL (for MeydanApp testing):</p>
              <div className="bg-dark-sidebar p-3 rounded text-xs">
                <p className="text-dark-text font-mono break-all mb-2">
                  {`${window.location.origin}/?sso_token=${result.googleIdToken}`}
                </p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/?sso_token=${result.googleIdToken}`);
                    alert('SSO URL copied to clipboard!');
                  }}
                  className="text-green-500 hover:text-green-400 text-xs underline"
                >
                  📋 Copy URL
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Result */}
      {error && (
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
          <h4 className="text-red-500 font-semibold mb-2">❌ Test Failed</h4>
          <p className="text-dark-text text-sm mb-3">{error}</p>
          <div className="bg-red-900/30 p-3 rounded text-xs text-dark-muted">
            <p className="font-medium mb-1">Possible issues:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Environment variables not set in Vercel</li>
              <li>Backend not deployed</li>
              <li>CORS configuration issue</li>
            </ul>
          </div>
        </div>
      )}

      {/* API Info */}
      <div className="bg-dark-sidebar rounded p-3 text-xs">
        <p className="text-dark-muted mb-1">API Endpoint:</p>
        <p className="text-dark-text font-mono break-all">{VERCEL_API_URL}</p>
      </div>
    </div>
  );
};
