import { collection, addDoc, setDoc, doc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Migration script to set up default server and migrate existing data
 * Run this ONCE after deploying multi-server feature
 */
export const migrateToMultiServer = async () => {
  console.log('🚀 Starting multi-server migration...');

  try {
    // Step 1: Create default server
    console.log('📦 Creating default server...');
    const defaultServerRef = await addDoc(collection(db, 'servers'), {
      name: 'Lumo',
      ownerId: 'system',
      createdAt: serverTimestamp(),
      isDefault: true,
      memberCount: 0
    });
    const defaultServerId = defaultServerRef.id;
    console.log(`✅ Default server created: ${defaultServerId}`);

    // Step 2: Get all users
    console.log('👥 Loading users...');
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const users = [];
    usersSnapshot.forEach((doc) => {
      users.push({ id: doc.id, ...doc.data() });
    });
    console.log(`✅ Found ${users.length} users`);

    // Step 3: Add all users to default server
    console.log('➕ Adding users to default server...');
    for (const user of users) {
      await setDoc(doc(db, 'servers', defaultServerId, 'members', user.id), {
        userId: user.id,
        joinedAt: serverTimestamp(),
        role: user.role || 'member'
      });

      // Update user document
      await setDoc(doc(db, 'users', user.id), {
        ...user,
        servers: [defaultServerId],
        currentServer: defaultServerId
      }, { merge: true });
    }
    console.log(`✅ Added ${users.length} users to default server`);

    // Step 4: Migrate channels to server
    console.log('📁 Migrating channels...');
    const channelsSnapshot = await getDocs(collection(db, 'channels'));
    const channels = [];
    channelsSnapshot.forEach((doc) => {
      channels.push({ id: doc.id, ...doc.data() });
    });

    for (const channel of channels) {
      await setDoc(doc(db, 'servers', defaultServerId, 'channels', channel.id), channel);
    }
    console.log(`✅ Migrated ${channels.length} channels`);

    // Step 5: Migrate messages to server-scoped channels
    console.log('💬 Migrating messages...');
    let totalMessages = 0;
    for (const channel of channels) {
      const messagesSnapshot = await getDocs(collection(db, 'channels', channel.id, 'messages'));
      const messages = [];
      messagesSnapshot.forEach((doc) => {
        messages.push({ id: doc.id, ...doc.data() });
      });

      for (const message of messages) {
        await setDoc(
          doc(db, 'servers', defaultServerId, 'channels', channel.id, 'messages', message.id),
          message
        );
      }
      totalMessages += messages.length;
    }
    console.log(`✅ Migrated ${totalMessages} messages`);

    console.log('🎉 Migration completed successfully!');
    console.log(`
      Summary:
      - Default server: ${defaultServerId}
      - Users: ${users.length}
      - Channels: ${channels.length}
      - Messages: ${totalMessages}
    `);

    return {
      success: true,
      defaultServerId,
      stats: {
        users: users.length,
        channels: channels.length,
        messages: totalMessages
      }
    };
  } catch (err) {
    console.error('❌ Migration failed:', err);
    return {
      success: false,
      error: err.message
    };
  }
};

// Helper function to check if migration is needed
export const checkMigrationStatus = async () => {
  try {
    const serversSnapshot = await getDocs(collection(db, 'servers'));
    return serversSnapshot.empty;
  } catch (err) {
    console.error('Error checking migration status:', err);
    return true; // Assume migration needed if check fails
  }
};
