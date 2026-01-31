import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const SSOTestPage = ({ onBack }) => {
  const { currentUser } = useAuth();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Vercel URL'inizi buraya yazın
  const VERCEL_API_URL = 'https://lumobuildvercel.vercel.app/api/sso-token';

  const testBackend = async () => {
    setTesting(true);
    setResult(null);
    setError(null);

    try {
      if (!currentUser) {
        throw new Error('Önce Google ile giriş yapın!');
      }

      console.log('🔍 Testing SSO Backend...');
      console.log('User:', currentUser.email);

      // Google ID token al
      const googleIdToken = await currentUser.getIdToken();
      console.log('✅ Google ID Token alındı');

      // Backend'e istek gönder
      console.log('📡 Backend\'e istek gönderiliyor:', VERCEL_API_URL);
      
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
          message: '✅ Backend çalışıyor! Custom token başarıyla oluşturuldu.'
        });
      } else {
        throw new Error(data.message || data.error || 'Bilinmeyen hata');
      }

    } catch (err) {
      console.error('❌ Test failed:', err);
      setError(err.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-dark-text">
            🧪 SSO Backend Test
          </h1>
          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2 bg-dark-sidebar hover:bg-dark-border text-dark-text rounded-md transition-colors"
            >
              ← Back to Login
            </button>
          )}
        </div>

        {/* User Info */}
        <div className="bg-dark-sidebar rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-dark-text mb-4">
            Kullanıcı Bilgileri
          </h2>
          {currentUser ? (
            <div className="space-y-2 text-dark-muted">
              <p>✅ Giriş yapıldı</p>
              <p><strong>Email:</strong> {currentUser.email}</p>
              <p><strong>UID:</strong> {currentUser.uid}</p>
            </div>
          ) : (
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded p-4">
              <p className="text-yellow-500 mb-3">⚠️ Giriş yapmanız gerekiyor</p>
              <p className="text-dark-muted text-sm mb-3">
                SSO backend'i test etmek için önce Google ile giriş yapmalısınız.
              </p>
              {onBack ? (
                <button
                  onClick={onBack}
                  className="w-full bg-brand-primary hover:bg-brand-primary/80 text-white font-medium py-2 px-4 rounded-md transition-colors"
                >
                  Login Sayfasına Git
                </button>
              ) : (
                <p className="text-sm text-dark-muted">
                  Lütfen ana sayfaya gidip Google ile giriş yapın.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Test Button */}
        <div className="bg-dark-sidebar rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-dark-text mb-4">
            Backend Testi
          </h2>
          
          <div className="mb-4">
            <label className="block text-dark-muted mb-2">Vercel API URL:</label>
            <input
              type="text"
              value={VERCEL_API_URL}
              readOnly
              className="w-full bg-dark-input text-dark-text px-4 py-2 rounded-md border border-dark-border"
            />
            <p className="text-sm text-dark-muted mt-2">
              ⚠️ Yukarıdaki URL'i kendi Vercel project URL'iniz ile değiştirin
            </p>
          </div>

          <button
            onClick={testBackend}
            disabled={!currentUser || testing}
            className="w-full bg-brand-primary hover:bg-brand-primary/80 text-white font-medium py-3 px-6 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Test ediliyor...
              </span>
            ) : (
              '🚀 Backend\'i Test Et'
            )}
          </button>
        </div>

        {/* Success Result */}
        {result && (
          <div className="bg-green-900/20 border border-green-500 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-green-500 mb-4">
              {result.message}
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-dark-muted mb-1">User Info:</p>
                <pre className="bg-dark-bg p-3 rounded text-sm text-dark-text overflow-x-auto">
                  {JSON.stringify(result.user, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-dark-muted mb-1">Custom Token:</p>
                <pre className="bg-dark-bg p-3 rounded text-sm text-dark-text overflow-x-auto break-all">
                  {result.customToken}
                </pre>
              </div>
              <div className="bg-green-900/30 p-4 rounded">
                <p className="text-green-400 font-medium mb-2">✅ Test Başarılı!</p>
                <ul className="text-sm text-dark-muted space-y-1">
                  <li>✓ Backend API erişilebilir</li>
                  <li>✓ Google ID token doğrulandı</li>
                  <li>✓ Custom token oluşturuldu</li>
                  <li>✓ SSO sistemi çalışıyor!</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Error Result */}
        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-500 mb-4">
              ❌ Test Başarısız
            </h2>
            <p className="text-dark-text mb-4">{error}</p>
            
            <div className="bg-red-900/30 p-4 rounded">
              <p className="text-red-400 font-medium mb-2">Olası Sorunlar:</p>
              <ul className="text-sm text-dark-muted space-y-1">
                <li>• Vercel URL yanlış olabilir</li>
                <li>• Environment variables eksik olabilir</li>
                <li>• CORS hatası olabilir</li>
                <li>• Backend deploy edilmemiş olabilir</li>
              </ul>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-dark-sidebar rounded-lg p-6 mt-6">
          <h2 className="text-xl font-semibold text-dark-text mb-4">
            📝 Nasıl Test Edilir?
          </h2>
          <ol className="list-decimal list-inside space-y-2 text-dark-muted">
            <li>Google ile giriş yapın (ana sayfadan)</li>
            <li>Yukarıdaki URL'i kendi Vercel project URL'iniz ile değiştirin</li>
            <li>"Backend'i Test Et" butonuna tıklayın</li>
            <li>Sonucu bekleyin</li>
          </ol>
          
          <div className="mt-4 p-4 bg-dark-bg rounded">
            <p className="text-sm text-dark-muted mb-2">
              <strong>Vercel URL'inizi bulmak için:</strong>
            </p>
            <ol className="text-sm text-dark-muted space-y-1 ml-4">
              <li>1. Vercel Dashboard'a gidin</li>
              <li>2. Projenizi seçin</li>
              <li>3. "Visit" butonunun yanındaki URL'i kopyalayın</li>
              <li>4. Sonuna <code className="bg-dark-input px-1 rounded">/api/sso-token</code> ekleyin</li>
            </ol>
          </div>
        </div>

        {/* Console Logs */}
        <div className="bg-dark-sidebar rounded-lg p-6 mt-6">
          <h2 className="text-xl font-semibold text-dark-text mb-4">
            🔍 Debug
          </h2>
          <p className="text-dark-muted mb-2">
            Detaylı loglar için tarayıcı console'unu açın (F12)
          </p>
          <p className="text-sm text-dark-muted">
            Test sırasında tüm adımlar console'a yazdırılacak.
          </p>
        </div>
      </div>
    </div>
  );
};
