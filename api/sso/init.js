import admin from 'firebase-admin';
import crypto from 'crypto';

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
      console.log('Firebase Admin initialized successfully');
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
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'Missing idToken' });
    }

    // 1. Verify the ID Token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const email = decodedToken.email;
    const name = decodedToken.name || decodedToken.email?.split('@')[0] || 'User';
    const picture = decodedToken.picture || null;

    console.log('Decoded Token Info:', { uid, email, name, picture });

    // 2. CRITICAL: Ensure user exists in Lumo Firebase with proper data
    let userRecord;
    try {
      // Try to get existing user
      userRecord = await admin.auth().getUser(uid);
      console.log('Existing user found:', userRecord.email);

      // UPDATE user profile if name/picture exists but not set
      const needsUpdate = 
        (name && !userRecord.displayName) || 
        (picture && !userRecord.photoURL) ||
        !userRecord.email;

      if (needsUpdate) {
        console.log('Updating user profile with name/picture...');
        await admin.auth().updateUser(uid, {
          email: email,
          displayName: name,
          photoURL: picture,
          emailVerified: true
        });
        console.log('User profile updated successfully');
      }

    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // User doesn't exist in Lumo Firebase - CREATE with full profile
        console.log('Creating new user in Lumo Firebase...');
        userRecord = await admin.auth().createUser({
          uid: uid,
          email: email,
          displayName: name,
          photoURL: picture,
          emailVerified: true
        });
        console.log('New user created:', userRecord.email);
      } else {
        throw error;
      }
    }

    // 3. Generate SSO Code
    const code = crypto.randomBytes(16).toString('hex');

    // 4. Store in Firestore with ALL user data
    const db = admin.firestore();
    const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 5 * 60 * 1000));

    await db.collection('sso_codes').doc(code).set({
      uid: uid,
      email: email,
      displayName: name,        // ← EKLENDI
      photoURL: picture,        // ← EKLENDI
      emailVerified: true,      // ← EKLENDI
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: expiresAt
    });

    console.log(`SSO Code generated for user ${email} (${name})`);

    // 5. Return the code
    return res.status(200).json({ 
      success: true, 
      code: code,
      expiresIn: 300,
      debug: {
        email,
        name,
        picture,
        uid
      }
    });

  } catch (error) {
    console.error('SSO Init Error:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error', 
      details: error.message 
    });
  }
}