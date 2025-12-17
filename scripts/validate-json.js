
const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '../android/app/google-services.json');

try {
  if (!fs.existsSync(jsonPath)) {
    console.error('❌ HATA: android/app/google-services.json dosyası bulunamadı!');
    process.exit(1);
  }

  const content = fs.readFileSync(jsonPath, 'utf8');
  const json = JSON.parse(content);
  
  const client = json.client[0];
  const oauth = client.oauth_client;
  const packageName = client.client_info.android_client_info.package_name;
  
  console.log('--- Google Services JSON Analizi ---');
  console.log('Paket Adı:', packageName);
  
  if (packageName !== 'com.hasan.lumo') {
    console.error('❌ HATA: Paket adı yanlış! Beklenen: com.hasan.lumo, Bulunan:', packageName);
  } else {
    console.log('✅ Paket adı doğru.');
  }

  if (!oauth || oauth.length === 0) {
    console.error('❌ KRİTİK HATA: "oauth_client" listesi BOŞ!');
    console.error('Bu, SHA-1 imzasının Firebase konsoluna eklenmediğini veya dosyanın güncellenmediğini gösterir.');
    console.error('FIS_AUTH_ERROR hatasının sebebi %100 budur.');
  } else {
    console.log('✅ OAuth client bilgisi mevcut (SHA-1 eklenmiş görünüyor).');
    console.log('Client ID:', oauth[0].client_id);
  }

} catch (e) {
  console.error('Dosya okuma hatası:', e);
}
