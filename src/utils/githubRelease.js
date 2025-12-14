
/**
 * Fetches the latest release data from GitHub repository
 * @returns {Promise<{
 *   version: string,
 *   downloadUrl: {
 *     win: string | null,
 *     mac: string | null,
 *     linux: string | null
 *   }
 * }>}
 */
export async function getLatestRelease() {
  const REPO_OWNER = 'opsdazlakss';
  const REPO_NAME = 'lumobuild';
  
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch latest release');
    }

    const data = await response.json();
    const assets = data.assets;

    // Find assets for each platform
    // Looking for patterns like: LumoSetup_win-1.1.5.exe
    const winAsset = assets.find(a => a.name.endsWith('.exe') && a.name.includes('win'));
    const macAsset = assets.find(a => a.name.endsWith('.dmg') && a.name.includes('mac'));
    const linuxAsset = assets.find(a => a.name.endsWith('.AppImage') && a.name.includes('linux'));

    return {
      version: data.tag_name, // e.g., "v1.1.5"
      downloadUrl: {
        win: winAsset ? winAsset.browser_download_url : null,
        mac: macAsset ? macAsset.browser_download_url : null,
        linux: linuxAsset ? linuxAsset.browser_download_url : null
      }
    };
  } catch (error) {
    console.error('Error fetching release:', error);
    return null;
  }
}
