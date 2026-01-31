import admin from 'firebase-admin';

// Firebase Admin'i global scope'da başlatmaya çalışalım
if (!admin.apps.length) {
  try {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY 
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined;

    if (process.env.FIREBASE_PROJECT_ID && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey
        })
      });
      console.log('Firebase Admin initialized successfully');
    }
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Debug için Env kontrolü (Private key hariç)
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    console.error('Missing Environment Variables');
    console.error('Project ID:', !!process.env.FIREBASE_PROJECT_ID);
    console.error('Client Email:', !!process.env.FIREBASE_CLIENT_EMAIL);
    console.error('Private Key:', !!process.env.FIREBASE_PRIVATE_KEY);
    
    return res.status(500).json({ 
      error: 'Configuration Error', 
      message: 'Server environment variables are missing. check logs.',
      details: {
        hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
        hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
        hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY
      }
    });
  }

  // Admin SDK başlatılmamışsa tekrar dene (bazen serverless function cold start'ta gerekebilir)
  if (!admin.apps.length) {
    try {
       admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        })
      });
    } catch (e) {
      return res.status(500).json({
        error: 'Initialization Error',
        message: 'Failed to initialize Firebase Admin SDK',
        details: e.message
      });
    }
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
    
    console.log('Token verified. Google UID:', decodedToken.uid);
    console.log('Incoming email param:', email);

    let lumoUid = decodedToken.uid;
    const userEmail = decodedToken.email || email;
    let userRecord = null;

    // 1. Try to find existing user by email
    if (userEmail) {
      try {
        const existingUser = await admin.auth().getUserByEmail(userEmail);
        console.log('Existing user found by email. Linking to UID:', existingUser.uid);
        lumoUid = existingUser.uid;
        userRecord = existingUser;
      } catch (err) {
        if (err.code !== 'auth/user-not-found') {
             console.error('Error checking existing user:', err);
        } else {
             console.log('No user found by email:', userEmail);
        }
      }
    }

    // 2. Ensure User Exists & Update Profile
    // Define profile data to sync
    const profileUpdate = {
        displayName: decodedToken.name,
        photoURL: decodedToken.picture,
        emailVerified: true // Trust Google
    };
    
    if (userEmail) {
        profileUpdate.email = userEmail;
    }

    try {
        if (!userRecord) {
            // Check if user exists by UID (if we didn't find by email)
            try {
                userRecord = await admin.auth().getUser(lumoUid);
                console.log('User found by UID:', lumoUid);
            } catch (e) {
                if (e.code === 'auth/user-not-found') {
                    // Create new user
                    console.log('Creating new user with UID:', lumoUid);
                    userRecord = await admin.auth().createUser({
                        uid: lumoUid,
                        ...profileUpdate
                    });
                } else {
                    throw e;
                }
            }
        }

        // Update existing user profile to ensure they have a name
        if (userRecord) {
            console.log('Updating user profile for UID:', lumoUid);
            await admin.auth().updateUser(lumoUid, profileUpdate);
        }

    } catch (err) {
        console.error('Error creating/updating user in Auth:', err);
        // Fallback: If update fails, we still try to issue token, 
        // but this shouldn't happen usually.
    }
    
    // 3. Create Custom Token
    const customToken = await admin.auth().createCustomToken(lumoUid, {
      email: userEmail,
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
        uid: lumoUid,
        email: userEmail,
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
