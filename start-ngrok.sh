#!/bin/bash
cd "$(dirname "$0")"

echo "🔍 ngrok kontrol ediliyor..."
if [ ! -f "./ngrok" ]; then
    echo "❌ ngrok bulunamadı!"
    echo "📥 İndiriliyor..."
    curl -o /tmp/ngrok.zip https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-darwin-amd64.zip
    unzip -q /tmp/ngrok.zip -d .
    chmod +x ./ngrok
    rm /tmp/ngrok.zip
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  İLK KULLANIM İÇİN:"
echo "1. https://dashboard.ngrok.com/signup adresinden ücretsiz hesap oluşturun"
echo "2. Dashboard'dan auth token alın"
echo "3. Şu komutu çalıştırın: ./ngrok config add-authtoken YOUR_TOKEN"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🚀 ngrok başlatılıyor..."
echo "📱 Aşağıda göreceğiniz 'Forwarding' URL'sini telefonunuzda açın!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

./ngrok http 3000
