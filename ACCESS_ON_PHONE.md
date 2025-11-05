# 📱 Telefonda Erişim İçin Talimatlar

## ✅ Yöntem 1: Localtunnel (En Kolay - Ücretsiz, Hesap Gerektirmez)

1. **Yeni bir Terminal penceresi açın**

2. **Proje klasörüne gidin:**
   ```bash
   cd "/Users/omersogancioglu/Ten news website "
   ```

3. **Localtunnel'ı çalıştırın:**
   ```bash
   npx localtunnel --port 3000
   ```

4. **Terminal'de bir URL göreceksiniz, örneğin:**
   ```
   your url is: https://random-name-123.loca.lt
   ```

5. **Bu URL'yi telefonunuzda Safari'de açın!**

6. **İlk açılışta bir uyarı görebilirsiniz - "Continue" butonuna tıklayın**

---

## 🔧 Yöntem 2: ngrok (Daha Stabil, Ama Hesap Gerektirir)

1. **ngrok hesabı oluşturun:** https://dashboard.ngrok.com/signup

2. **Auth token'ı alın** (Dashboard'dan)

3. **Terminal'de şunu çalıştırın:**
   ```bash
   cd "/Users/omersogancioglu/Ten news website "
   ./ngrok config add-authtoken YOUR_TOKEN_HERE
   ```

4. **ngrok'u başlatın:**
   ```bash
   ./ngrok http 3000
   ```

5. **Terminal'de göreceğiniz URL'yi (https://xxxx.ngrok.io) telefonunuzda açın**

---

## 📝 Notlar

- Dev server'ın çalıştığından emin olun (`npm run dev`)
- Her iki yöntem de geçici URL'ler verir (yeniden başlatınca değişir)
- Localtunnel ilk açılışta bir uyarı gösterebilir - normaldir


