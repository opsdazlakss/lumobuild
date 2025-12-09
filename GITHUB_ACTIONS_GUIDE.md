# GitHub Actions ile Cross-Platform Build Rehberi

## Kurulum Adımları

### 1. Kodu GitHub'a Yükleyin
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/KULLANICI_ADI/REPO_ADI.git
git push -u origin main
```

### 2. Build Başlatma Yöntemleri

#### Yöntem A: Manuel Trigger (En Kolay)
1. GitHub repo'nuza gidin
2. **Actions** tab'ına tıklayın
3. Solda **Build Lumo** workflow'unu seçin
4. Sağ üstte **Run workflow** butonuna tıklayın
5. **Run workflow** (yeşil buton) ile onaylayın

#### Yöntem B: Git Tag ile Otomatik Build
```bash
git tag v1.0.0
git push origin v1.0.0
```

### 3. Build'leri İndirin

**Actions sayfasından:**
- Actions → Build Lumo → Son workflow'u seçin
- Aşağıdaki **Artifacts** bölümünden indirin:
  - `Lumo-Windows` (.exe)
  - `Lumo-macOS` (.dmg)
  - `Lumo-Linux` (.AppImage)

**Release sayfasından (eğer tag kullandıysanız):**
- Releases → Son release
- Tüm platformlar için installer'lar otomatik eklenmiş olacak

## Build Süresi
- Her platform: ~5-10 dakika
- Toplam: ~15-30 dakika (paralel çalışır)

## Notlar
- `.env` dosyası GitHub'a yüklenmiyor (güvenlik)
- Firebase config'i GitHub Secrets ile eklenebilir
- Build sınırı: Aylık 2000 dakika (ücretsiz hesapta)
