# 🎨 Voronoi Takvim Boyama

Duygularınızı takvim üzerinde renklendirin! Tamamen tarayıcıda çalışan, kurulum gerektirmeyen bir web uygulaması.

## ✨ Özellikler

- **Flood Fill Boyama**: Takvim görseliniz üzerinde alanları duygusal renklere boyayın
- **Duygu Paleti**: Mutlu (sarı), Üzgün (mavi), Öfkeli (kırmızı), Sakin (yeşil), Kaygılı (mor), Nötr (gri)
- **Özel Renkler**: Kendi renginizi seçebilirsiniz
- **Kalıcı Kayıt**: Tüm boyamalarınız tarayıcınızda otomatik kaydedilir
- **Not Ekleme**: Belirli alanlara sağ tıklayarak notlar ekleyin
- **Geri/İleri Al**: Ctrl+Z ve Ctrl+Y ile işlemleri geri alın
- **Dışa Aktarma**: PNG olarak indirin veya JSON yedek alın
- **Çevrimdışı Çalışma**: PWA desteği ile internet olmadan da kullanın

## 🚀 GitHub Pages'de Yayınlama

### Adım 1: GitHub Deposu Oluşturma
1. [github.com](https://github.com) adresine gidin ve giriş yapın
2. Sağ üstteki **+** butonuna tıklayın → **New repository**
3. Depo adı: `voronoi-takvim-boyama`
4. **Public** seçeneğini işaretleyin
5. **Create repository** butonuna tıklayın

### Adım 2: Dosyaları Yükleme
1. Oluşturulan depoda **uploading an existing file** linkine tıklayın
2. Tüm proje dosyalarını sürükleyip bırakın:
   - `index.html`
   - `style.css`
   - `app.js`
   - `manifest.json`
   - `sw.js`
   - `assets/` klasörü (içindeki ikonlarla birlikte)
3. **Commit changes** butonuna tıklayın

### Adım 3: GitHub Pages'i Etkinleştirme
1. Depo sayfasında **Settings** sekmesine gidin
2. Sol menüden **Pages** seçeneğine tıklayın
3. **Source** bölümünde:
   - Branch: `main`
   - Folder: `/ (root)`
4. **Save** butonuna tıklayın
5. Birkaç dakika bekleyin, siteniz şu adreste yayınlanacak:
   `https://KULLANICI_ADINIZ.github.io/voronoi-takvim-boyama/`

## 📖 Kullanım Kılavuzu

### İlk Kullanım
1. **Görsel Yükle**: "Takvim Görselini Yükle" butonuna tıklayın
2. Bilgisayarınızdan bir Voronoi takvim görseli (PNG veya JPG) seçin
3. Görsel otomatik olarak kaydedilir, bir sonraki ziyaretinizde tekrar yüklenir

### Boyama
1. Sol paneldeki **Duygu Paleti**'nden bir renk seçin
2. Takvim üzerinde boyamak istediğiniz alana tıklayın
3. Siyah/koyu sınır çizgileri boyamayı otomatik olarak durdurur
4. Zaten boyalı bir alana tıklarsanız renk değişir

### Not Ekleme
- **Yöntem 1**: Sağ tıklayın → "Not Ekle" seçin
- **Yöntem 2**: "📝 Not Ekle" butonunu aktif edin, sonra tıklayın

### Klavye Kısayolları
- `Ctrl + Z` : Geri Al
- `Ctrl + Y` : İleri Al

### Yedekleme
- **Yedek Al**: Tüm boyama ve notlarınızı JSON dosyası olarak indirin
- **Yedeği Yükle**: Daha önce aldığınız yedeği geri yükleyin
- **PNG İndir**: Boyalı takvimi görsel olarak indirin

## 🔒 Gizlilik Notu

**Tüm verileriniz tamamen tarayıcınızda kalır!**

- Hiçbir veri sunucuya gönderilmez
- Görselleriniz ve boyamalarınız IndexedDB'de saklanır
- Tarayıcı verilerini temizlerseniz çalışmalarınız da silinir
- Önemli çalışmaları "Yedek Al" özelliğiyle dışa aktarmanızı öneririz

## 📱 Masaüstüne Ekleme (PWA)

### Chrome / Edge
1. Adres çubuğundaki **⊕** simgesine tıklayın
2. "Yükle" veya "Uygulama olarak yükle" seçeneğini tıklayın
3. Uygulama masaüstünüze eklenir ve çevrimdışı çalışır

### Firefox
1. Menüyü açın (☰)
2. "Daha fazla araç" → "Kısayol oluştur" seçin

---

## 🛠️ Teknik Bilgiler

- **Teknoloji**: Vanilla HTML/CSS/JS (harici kütüphane yok)
- **Depolama**: IndexedDB (büyük görseller için)
- **Çevrimdışı**: Service Worker ile PWA desteği
- **Uyumluluk**: Chrome, Edge, Firefox, Safari (modern sürümler)

---

## 📋 Dağıtım Kontrol Listesi

- [ ] Tüm dosyalar GitHub'a yüklendi
- [ ] GitHub Pages etkinleştirildi
- [ ] Site URL'si çalışıyor
- [ ] Görsel yükleme testi yapıldı
- [ ] Boyama testi yapıldı
- [ ] Sayfa yenilendikten sonra veriler korunuyor
- [ ] PNG dışa aktarma çalışıyor
- [ ] JSON yedekleme/geri yükleme çalışıyor

---

**Geliştirici**: Bu proje tamamen tarayıcıda çalışan, sunucu gerektirmeyen bir statik web uygulamasıdır.