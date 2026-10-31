# Sohbet

Kullanıcı adıyla girip anında sohbet edilen basit, gerçek zamanlı mesajlaşma sitesi (Node.js + Express + Socket.io).

## Yerelde çalıştırma

```bash
npm install
npm start
```

Tarayıcıda http://localhost:3000 adresini aç.

## Render'a yükleme

1. Projeyi bir GitHub deposuna yükle.
2. Render'da **New → Web Service** seç ve depoyu bağla.
3. Ayarlar:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. **Create Web Service** butonuna bas. Port'u Render otomatik verir (`PORT` ortam değişkeni).

> Not: Mesajlar sunucu belleğinde tutulur (son 100 mesaj). Sunucu yeniden başladığında ya da ücretsiz planda uykuya geçtiğinde geçmiş silinir.
