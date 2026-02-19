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
    let uid = decodedToken.uid;
    const email = decodedToken.email;
    const name = decodedToken.name || decodedToken.email?.split('@')[0] || 'User';
    const picture = decodedToken.picture || null;

    console.log('[INIT] Token Info:', { uid, email, name });

    // 2. Check if user exists (UID veya EMAIL ile ara)
    let userRecord;
    let isNewUser = false;
    
    try {
      userRecord = await admin.auth().getUser(uid);
      console.log('[INIT] ✅ Existing user found by UID');
      
      // Eksik bilgileri tamamla
      const needsRepair = 
        !userRecord.email ||
        !userRecord.displayName ||
        (userRecord.providerData && userRecord.providerData.length === 0);

      if (needsRepair) {
        console.log('[INIT] ⚠️ User profile incomplete, repairing...');
        
        await admin.auth().updateUser(uid, {
          email: userRecord.email || email,
          displayName: userRecord.displayName || name,
          photoURL: userRecord.photoURL || picture,
          emailVerified: true
        });
        
        console.log('[INIT] ✅ Incomplete profile repaired');
      } else {
        console.log('[INIT] Profile complete, no update needed');
      }

    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // UID bulunamadı — EMAIL ile ara (mobil Google sign-in farklı UID oluşturmuş olabilir)
        console.log('[INIT] UID not found, checking by email...');
        
        try {
          userRecord = await admin.auth().getUserByEmail(email);
          // ✅ Aynı email ile farklı UID'de kullanıcı bulundu — onun UID'sini kullan
          uid = userRecord.uid;
          isNewUser = false;
          console.log('[INIT] ✅ Existing user found by EMAIL, using UID:', uid);
          
        } catch (emailErr) {
          if (emailErr.code === 'auth/user-not-found') {
            // Gerçekten yeni kullanıcı — oluştur
            console.log('[INIT] 🆕 New user, creating with full profile...');
            isNewUser = true;
            
            const randomPassword = crypto.randomBytes(32).toString('hex');
            
            userRecord = await admin.auth().createUser({
              uid: uid,
              email: email,
              password: randomPassword,
              displayName: name,
              photoURL: picture,
              emailVerified: true
            });
            
            console.log('[INIT] ✅ New user created');
          } else {
            throw emailErr;
          }
        }
      } else {
        throw error;
      }
    }

    // 3. Generate SSO Code
    const code = crypto.randomBytes(16).toString('hex');

    // 4. Store in Firestore
    const db = admin.firestore();
    const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 5 * 60 * 1000));

    // 🧹 Süresi dolmuş tüm SSO kodlarını temizle
    try {
      const now = admin.firestore.Timestamp.now();
      const expiredCodes = await db.collection('sso_codes')
        .where('expiresAt', '<', now)
        .get();
      
      if (!expiredCodes.empty) {
        const batch = db.batch();
        expiredCodes.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        console.log(`[INIT] 🧹 Cleaned up ${expiredCodes.size} expired SSO codes`);
      }
    } catch (cleanupErr) {
      // Temizleme hatası ana akışı engellemez
      console.warn('[INIT] Cleanup warning:', cleanupErr.message);
    }

    await db.collection('sso_codes').doc(code).set({
      uid: uid,
      email: email,
      displayName: name,
      photoURL: picture,
      emailVerified: true,
      isNewUser: isNewUser, // ← Yeni eklendi (exchange'de kullanılacak)
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: expiresAt
    });

    console.log('[INIT] ✅ SSO code generated');

    return res.status(200).json({ 
      success: true, 
      code: code,
      expiresIn: 300
    });

  } catch (error) {
    console.error('[INIT] Error:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error', 
      details: error.message
    });
  }
}