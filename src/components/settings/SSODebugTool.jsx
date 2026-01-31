import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../shared/Button';

export const SSODebugTool = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleTestInit = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      console.log('1. Getting ID Token...');
      const idToken = await currentUser.getIdToken();

      console.log('2. Calling /api/sso/init...');
      // Use production URL for testing (since Vite doesn't run backend functions locally)
      const API_BASE = 'https://lumobuild.vercel.app'; 
      const response = await fetch(`${API_BASE}/api/sso/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Init failed');
      }

      setResult(data);
      console.log('✅ SSO Init Success:', data);

    } catch (err) {
      console.error('SSO Debug Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenLink = () => {
    if (result?.code) {
      const url = `${window.location.origin}/?sso_code=${result.code}`;
      window.open(url, '_blank');
    }
  };

  return (
    <div className="bg-dark-sidebar p-4 rounded-lg border border-dark-hover space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-dark-text">SSO Backend Integration Test</h3>
        <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded">Dev Tool</span>
      </div>

      <p className="text-sm text-dark-muted">
        This tool simulates the "Source App" by generating an SSO code using your current session.
      </p>

      <div className="space-y-4">
        <Button 
          onClick={handleTestInit} 
          disabled={loading || !currentUser}
          className="w-full"
        >
          {loading ? 'Generating Code...' : '1. Generate SSO Code (POST /api/sso/init)'}
        </Button>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/50 rounded text-red-500 text-sm">
            ❌ Error: {error}
          </div>
        )}

        {result && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
            <div className="p-3 bg-green-500/10 border border-green-500/50 rounded">
              <div className="text-green-500 text-sm font-bold mb-1">✅ Code Generated!</div>
              <div className="text-xs text-dark-muted font-mono break-all bg-black/20 p-2 rounded">
                Code: {result.code}<br/>
                Expires In: {result.expiresIn}s
              </div>
            </div>

            <Button 
              variant="secondary"
              onClick={handleOpenLink}
              className="w-full"
            >
              2. Test Login (Open in New Tab)
            </Button>
            
            <p className="text-xs text-center text-dark-muted">
              Opens: <code className="bg-black/20 px-1 rounded">/?sso_code={result.code}</code>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
