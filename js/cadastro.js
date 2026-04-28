/**
 * cadastro.js
 * Captura os dados do formulário de cadastro e envia para a API (server.js),
 * que persiste as informações em data/empreendedores.json.
 * Requer autenticação - usuário deve estar logado.
 * Pré-preenche dados do usuário logado.
 */

const form = document.getElementById('form-cadastro');
const btnSubmit = document.getElementById('btn-cadastrar');
const feedbackEl = document.getElementById('form-feedback');
const API_BASE = window.location.origin.includes('localhost:3000') ? '' : 'http://localhost:3000';

function verificarAutenticacao() {
  const token = localStorage.getItem('conectabh_token');
  const usuario = localStorage.getItem('conectabh_usuario');

  if (!token || !usuario) {
    feedbackEl.textContent = 'Você precisa fazer login para cadastrar seu negócio.';
    feedbackEl.className = 'form-feedback erro';
    feedbackEl.style.display = 'block';
    form.style.display = 'none';
    btnSubmit.style.display = 'none';

    const divMensagem = document.createElement('div');
    divMensagem.className = 'text-center mt-4';
    divMensagem.innerHTML = `
      <p style="color: var(--gray); margin-bottom: 1.5rem;">Para cadastrar seu negócio e aparecer no catálogo, você precisa estar autenticado.</p>
      <a href="login.html" class="btn btn-primary">Fazer Login</a>
    `;
    form.parentNode.insertBefore(divMensagem, form.nextSibling);

    return false;
  }

  try {
    const usuarioData = JSON.parse(usuario);
    document.getElementById('name').value = usuarioData.nome;
    document.getElementById('email').value = usuarioData.email;
    
    document.getElementById('name').readOnly = true;
    document.getElementById('email').readOnly = true;
    
    document.getElementById('name').style.backgroundColor = 'rgba(202, 104, 255, 0.05)';
    document.getElementById('email').style.backgroundColor = 'rgba(202, 104, 255, 0.05)';
  } catch (e) {
    console.error('Erro ao pré-preencher dados:', e);
  }

  return token;
}

function mostrarFeedback(msg, tipo) {
  feedbackEl.textContent = msg;
  feedbackEl.className = 'form-feedback ' + tipo;
  feedbackEl.style.display = 'block';
  window.scrollTo({ top: feedbackEl.offsetTop - 100, behavior: 'smooth' });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const token = verificarAutenticacao();
  if (!token) {
    return;
  }

  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Enviando...';
  feedbackEl.style.display = 'none';

  const payload = {
    nome: document.getElementById('name').value.trim(),
    email: document.getElementById('email').value.trim(),
    telefone: document.getElementById('phone').value.trim(),
    cpf: document.getElementById('cpf').value.trim(),
    nomeNegocio: document.getElementById('business-name').value.trim(),
    tipoNegocio: document.getElementById('business-type').value,
    descricao: document.getElementById('description').value.trim(),
    endereco: document.getElementById('address').value.trim(),
  };

  const camposObrigatorios = [
    payload.nome,
    payload.email,
    payload.nomeNegocio,
    payload.tipoNegocio,
    payload.descricao,
    payload.endereco,
  ];

  if (camposObrigatorios.some((valor) => !valor)) {
    mostrarFeedback('Preencha todos os campos obrigatórios antes de cadastrar.', 'erro');
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Cadastrar';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/empreendedores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      mostrarFeedback(
        `Cadastro de "${payload.nomeNegocio}" realizado com sucesso! Seu negócio já aparece na plataforma.`,
        'sucesso'
      );
      alert('Cadastro realizado com sucesso!');
      form.reset();
    } else {
      mostrarFeedback((data.error || 'Erro ao realizar o cadastro.'), 'erro');
    }
  } catch (err) {
    mostrarFeedback('Não foi possível conectar ao servidor. Verifique se ele está rodando.', 'erro');
    alert('Erro ao cadastrar. Verifique sua conexão com o servidor.');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Cadastrar';
  }
});

document.addEventListener('DOMContentLoaded', () => {
  verificarAutenticacao();
});
