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

    console.log('[INIT] ===== SSO INIT START =====');
    console.log('[INIT] UID:', uid);
    console.log('[INIT] Email:', email);
    console.log('[INIT] Name:', name);
    console.log('[INIT] Picture:', picture);

    // 2. Check if user exists
    let userRecord;
    let userExists = false;
    
    try {
      userRecord = await admin.auth().getUser(uid);
      userExists = true;
      console.log('[INIT] ✅ User already exists');
      console.log('[INIT] Current displayName:', userRecord.displayName);
      console.log('[INIT] Current photoURL:', userRecord.photoURL);
      console.log('[INIT] Current email:', userRecord.email);
      console.log('[INIT] Providers:', userRecord.providerData.map(p => p.providerId).join(', '));

    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.log('[INIT] ⚠️ User does not exist, will create...');
      } else {
        console.error('[INIT] ❌ Error checking user:', error);
        throw error;
      }
    }

    // 3. Create or Update User
    if (!userExists) {
      // CREATE NEW USER
      console.log('[INIT] Creating new user...');
      
      const randomPassword = crypto.randomBytes(32).toString('hex');
      
      try {
        userRecord = await admin.auth().createUser({
          uid: uid,
          email: email,
          password: randomPassword,
          displayName: name,
          photoURL: picture,
          emailVerified: true
        });
        
        console.log('[INIT] ✅ User created successfully');
        console.log('[INIT] Created UID:', userRecord.uid);
        console.log('[INIT] Created Email:', userRecord.email);
        console.log('[INIT] Created DisplayName:', userRecord.displayName);
        
      } catch (createError) {
        console.error('[INIT] ❌ CREATE USER FAILED:', createError);
        console.error('[INIT] Error code:', createError.code);
        console.error('[INIT] Error message:', createError.message);
        throw createError;
      }
      
    } else {
      // UPDATE EXISTING USER
      const needsUpdate = 
        (name && !userRecord.displayName) || 
        (picture && !userRecord.photoURL) ||
        !userRecord.email;

      if (needsUpdate) {
        console.log('[INIT] Updating user profile...');
        
        try {
          await admin.auth().updateUser(uid, {
            email: email || userRecord.email,
            displayName: name || userRecord.displayName,
            photoURL: picture || userRecord.photoURL,
            emailVerified: true
          });
          
          console.log('[INIT] ✅ User updated successfully');
          
        } catch (updateError) {
          console.error('[INIT] ❌ UPDATE USER FAILED:', updateError);
          console.error('[INIT] Error code:', updateError.code);
          console.error('[INIT] Error message:', updateError.message);
          // Don't throw - continue with code generation
        }
      } else {
        console.log('[INIT] No update needed');
      }
    }

    // 4. Generate SSO Code
    const code = crypto.randomBytes(16).toString('hex');
    console.log('[INIT] Generated SSO code:', code);

    // 5. Store in Firestore
    const db = admin.firestore();
    const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 5 * 60 * 1000));

    await db.collection('sso_codes').doc(code).set({
      uid: uid,
      email: email,
      displayName: name,
      photoURL: picture,
      emailVerified: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: expiresAt
    });

    console.log('[INIT] ✅ SSO code stored in Firestore');
    console.log('[INIT] ===== SSO INIT END =====');

    return res.status(200).json({ 
      success: true, 
      code: code,
      expiresIn: 300,
      debug: {
        uid,
        email,
        name,
        userExists
      }
    });

  } catch (error) {
    console.error('[INIT] ❌❌❌ FATAL ERROR ❌❌❌');
    console.error('[INIT] Error:', error);
    console.error('[INIT] Error code:', error.code);
    console.error('[INIT] Error message:', error.message);
    console.error('[INIT] Stack:', error.stack);
    
    return res.status(500).json({ 
      error: 'Internal Server Error', 
      details: error.message,
      code: error.code
    });
  }
}