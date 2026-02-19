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

    // Run as a Transaction (one-time use)
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

    console.log(`[EXCHANGE] Code for ${result.email}, isNewUser: ${result.isNewUser}`);

    // ✅ FIRESTORE KULLANICI KAYDI
    const userDocRef = db.collection('users').doc(result.uid);
    const userDoc = await userDocRef.get();

    // Profil eksikse oluştur/onar (updatePresence minimal doc oluşturmuş olabilir)
    const existingData = userDoc.exists ? userDoc.data() : {};
    const isProfileIncomplete = !userDoc.exists || !existingData.email || !existingData.displayName;

    if (isProfileIncomplete) {
      console.log('[EXCHANGE] Profile missing or incomplete, creating/repairing...');
      
      // Benzersiz displayName kontrolü (sadece yeni displayName atanacaksa)
      let uniqueDisplayName = existingData.displayName || result.displayName;
      
      if (!existingData.displayName) {
        const usersSnapshot = await db.collection('users')
          .where('displayName', '==', uniqueDisplayName)
          .get();
        
        let nameTaken = false;
        usersSnapshot.forEach(doc => {
          if (doc.id !== result.uid) nameTaken = true;
        });

        if (nameTaken) {
          const randomSuffix = Math.floor(1000 + Math.random() * 9000);
          uniqueDisplayName = `${uniqueDisplayName}#${randomSuffix}`;
        }
      }

      // ✅ SSO ile gelen yeni kullanıcıları otomatik olarak Meydan sunucusuna ekle
      const DEFAULT_SSO_SERVER_ID = 'jOgYkJ4jrMvjr1bYXRkg';
      const currentServers = existingData.servers || [];
      
      if (!currentServers.includes(DEFAULT_SSO_SERVER_ID)) {
        console.log('[EXCHANGE] Adding SSO user to Meydan server...');
        currentServers.push(DEFAULT_SSO_SERVER_ID);
      }

      // ✅ Profil oluştur/onar — mevcut role ve servers KORUNUR
      await userDocRef.set({
        displayName: uniqueDisplayName,
        email: result.email,
        photoUrl: result.photoURL,
        role: existingData.role || 'member',
        createdAt: existingData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        isOnline: true,
        lastSeen: admin.firestore.FieldValue.serverTimestamp(),
        isUsernameSet: existingData.isUsernameSet !== undefined ? existingData.isUsernameSet : true,
        servers: currentServers
      }, { merge: true });

      console.log('[EXCHANGE] ✅ Profile created/repaired:', uniqueDisplayName);

      // ✅ Sunucunun members koleksiyonuna üye kaydı ekle (yoksa)
      const memberRef = db.collection('servers').doc(DEFAULT_SSO_SERVER_ID).collection('members').doc(result.uid);
      const memberDoc = await memberRef.get();
      
      if (!memberDoc.exists) {
        await memberRef.set({
          userId: result.uid,
          joinedAt: admin.firestore.FieldValue.serverTimestamp(),
          role: 'member'
        });
        
        // Sunucu üye sayısını artır
        await db.collection('servers').doc(DEFAULT_SSO_SERVER_ID).update({
          memberCount: admin.firestore.FieldValue.increment(1)
        });
        
        console.log('[EXCHANGE] ✅ User added to Meydan server');
      }

      // Firebase Auth güncelle (sadece yeni kullanıcılar için)
      if (!userDoc.exists) {
        await admin.auth().updateUser(result.uid, {
          displayName: uniqueDisplayName,
          photoURL: result.photoURL,
          emailVerified: true
        });
        console.log('[EXCHANGE] ✅ Firebase Auth profile updated');
      }

    } else {
      // ✅ Tam profili olan mevcut kullanıcı — sadece presence güncelle
      console.log('[EXCHANGE] Existing user with complete profile, updating presence only...');
      await userDocRef.set({
        isOnline: true,
        lastSeen: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    // Create Custom Token
    const customToken = await admin.auth().createCustomToken(result.uid, {
      sso: true,
      source: 'sso_code_flow',
      isNewUser: result.isNewUser
    });

    return res.status(200).json({ 
      success: true, 
      customToken: customToken,
      user: {
        email: result.email,
        displayName: result.displayName,
        photoURL: result.photoURL,
        uid: result.uid
      },
      isNewUser: result.isNewUser
    });

  } catch (error) {
    console.error('[EXCHANGE] Error:', error);
    
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