# ngrok Kurulumu (Telefon Erişimi İçin)

## Adım 1: ngrok Hesabı Oluşturun
1. https://dashboard.ngrok.com/signup adresine gidin
2. Ücretsiz hesap oluşturun (email ile kayıt olun)

## Adım 2: Auth Token Alın
1. Dashboard'a giriş yaptıktan sonra
2. Sol menüden "Your Authtoken" seçin
3. Token'ı kopyalayın (örnek: `2abc123xyz456...`)

## Adım 3: ngrok'u Yapılandırın
Terminal'de şunu çalıştırın:
```bash
cd "/Users/omersogancioglu/Ten news website "
./ngrok config add-authtoken YOUR_TOKEN_HERE
```
(YOUR_TOKEN_HERE yerine dashboard'dan aldığınız token'ı yapıştırın)

## Adım 4: ngrok'u Başlatın
```bash
./ngrok http 3000
```

## Adım 5: URL'yi Telefonda Açın
Terminal'de göreceğiniz URL'yi (örnek: `https://abc123.ngrok.io`) telefonunuzda Safari'de açın!

---

**Not:** ngrok URL'si her başlatışta değişir. Sabit bir URL isterseniz ngrok'a ödeme yapmanız gerekir.


