const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
// Expects FIREBASE_SERVICE_ACCOUNT_KEY env variable to be the JSON string of the key
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function updateVersion() {
  try {
    // Read package.json
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
    const version = packageJson.version;

    // Get CLI arguments
    // Usage: node update-firestore-version.js <downloadUrl>
    const downloadUrl = process.argv[2];

    if (!downloadUrl) {
      console.error('Error: Download URL must be provided as an argument');
      process.exit(1);
    }

    console.log(`Updating Firestore version to ${version} with URL: ${downloadUrl}`);

    // Update Firestore
    await db.collection('system').doc('app_version').set({
      android: version,
      downloadUrl: downloadUrl,
      forceUpdate: false, // Default to false, can be changed manually if needed
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log('Successfully updated system/app_version');
  } catch (error) {
    console.error('Error updating version:', error);
    process.exit(1);
  }
}

updateVersion();
