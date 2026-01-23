// home.js

document.addEventListener('DOMContentLoaded', () => {
  typingEffect();
  setCurrentYear();
  setupDisabledButton();
});

function typingEffect() {
  const text = 'Olá, seja bem vindo!';
  const typingArea = document.getElementById('typingArea');
  const cursor = document.getElementById('cursor');

  if (!typingArea || !cursor) return;

  let index = 0;
  cursor.style.opacity = '1';

  function typeNextChar() {
    if (index < text.length) {
      typingArea.textContent += text.charAt(index);
      index++;
      const delay = 70 + Math.random() * 20; // efeito natural
      setTimeout(typeNextChar, delay);
    }
  }

  // pequeno delay inicial para suavizar a entrada
  setTimeout(typeNextChar, 300);
}

/**
 * Atualiza o ano automaticamente no footer
 */
function setCurrentYear() {
  const yearSpan = document.getElementById('ano');
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }
}

