import admin from 'firebase-admin';

// Initialize Firebase Admin (Singleton pattern)
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
    }
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }
}

export default async function handler(req, res) {
  // CORS Configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Missing code' });
    }

    const db = admin.firestore();
    const codeRef = db.collection('sso_codes').doc(code);

    // Run as a Transaction
    const result = await db.runTransaction(async (t) => {
      const doc = await t.get(codeRef);

      if (!doc.exists) {
        throw new Error('INVALID_CODE');
      }

      const data = doc.data();
      const now = admin.firestore.Timestamp.now();

      if (data.expiresAt < now) {
        t.delete(codeRef);
        throw new Error('EXPIRED_CODE');
      }

      t.delete(codeRef);
      return data;
    });

    console.log(`Exchanging code for user ${result.email} (${result.displayName})`);

    // CRITICAL FIX: Ensure user profile is complete BEFORE creating custom token
    try {
      const userRecord = await admin.auth().getUser(result.uid);
      
      // If displayName or photoURL missing, update NOW
      const needsProfileUpdate = 
        (result.displayName && !userRecord.displayName) ||
        (result.photoURL && !userRecord.photoURL);

      if (needsProfileUpdate) {
        console.log('Syncing user profile before token creation...');
        await admin.auth().updateUser(result.uid, {
          displayName: result.displayName,
          photoURL: result.photoURL,
          emailVerified: true
        });
        console.log('Profile synced successfully');
      }
    } catch (error) {
      console.error('Profile sync error:', error);
      // Continue anyway - custom token will still work
    }

    // Create Custom Token with claims
    const customToken = await admin.auth().createCustomToken(result.uid, {
      sso: true,
      source: 'sso_code_flow',
      email: result.email,           // ← EKLENDI
      displayName: result.displayName, // ← EKLENDI
      photoURL: result.photoURL        // ← EKLENDI
    });

    return res.status(200).json({ 
      success: true, 
      customToken: customToken,
      user: {
        email: result.email,
        displayName: result.displayName,
        photoURL: result.photoURL,
        uid: result.uid
      }
    });

  } catch (error) {
    console.error('SSO Exchange Error:', error);
    
    if (error.message === 'INVALID_CODE') {
      return res.status(400).json({ error: 'Invalid or used code' });
    }
    if (error.message === 'EXPIRED_CODE') {
      return res.status(400).json({ error: 'Code expired' });
    }

    return res.status(500).json({ 
      error: 'Internal Server Error',
      details: error.message 
    });
  }
}