import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the generated plugin directory's .settings folder
const directory = path.join(__dirname, '../android/capacitor-cordova-android-plugins/.settings');
const file = path.join(directory, 'org.eclipse.buildship.core.prefs');

// Content required by Eclipse/Buildship
const content = 'connection.project.dir=..\neclipse.preferences.version=1';

try {
  // Ensure directory exists
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
    console.log(`Created directory: ${directory}`);
  }

  // Write file with UTF-8 encoding
  fs.writeFileSync(file, content, 'utf8');
  console.log(`✅ Success: Fixed Gradle configuration at ${file}`);
} catch (error) {
  console.error('❌ Error fixing Gradle configuration:', error);
  process.exit(1);
}
