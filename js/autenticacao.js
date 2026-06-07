/**
 * autenticacao.js
 * Gerencia login, registro e autenticação na plataforma ConectaBH
 */

const API_BASE = window.location.origin.includes('localhost:3000') ? '' : 'http://localhost:3000';

// Momento em que a página foi carregada — usado para bloquear submissões instantâneas (robôs)
const _tempoCarregamento = Date.now();

const tabsLogin = document.querySelectorAll('.auth-tab');
const formsAuth = document.querySelectorAll('.auth-form');
const formLogin = document.getElementById('form-login');
const formRegistro = document.getElementById('form-registro');
const feedbackLogin = document.getElementById('feedback-login');
const feedbackRegistro = document.getElementById('feedback-registro');

function mudarAba(abaName) {
  formsAuth.forEach(form => form.classList.remove('active'));
  tabsLogin.forEach(tab => tab.classList.remove('active'));

  document.getElementById(abaName).classList.add('active');
  document.querySelector(`[data-tab="${abaName}"]`).classList.add('active');
}

tabsLogin.forEach(tab => {
  tab.addEventListener('click', () => {
    const abaName = tab.dataset.tab;
    mudarAba(abaName);
  });
});

function mostrarFeedback(elemento, msg, tipo) {
  elemento.textContent = msg;
  elemento.className = 'form-feedback ' + tipo;
  elemento.style.display = 'block';
}

formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;

  if (!email || !senha) {
    mostrarFeedback(feedbackLogin, 'Email e senha são obrigatórios.', 'erro');
    return;
  }

  const btnSubmit = formLogin.querySelector('button[type="submit"]');
  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Entrando...';
  feedbackLogin.style.display = 'none';

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      localStorage.setItem('conectabh_token', data.token);
      localStorage.setItem('conectabh_usuario', JSON.stringify(data.usuario));

      mostrarFeedback(feedbackLogin, `Bem-vindo, ${data.usuario.nome}! Redirecionando...`, 'sucesso');

      setTimeout(() => {
        window.location.href = './cadastro-empreendedor.html';
      }, 1500);
    } else {
      mostrarFeedback(feedbackLogin, data.error || 'Erro ao fazer login.', 'erro');
    }
  } catch (err) {
    mostrarFeedback(feedbackLogin, 'Não foi possível conectar ao servidor.', 'erro');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Entrar';
  }
});

formRegistro.addEventListener('submit', async (e) => {
  e.preventDefault();

  const nome = document.getElementById('registro-nome').value.trim();
  const email = document.getElementById('registro-email').value.trim();
  const senha = document.getElementById('registro-senha').value;
  const senhaConfirmacao = document.getElementById('registro-senha-confirmacao').value;

  if (!nome || !email || !senha || !senhaConfirmacao) {
    mostrarFeedback(feedbackRegistro, 'Todos os campos são obrigatórios.', 'erro');
    return;
  }

  if (senha !== senhaConfirmacao) {
    mostrarFeedback(feedbackRegistro, 'As senhas não conferem.', 'erro');
    return;
  }

  if (senha.length < 8 || !/[a-zA-Z]/.test(senha) || !/\d/.test(senha)) {
    mostrarFeedback(feedbackRegistro, 'A senha deve ter pelo menos 8 caracteres, incluindo letras e números.', 'erro');
    return;
  }

  // Bloqueia robôs: campo honeypot deve estar vazio
  if (document.getElementById('_gotcha_reg')?.value) return;

  // Bloqueia submissão instantânea (robô preenche o formulário em milissegundos)
  if (Date.now() - _tempoCarregamento < 3000) {
    mostrarFeedback(feedbackRegistro, 'Ação muito rápida. Aguarde alguns segundos e tente novamente.', 'erro');
    return;
  }

  const btnSubmit = formRegistro.querySelector('button[type="submit"]');
  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Criando conta...';
  feedbackRegistro.style.display = 'none';

  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome,
        email,
        senha,
        _gotcha: document.getElementById('_gotcha_reg')?.value || '',
      }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      localStorage.setItem('conectabh_token', data.token);
      localStorage.setItem('conectabh_usuario', JSON.stringify(data.usuario));

      mostrarFeedback(feedbackRegistro, `Conta criada com sucesso, ${data.usuario.nome}! Redirecionando...`, 'sucesso');

      setTimeout(() => {
        window.location.href = './cadastro-empreendedor.html';
      }, 1500);
    } else {
      mostrarFeedback(feedbackRegistro, data.error || 'Erro ao criar conta.', 'erro');
    }
  } catch (err) {
    mostrarFeedback(feedbackRegistro, 'Não foi possível conectar ao servidor.', 'erro');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Criar Conta';
  }
});
