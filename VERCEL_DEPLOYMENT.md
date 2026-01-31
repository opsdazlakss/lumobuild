# SSO Backend Deployment Guide

Bu rehber, Vercel üzerinde SSO backend'inizi nasıl deploy edeceğinizi gösterir.

## 📋 Gereksinimler

- ✅ Vercel hesabı (ücretsiz)
- ✅ Firebase service account key (zaten var)
- ✅ Git repository (GitHub, GitLab, veya Bitbucket)

## 🚀 Deployment Adımları

### 1. Firebase Admin SDK'yı Yükleyin

```bash
cd c:\Users\Hasan\Desktop\dss
npm install firebase-admin
```

### 2. Vercel Hesabı Oluşturun

1. https://vercel.com adresine gidin
2. "Sign Up" butonuna tıklayın
3. GitHub ile giriş yapın (önerilen)

### 3. Projeyi Vercel'e Deploy Edin

**Seçenek A: Vercel Dashboard (Kolay)**

1. https://vercel.com/new adresine gidin
2. "Import Git Repository" seçin
3. GitHub repository'nizi seçin
4. "Deploy" butonuna tıklayın

**Seçenek B: Vercel CLI (Hızlı)**

```bash
# Vercel CLI'yi yükleyin
npm install -g vercel

# Login
vercel login

# Deploy
vercel
```

### 4. Environment Variables Ekleyin

Vercel Dashboard'da:

1. Projenizi seçin
2. **Settings** → **Environment Variables**
3. Şu 3 değişkeni ekleyin:

**FIREBASE_PROJECT_ID**
```
meydan-academy
```

**FIREBASE_CLIENT_EMAIL**
```
firebase-adminsdk-fbsvc@meydan-academy.iam.gserviceaccount.com
```

**FIREBASE_PRIVATE_KEY**
```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC5v4x9N8V91938
8/VGp8faa/e8ru7/KAqV6KrIkP4u90CICAJbnWSxD09kRIC/WZb7A0yAjbrTtV7O
MZq9TuyJ6DW2Joe27An06DeML2NOFAffHnxQXBPv0otT0m7VBoNFUrsPJ4bsbnnS
HiiWqbQUyEdKjtQoJ+5lZaQzLehCDPo4rAkeNTIU7S24KYcmsCvHifK78pKral6k
szv6OvySHyj1KYHru6L9yVtF/NyrGiGBUQKNvx/F4eY+DmIaLiWQBrR7tUZMUGTX
rOfbToAPlbrMGmcxyo9TFD5/HTju3jDKV0jXd2RGHJQ6Ghhy/P7BgKL5kPbJ78OT
rIAJbGyDAgMBAAECggEAPYXnd5YgcMUuPtljFUr/VCZMwQ9EE/lkQDD3WEVGG7JD
ior0lPm13zuN9U0HQ9nduzhlf3LyPasmQq+FbEyW5jqmh7WNYBYgWiEMPP95KeRS
kyFa1ZcZ92ZKRbI+iYqFslFrqeJSuz8AVIsusHB3OCb6DgTu2noXaThYQadj9XQa
7wSbLQGQuKgdEixVBpLd+Opoo+/SQCCo554Qu3ySvET8phtO6xsAWgA5wUYT95KR
r2B7a8qf7/b6Lx7k4qDZUbK/Gm72bd7WRkgy8+9DEXPlZLKIfI156590FrmAG72V
J5PPaAxQMvS1Uq2/O7GvLIufervVbe9rxksPTEvvaQKBgQD8doSch3Bd4RUHc4r1
Po91emF4kAEztC2GxVxZY/tu019vXgU+zAe3fGdZZvYtQkEMRnRo3Im89xRMAPdN
mbVd9qYsI2qZNkTve5UXGXFlmzx0xG4LIuhPtbGd2QqaELzC37/VDVJP2dbibppp
9/8LwpFfTqxB7rIQbEojIoiGtwKBgQC8WcCPQSDGEkU35VXlf+wbYq03sCFGDwOo
EgQgYMLuDVf3onC0+QV0TyXXESNsRhAVnqff0xQnwExYQNPnlhegQvdBRoq0Szrg
y+alWBX7p0XvJAmPmCvqnkz9b/UgjqWBVpikxPiId5VPBTcI+l+x2KHH/FLFy2R0
2j7PfpYclQKBgQDGzi2vdZgu1UhSDdKnPRSLVkvbPMs1g/U148TNP8aHhzvn3woS
YWjSPMzFwiapjTrcB78ztDdi7s606y3Tle8Uh15j85/F9s5iJ9dH0WlSsePxr51Y
d6yo2FN+EaQfnn6GltvhUhQ3fTuSI7bFK91TzWvcuX88jFL8S8o10MPiEQKBgHjM
V2OJMavXK+2deGmokZU+xDljDPQRzRaN93eMl3h1tmVsGTz4OTdPS8WTiFR42vgC
uUgj6FlWS6COc1mkOaLfUBTdWTgox6pFG7gPtomfzoqBYmBmCESBIn+ovl4THrLF
B0El0wAzMd9sSM/JRHabqabJfYy91b/b+Uy6syvBAoGAI5GqgkL+GzcoM3a+uSgY
VKcrtIL/GLmkDuPrXrijiUKCGGrm0urYsDgXPuYsIn1euEIIIoVKhDCPBMPcTXO8
tduLc8uKx8pfyGvl/LDcsmZgeHbiBTaUnW2UiqWIinoEEtzqfkvlyGiiRkph+uwb
XvHQ9/zitWattw8VXH9D4J8=
-----END PRIVATE KEY-----
```

> ⚠️ **ÖNEMLİ:** Her bir değişken için "All Environments" seçin (Production, Preview, Development)

### 5. Redeploy Edin

Environment variables ekledikten sonra:

1. **Deployments** sekmesine gidin
2. En son deployment'ın yanındaki **⋯** (üç nokta) menüsüne tıklayın
3. **Redeploy** seçin

### 6. Test Edin

Deploy tamamlandıktan sonra API endpoint'iniz hazır:

```
https://your-project-name.vercel.app/api/sso-token
```

**Test komutu:**
```bash
curl -X POST https://your-project-name.vercel.app/api/sso-token \
  -H "Content-Type: application/json" \
  -d '{"googleIdToken": "test-token"}'
```

## 🔧 Frontend Entegrasyonu

SSO backend'i hazır olduğunda, MeydanApp'ten şu şekilde kullanabilirsiniz:

```javascript
// MeydanApp'te Google ile giriş yaptıktan sonra
const user = auth.currentUser;
const googleIdToken = await user.getIdToken();

// SSO backend'e istek gönder
const response = await fetch('https://your-project.vercel.app/api/sso-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ googleIdToken })
});

const { customToken } = await response.json();

// Lumo app'e yönlendir
window.location.href = `https://lumo-app.com/sso?token=${customToken}`;
```

## 📊 Monitoring

Vercel Dashboard'da:
- **Analytics**: API çağrı istatistikleri
- **Logs**: Hata logları ve debug bilgileri
- **Usage**: Ücretsiz limit kullanımı

## ⚡ Sonraki Adımlar

1. ✅ Backend deploy edildi
2. ⬜ Frontend SSO entegrasyonu
3. ⬜ MeydanApp'ten SSO flow testi
4. ⬜ Production'a geçiş

## 🆘 Sorun Giderme

**"Module not found: firebase-admin"**
```bash
npm install firebase-admin
git add package.json package-lock.json
git commit -m "Add firebase-admin"
git push
```

**"Invalid credentials"**
- Environment variables'ları kontrol edin
- FIREBASE_PRIVATE_KEY'in tırnak içinde olduğundan emin olun
- Redeploy yapın

**"CORS error"**
- `api/sso-token.js` dosyasında CORS headers'ı kontrol edin
- Production'da sadece kendi domain'inizden izin verin
