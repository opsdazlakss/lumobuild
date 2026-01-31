import admin from 'firebase-admin';

// Initialize Firebase Admin (Reuse pattern from sso-token.js)
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
  // CORS params
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { targetUserIds, title, body, data } = req.body;

  if (!targetUserIds || !Array.isArray(targetUserIds) || targetUserIds.length === 0) {
    return res.status(400).json({ error: 'targetUserIds array is required' });
  }

  if (!title || !body) {
    return res.status(400).json({ error: 'title and body are required' });
  }

  try {
    // 1. Fetch FCM tokens for all target users
    const tokens = [];
    const db = admin.firestore();
    
    // Batch fetch user documents
    // Note: Firestore 'in' query supports max 10 items. If we have more, we need multiple queries.
    // For simplicity/safety, we'll process in chunks of 10.
    
    // De-duplicate IDs
    const uniqueIds = [...new Set(targetUserIds)];
    
    const chunkSize = 10;
    for (let i = 0; i < uniqueIds.length; i += chunkSize) {
        const batch = uniqueIds.slice(i, i + chunkSize);
        const snapshot = await db.collection('users').where(admin.firestore.FieldPath.documentId(), 'in', batch).get();
        
        snapshot.forEach(doc => {
            const userData = doc.data();
            // Check if user has FCM token AND notifications enabled (optional check if we save settings to root)
            // Assuming settings are in 'settings' subcollection or root fields. 
            // For now, check fcmTokens existence.
            if (userData.fcmTokens) {
                // Determine if it's a single token string or array
                if (Array.isArray(userData.fcmTokens)) {
                    tokens.push(...userData.fcmTokens);
                } else {
                    tokens.push(userData.fcmTokens);
                }
            }
        });
    }

    if (tokens.length === 0) {
        return res.status(200).json({ success: true, message: 'No registered devices found for users.' });
    }

    // 2. Send Multicast Message
    const message = {
        notification: {
            title: title,
            body: body,
        },
        data: data || {}, // Optional data payload
        tokens: tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log(`Successfully sent ${response.successCount} messages; ${response.failureCount} failed.`);

    return res.status(200).json({ 
        success: true, 
        sentCount: response.successCount, 
        failureCount: response.failureCount,
        responses: response.responses
    });

  } catch (error) {
    console.error('Error sending notification:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
