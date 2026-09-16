(() => {
  'use strict';

  const burger = document.getElementById('burger');
  const nav = document.getElementById('nav');
  if (burger && nav) {
    const closeMenu = () => {
      nav.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
    };
    burger.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      burger.setAttribute('aria-expanded', String(open));
    });
    nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
    });
  }

  // V13 one-page navigation: top-level menu scrolls to sections instead of opening
  // duplicate pages. Detail pages link back to index.html#section.
  const hashLinks = [...document.querySelectorAll('a[href^="#"]')];
  hashLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      const id = (link.getAttribute('href') || '').slice(1);
      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return;
      event.preventDefault();
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block: 'start'});
      if (history.replaceState) history.replaceState(null, '', `#${id}`);
    });
  });

  const sectionLinks = [...document.querySelectorAll('[data-section-link]')];
  if (sectionLinks.length && 'IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      sectionLinks.forEach((link) => link.classList.toggle('active', link.dataset.sectionLink === visible.target.id));
    }, {rootMargin: '-22% 0px -62% 0px', threshold: [0, .1, .35]});
    sectionLinks.forEach((link) => {
      const id = link.dataset.sectionLink;
      const section = id ? document.getElementById(id) : null;
      if (section) sectionObserver.observe(section);
    });
  }

  const revealItems = [...document.querySelectorAll('.reveal')];
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach((element) => element.classList.add('is-visible'));
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -24px 0px' });
    revealItems.forEach((element, index) => {
      element.style.transitionDelay = `${Math.min((index % 4) * 35, 105)}ms`;
      observer.observe(element);
    });
    // Safety fallback: content must never remain invisible if an observer behaves
    // differently in a local file, embedded preview, or restrictive browser mode.
    window.setTimeout(() => revealItems.forEach((element) => element.classList.add('is-visible')), 1800);
  }

  // Never show a broken-image icon if a remote company photo disappears or blocks hotlinking.
  document.querySelectorAll('img').forEach((image) => {
    const markFailed = () => {
      const parent = image.parentElement;
      if (parent) parent.classList.add('image-failed');
      image.remove();
    };
    image.addEventListener('error', markFailed, { once: true });
    if (image.complete && image.naturalWidth === 0) markFailed();
  });

  const galleryImages = [...document.querySelectorAll('.gallery-mosaic img, .gallery-strip img, .full-gallery img')];
  if (galleryImages.length) {
    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.setAttribute('aria-label', 'Просмотр изображения');
    lightbox.innerHTML = '<button type="button" aria-label="Закрыть">×</button><img alt="">';
    document.body.appendChild(lightbox);
    const target = lightbox.querySelector('img');
    const closeButton = lightbox.querySelector('button');
    const close = () => lightbox.classList.remove('open');
    galleryImages.forEach((image) => {
      image.style.cursor = 'zoom-in';
      image.addEventListener('click', () => {
        target.src = image.src;
        target.alt = image.alt || '';
        lightbox.classList.add('open');
        closeButton.focus();
      });
    });
    closeButton.addEventListener('click', close);
    lightbox.addEventListener('click', (event) => {
      if (event.target === lightbox) close();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });
  }

  document.querySelectorAll('[data-contact-form]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const mode = form.dataset.mode || '';
      const status = form.querySelector('[data-form-status]');
      const submit = form.querySelector('button[type="submit"]');
      const data = new FormData(form);
      const honeypot = String(data.get('website') || '').trim();
      if (honeypot) return;

      const payload = {
        name: String(data.get('name') || '').trim(),
        contact: String(data.get('contact') || '').trim(),
        message: String(data.get('message') || '').trim(),
        service: String(data.get('service') || '').trim(),
        preferred_channel: String(data.get('preferred_channel') || '').trim(),
        company: form.dataset.company || '',
        page: window.location.href,
      };
      if (!payload.name || !payload.contact || !payload.message) {
        if (status) status.textContent = 'Заполните имя, контакт и сообщение.';
        return;
      }

      const setBusy = (busy) => {
        if (submit) {
          submit.disabled = busy;
          submit.setAttribute('aria-busy', String(busy));
        }
      };

      if (mode === 'webhook') {
        const endpoint = form.dataset.formEndpoint || '';
        if (!endpoint.startsWith('https://')) {
          if (status) status.textContent = 'Форма временно недоступна. Используйте телефон или мессенджер.';
          return;
        }
        setBusy(true);
        if (status) status.textContent = 'Отправляем…';
        try {
          const headers = {'Content-Type': 'application/json'};
          if (form.dataset.formKey) headers['X-Lead-Relay-Key'] = form.dataset.formKey;
          const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          form.reset();
          if (status) status.textContent = 'Заявка отправлена. Спасибо!';
        } catch (_) {
          if (status) status.textContent = 'Не удалось отправить заявку. Позвоните или напишите компании напрямую.';
        } finally {
          setBusy(false);
        }
        return;
      }

      const text = `Здравствуйте! Меня зовут ${payload.name}.${payload.service ? ` Интересует: ${payload.service}.` : ''} ${payload.message}${payload.preferred_channel ? ` Удобнее ответить: ${payload.preferred_channel}.` : ''} Связаться со мной: ${payload.contact}.`;
      let deliveryMode = mode;
      if (mode !== 'webhook' && payload.preferred_channel) {
        const preferred = payload.preferred_channel.toLowerCase();
        if (preferred.includes('whatsapp') && form.dataset.wa) deliveryMode = 'whatsapp';
        else if (preferred.includes('telegram') && form.dataset.tg) deliveryMode = 'telegram';
        else if (preferred.includes('email') && form.dataset.mailto) deliveryMode = 'email';
        else if (preferred.includes('звон') && form.dataset.tel) deliveryMode = 'phone';
      }
      if (deliveryMode === 'whatsapp') {
        const base = form.dataset.wa || '';
        if (!base) return;
        const separator = base.includes('?') ? '&' : '?';
        window.open(`${base}${separator}text=${encodeURIComponent(text)}`, '_blank', 'noopener');
        if (status) status.textContent = 'Сообщение подготовлено в WhatsApp.';
        return;
      }
      if (deliveryMode === 'telegram') {
        const tg = form.dataset.tg || '';
        if (!tg) return;
        try {
          if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
        } catch (_) {}
        window.open(tg, '_blank', 'noopener');
        if (status) status.textContent = 'Telegram открыт. Текст обращения подготовлен; вставьте его в чат.';
        return;
      }
      if (deliveryMode === 'phone') {
        const tel = form.dataset.tel || '';
        try {
          if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
        } catch (_) {}
        if (tel) window.location.href = tel;
        if (status) status.textContent = 'Открываем звонок. Текст обращения подготовлен.';
        return;
      }
      if (deliveryMode === 'copy') {
        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
          } else {
            const area = document.createElement('textarea');
            area.value = text; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.opacity = '0';
            document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove();
          }
          if (status) status.textContent = 'Текст обращения скопирован. Теперь можно позвонить компании.';
        } catch (_) {
          if (status) status.textContent = text;
        }
        return;
      }
      if (deliveryMode === 'email') {
        const mailto = form.dataset.mailto || '';
        if (!mailto) return;
        const subject = encodeURIComponent(`Заявка с сайта — ${payload.company || 'компания'}`);
        window.location.href = `${mailto}?subject=${subject}&body=${encodeURIComponent(text)}`;
        if (status) status.textContent = 'Письмо подготовлено в почтовом приложении.';
      }
    });
  });
})();

// Commercial V12: niche-aware request builder. It never invents prices or guarantees;
// it only turns the visitor's selected scenario into a ready contact message.
document.querySelectorAll('.intent-picker').forEach((picker) => {
  const options = [...picker.querySelectorAll('[data-intent-option]')];
  const summary = picker.querySelector('[data-intent-summary]');
  const contact = picker.querySelector('[data-intent-contact]');
  const copy = picker.querySelector('[data-copy-request]');
  const toast = picker.querySelector('[data-intent-toast]');
  const company = picker.dataset.company || '';
  let currentText = `Здравствуйте! Хочу уточнить услуги ${company ? `у ${company}` : ''}.`.replace(/\s+/g, ' ').trim();

  const setIntent = (button) => {
    options.forEach((item) => item.classList.toggle('active', item === button));
    const intent = String(button.dataset.intent || '').trim();
    const detail = String(button.dataset.detail || '').trim();
    currentText = `Здравствуйте! ${intent ? `Интересует: ${intent}.` : ''} ${detail ? `Подскажите, пожалуйста, как лучше начать.` : ''}`.replace(/\s+/g, ' ').trim();
    if (summary) summary.textContent = currentText;
    if (contact) {
      const base = contact.getAttribute('href') || '';
      const clean = base.split('?')[0];
      contact.setAttribute('href', `${clean}?text=${encodeURIComponent(currentText)}`);
    }
  };

  options.forEach((button) => button.addEventListener('click', () => setIntent(button)));
  if (options[0]) setIntent(options[0]);

  if (copy) {
    copy.addEventListener('click', async () => {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(currentText);
        } else {
          const area = document.createElement('textarea');
          area.value = currentText;
          area.setAttribute('readonly', '');
          area.style.position = 'fixed';
          area.style.opacity = '0';
          document.body.appendChild(area);
          area.select();
          document.execCommand('copy');
          area.remove();
        }
        if (toast) {
          toast.hidden = false;
          window.setTimeout(() => { toast.hidden = true; }, 1400);
        }
      } catch (_) {
        if (summary) summary.textContent = `${currentText} — скопируйте этот текст вручную.`;
      }
    });
  }
});
