/**
 * menu-usuario.js
 * Gerencia o menu de usuário (mostrar/ocultar status de login)
 * Deve ser incluído em todas as páginas que têm header
 */

function atualizarMenuUsuario() {
  const token = localStorage.getItem('conectabh_token');
  const usuarioData = localStorage.getItem('conectabh_usuario');
  
  const userStatus = document.getElementById('user-status');
  const authLink = document.getElementById('auth-link');
  const userName = document.getElementById('user-name');
  const menuToggle = document.getElementById('user-menu-toggle');
  const menuDropdown = document.getElementById('user-menu-dropdown');
  const menuLogout = document.getElementById('menu-logout');

  if (token && usuarioData) {
    try {
      const usuario = JSON.parse(usuarioData);
      
      if (userStatus) userStatus.style.display = 'flex';
      if (authLink) authLink.style.display = 'none';
      if (userName) userName.textContent = usuario.nome;

      if (menuToggle) {
        menuToggle.addEventListener('click', () => {
          menuDropdown.classList.toggle('active');
        });
      }

      document.addEventListener('click', (e) => {
        if (menuDropdown && menuToggle && !menuToggle.contains(e.target) && !menuDropdown.contains(e.target)) {
          menuDropdown.classList.remove('active');
        }
      });

      if (menuLogout) {
        menuLogout.addEventListener('click', (e) => {
          e.preventDefault();
          if (confirm('Tem certeza que deseja sair?')) {
            localStorage.removeItem('conectabh_token');
            localStorage.removeItem('conectabh_usuario');
            const isInsidePages = window.location.pathname.includes('/pages/');
            window.location.href = isInsidePages ? '../index.html' : 'index.html';
          }
        });
      }

    } catch (e) {
      console.error('Erro ao processar dados de usuário:', e);
    }
  } else {
    if (userStatus) userStatus.style.display = 'none';
    if (authLink) authLink.style.display = 'block';
  }
}

function iniciarNavToggle() {
  const navToggle = document.getElementById('nav-toggle');
  const nav = document.querySelector('header nav');
  if (!navToggle || !nav) return;

  navToggle.addEventListener('click', () => {
    const aberto = nav.classList.toggle('active');
    const icon = navToggle.querySelector('i');
    if (icon) {
      icon.className = aberto ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
    }
    navToggle.setAttribute('aria-expanded', aberto ? 'true' : 'false');
  });

  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      nav.classList.remove('active');
      const icon = navToggle.querySelector('i');
      if (icon) icon.className = 'fa-solid fa-bars';
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      nav.classList.remove('active');
      const icon = navToggle.querySelector('i');
      if (icon) icon.className = 'fa-solid fa-bars';
      navToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  atualizarMenuUsuario();
  iniciarNavToggle();
});
