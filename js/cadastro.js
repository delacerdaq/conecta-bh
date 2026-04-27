/**
 * cadastro.js
 * Captura os dados do formulário de cadastro e envia para a API (server.js),
 * que persiste as informações em data/empreendedores.json.
 */

const form = document.getElementById('form-cadastro');
const btnSubmit = document.getElementById('btn-cadastrar');
const feedbackEl = document.getElementById('form-feedback');
const API_BASE = window.location.origin.includes('localhost:3000') ? '' : 'http://localhost:3000';

function mostrarFeedback(msg, tipo) {
  feedbackEl.textContent = msg;
  feedbackEl.className = 'form-feedback ' + tipo;
  feedbackEl.style.display = 'block';
  window.scrollTo({ top: feedbackEl.offsetTop - 100, behavior: 'smooth' });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

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
    payload.telefone,
    payload.cpf,
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      mostrarFeedback(
        `Cadastro de "${payload.nome}" realizado com sucesso! Seu negócio já aparece na plataforma.`,
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
