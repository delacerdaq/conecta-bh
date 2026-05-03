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
const addressInput = document.getElementById('address');
const suggestionsEl = document.getElementById('address-suggestions');
const addressValidationEl = document.getElementById('address-validation-msg');
const API_BASE = window.location.origin.includes('localhost:3000') ? '' : 'http://localhost:3000';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
let sugestoesEndereco = [];
let enderecoSelecionado = null;
let debounceBusca = null;
let requestController = null;

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

function limparEstadoEndereco() {
  enderecoSelecionado = null;
  setMensagemEndereco('', '');
}

function setMensagemEndereco(msg, tipo) {
  addressValidationEl.textContent = msg;
  addressValidationEl.className = `address-validation-msg${tipo ? ` ${tipo}` : ''}`;
}

function esconderSugestoes() {
  suggestionsEl.style.display = 'none';
  suggestionsEl.innerHTML = '';
}

function renderSugestoes(lista) {
  sugestoesEndereco = lista;

  if (!lista.length) {
    suggestionsEl.innerHTML = '';
    suggestionsEl.style.display = 'none';
    return;
  }

  suggestionsEl.innerHTML = lista
    .map((item, index) => `
      <button
        type="button"
        class="address-suggestion-item"
        data-index="${index}"
        role="option"
      >${item.display_name}</button>`)
    .join('');

  suggestionsEl.style.display = 'block';
}

function enderecoPareceCompleto(endereco) {
  const texto = endereco.trim();
  const possuiNumero = /\d+/.test(texto);
  return texto.length >= 12 && possuiNumero;
}

function montarConsultaEndereco(texto) {
  return `${texto}, Belo Horizonte, Minas Gerais, Brasil`;
}

async function buscarSugestoesEndereco(texto) {
  if (requestController) {
    requestController.abort();
  }

  requestController = new AbortController();

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('q', montarConsultaEndereco(texto));
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '5');
  url.searchParams.set('countrycodes', 'br');

  const res = await fetch(url.toString(), {
    signal: requestController.signal,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error('Falha ao buscar sugestões');
  }

  const data = await res.json();
  return data.filter((item) => (item.display_name || '').toLowerCase().includes('belo horizonte'));
}

function selecionarEndereco(item) {
  enderecoSelecionado = item;
  addressInput.value = item.display_name;
  setMensagemEndereco('Endereço validado com sucesso.', 'sucesso');
  esconderSugestoes();
}

async function validarEnderecoDigitado() {
  const endereco = addressInput.value.trim();

  if (!endereco) {
    setMensagemEndereco('Informe o endereço completo da loja.', 'erro');
    return false;
  }

  if (!enderecoPareceCompleto(endereco)) {
    setMensagemEndereco('Inclua rua, número e demais informações do endereço.', 'erro');
    return false;
  }

  if (enderecoSelecionado && enderecoSelecionado.display_name === endereco) {
    setMensagemEndereco('Endereço validado com sucesso.', 'sucesso');
    return true;
  }

  try {
    const sugestoes = await buscarSugestoesEndereco(endereco);
    if (!sugestoes.length) {
      setMensagemEndereco('Não encontramos esse endereço em Belo Horizonte. Tente selecionar uma sugestão.', 'erro');
      return false;
    }

    selecionarEndereco(sugestoes[0]);
    return true;
  } catch (err) {
    setMensagemEndereco('Não foi possível validar o endereço agora. Tente novamente.', 'erro');
    return false;
  }
}

addressInput.addEventListener('input', () => {
  limparEstadoEndereco();

  const termo = addressInput.value.trim();
  if (termo.length < 5) {
    esconderSugestoes();
    return;
  }

  if (debounceBusca) {
    clearTimeout(debounceBusca);
  }

  debounceBusca = setTimeout(async () => {
    try {
      const sugestoes = await buscarSugestoesEndereco(termo);
      renderSugestoes(sugestoes);
    } catch (err) {
      if (err.name !== 'AbortError') {
        esconderSugestoes();
      }
    }
  }, 350);
});

addressInput.addEventListener('blur', () => {
  setTimeout(() => {
    esconderSugestoes();
    if (addressInput.value.trim()) {
      validarEnderecoDigitado();
    }
  }, 150);
});

suggestionsEl.addEventListener('click', (event) => {
  const botao = event.target.closest('.address-suggestion-item');
  if (!botao) return;

  const idx = Number(botao.dataset.index);
  const item = sugestoesEndereco[idx];
  if (item) {
    selecionarEndereco(item);
  }
});

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

  const enderecoValido = await validarEnderecoDigitado();
  if (!enderecoValido) {
    mostrarFeedback('Corrija o endereço da loja para continuar o cadastro.', 'erro');
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Cadastrar';
    return;
  }

  payload.endereco = addressInput.value.trim();

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
