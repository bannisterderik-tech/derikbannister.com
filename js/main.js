/* ============================================================
   main.js — Shared interactivity for derikbannister.com
   ============================================================ */

(() => {
  'use strict';

  /* ----------------------------------------------------------
     1. Nav scroll effect
     ---------------------------------------------------------- */
  const nav = document.querySelector('nav');

  const handleNavScroll = () => {
    if (!nav) return;
    if (window.scrollY > 60) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', handleNavScroll, { passive: true });
  handleNavScroll();

  /* ----------------------------------------------------------
     2. Reveal on scroll (IntersectionObserver)
     ---------------------------------------------------------- */
  const revealElements = document.querySelectorAll('.reveal, .reveal-stagger');

  if (revealElements.length) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    revealElements.forEach((el) => revealObserver.observe(el));
  }

  /* ----------------------------------------------------------
     3. FAQ accordion
     ---------------------------------------------------------- */
  const faqQuestions = document.querySelectorAll('.faq-question');

  faqQuestions.forEach((question) => {
    question.addEventListener('click', () => {
      const item = question.closest('.faq-item');
      if (!item) return;

      // Close other open items
      document.querySelectorAll('.faq-item.open').forEach((openItem) => {
        if (openItem !== item) openItem.classList.remove('open');
      });

      item.classList.toggle('open');
    });
  });

  /* ----------------------------------------------------------
     4. Mobile nav toggle
     ---------------------------------------------------------- */
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.querySelector('.nav-links');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      navLinks.classList.toggle('active');
      navToggle.classList.toggle('active');
    });

    // Close mobile menu when a link is clicked
    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('active');
        navToggle.classList.remove('active');
      });
    });
  }

  /* ----------------------------------------------------------
     5. Smooth scroll for anchor links
     ---------------------------------------------------------- */
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;

      const target = document.querySelector(targetId);
      if (!target) return;

      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    });
  });

  /* ----------------------------------------------------------
     Shared: Google Sheets submission helper
     ---------------------------------------------------------- */
  const SHEETS_URL =
    'https://script.google.com/a/macros/theoperativegroup.com/s/AKfycbztIrSRy9L80koIccqvBq1Ou8E7CHfDR1FX6Avn_xz2gdKmKkpDire5CYLt_O1F74OERw/exec';

  const submitToSheets = async (data) => {
    const response = await fetch(SHEETS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(data).toString(),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  };

  /* ----------------------------------------------------------
     6. Email form submission
     ---------------------------------------------------------- */
  const emailForms = document.querySelectorAll('.email-form');

  emailForms.forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const input = form.querySelector('input[type="email"]');
      const button = form.querySelector('button');
      if (!input || !button) return;

      const email = input.value.trim();
      if (!email) return;

      // Loading state
      const originalText = button.innerHTML;
      input.disabled = true;
      button.disabled = true;
      button.innerHTML = '<span class="spinner"></span>';

      try {
        await submitToSheets({
          email,
          source: form.dataset.source || 'email-form',
          referrer: document.referrer,
          userAgent: navigator.userAgent,
        });

        // Success
        button.innerHTML = "You're In &#10003;";
        button.classList.add('success');
        input.value = '';

        setTimeout(() => {
          button.innerHTML = originalText;
          button.classList.remove('success');
          input.disabled = false;
          button.disabled = false;
        }, 4000);
      } catch {
        // Error
        button.innerHTML = 'Try Again';
        button.classList.add('error');

        setTimeout(() => {
          button.innerHTML = originalText;
          button.classList.remove('error');
          input.disabled = false;
          button.disabled = false;
        }, 3000);
      }
    });
  });

  /* ----------------------------------------------------------
     7. Contact form submission
     ---------------------------------------------------------- */
  const contactForm = document.querySelector('.contact-form');

  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const fields = {
        name: contactForm.querySelector('[name="name"]'),
        email: contactForm.querySelector('[name="email"]'),
        phone: contactForm.querySelector('[name="phone"]'),
        message: contactForm.querySelector('[name="message"]'),
      };

      const button = contactForm.querySelector('button[type="submit"]');
      if (!button) return;

      const data = {
        name: fields.name?.value.trim() || '',
        email: fields.email?.value.trim() || '',
        phone: fields.phone?.value.trim() || '',
        message: fields.message?.value.trim() || '',
        source: 'contact-form',
        referrer: document.referrer,
        userAgent: navigator.userAgent,
      };

      if (!data.email) return;

      // Loading state
      const originalText = button.innerHTML;
      const allInputs = contactForm.querySelectorAll('input, textarea, button');
      allInputs.forEach((el) => (el.disabled = true));
      button.innerHTML = '<span class="spinner"></span>';

      try {
        await submitToSheets(data);

        // Success
        button.innerHTML = "You're In &#10003;";
        button.classList.add('success');
        contactForm.reset();

        setTimeout(() => {
          button.innerHTML = originalText;
          button.classList.remove('success');
          allInputs.forEach((el) => (el.disabled = false));
        }, 4000);
      } catch {
        // Error
        button.innerHTML = 'Try Again';
        button.classList.add('error');

        setTimeout(() => {
          button.innerHTML = originalText;
          button.classList.remove('error');
          allInputs.forEach((el) => (el.disabled = false));
        }, 3000);
      }
    });
  }
})();
