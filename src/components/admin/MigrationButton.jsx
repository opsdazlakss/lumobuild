import { useState } from 'react';
import { Button } from '../shared/Button';
import { useToast } from '../../context/ToastContext';
import { migrateToMultiServer, checkMigrationStatus } from '../../utils/migration';

export const MigrationButton = () => {
  const [migrating, setMigrating] = useState(false);
  const [migrationNeeded, setMigrationNeeded] = useState(null);
  const { success, error } = useToast();

  const handleCheckMigration = async () => {
    const needed = await checkMigrationStatus();
    setMigrationNeeded(needed);
  };

  const handleMigrate = async () => {
    if (!window.confirm('This will migrate all data to multi-server structure. Continue?')) {
      return;
    }

    setMigrating(true);
    try {
      const result = await migrateToMultiServer();
      if (result.success) {
        success(`Migration completed! Server ID: ${result.defaultServerId}`);
        setMigrationNeeded(false);
      } else {
        error(`Migration failed: ${result.error}`);
      }
    } catch (err) {
      error('Migration failed');
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
      <h3 className="text-yellow-500 font-semibold mb-2">⚠️ Multi-Server Migration</h3>
      <p className="text-dark-text text-sm mb-3">
        Run this ONCE to set up default server and migrate existing data.
      </p>
      
      {migrationNeeded === null && (
        <Button
          variant="secondary"
          onClick={handleCheckMigration}
          className="w-full"
        >
          Check Migration Status
        </Button>
      )}

      {migrationNeeded === true && (
        <Button
          variant="primary"
          onClick={handleMigrate}
          disabled={migrating}
          className="w-full bg-yellow-500 hover:bg-yellow-600"
        >
          {migrating ? 'Migrating...' : 'Run Migration'}
        </Button>
      )}

      {migrationNeeded === false && (
        <div className="text-green-500 text-sm">
          ✅ Migration already completed
        </div>
      )}
    </div>
  );
};
