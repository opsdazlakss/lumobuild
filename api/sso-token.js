const admin = require('firebase-admin');

// Firebase Admin SDK'yı başlat (sadece bir kez)
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      })
    });
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }
}

export default async function handler(req, res) {
  // CORS headers - güvenlik için sadece kendi domain'inizden izin verin
  res.setHeader('Access-Control-Allow-Origin', '*'); // Production'da bunu kendi domain'inize değiştirin
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // OPTIONS request için
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Sadece POST isteklerine izin ver
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are accepted' 
    });
  }

  const { googleIdToken, email } = req.body;

  // Validation
  if (!googleIdToken) {
    return res.status(400).json({ 
      error: 'Bad request',
      message: 'googleIdToken is required' 
    });
  }

  try {
    console.log('Verifying Google ID token...');
    
    // Google ID token'ı doğrula
    const decodedToken = await admin.auth().verifyIdToken(googleIdToken);
    
    console.log('Token verified for user:', decodedToken.uid);
    
    // Custom token oluştur - bu token ile Lumo app'e giriş yapılacak
    const customToken = await admin.auth().createCustomToken(decodedToken.uid, {
      email: decodedToken.email || email,
      name: decodedToken.name,
      picture: decodedToken.picture,
      sourceApp: 'MeydanApp',
      ssoTimestamp: Date.now()
    });

    console.log('Custom token created successfully');

    return res.status(200).json({ 
      success: true,
      customToken,
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name
      }
    });

  } catch (error) {
    console.error('SSO Token Error:', error);
    
    // Hata tipine göre farklı mesajlar
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ 
        error: 'Token expired',
        message: 'Google ID token has expired. Please sign in again.' 
      });
    }
    
    if (error.code === 'auth/invalid-id-token') {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'Invalid Google ID token provided.' 
      });
    }

    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
