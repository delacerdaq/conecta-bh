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
const documentTypeEl = document.getElementById('document-type');
const documentNumberLabelEl = document.getElementById('document-number-label');
const documentNumberEl = document.getElementById('document-number');
const phoneInput = document.getElementById('phone');
const addressInput = document.getElementById('address');
const suggestionsEl = document.getElementById('address-suggestions');
const addressValidationEl = document.getElementById('address-validation-msg');
const API_BASE = window.location.origin.includes('localhost:3000') ? '' : 'http://localhost:3000';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
let sugestoesEndereco = [];
let enderecoSelecionado = null;
let debounceBusca = null;
let requestController = null;

let fotoPerfilBase64 = null;
let galeriaBase64 = [];
const MAX_IMAGEM_BYTES = 2 * 1024 * 1024;
const MAX_GALERIA_FOTOS = 5;

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

function extrairDigitosDocumento(valor) {
  return (valor || '').replace(/\D/g, '');
}

function formatarTelefone(valor) {
  const digitos = extrairDigitosDocumento(valor).slice(0, 11);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

function todosDigitosIguais(valor) {
  return /^(\d)\1+$/.test(valor);
}

function validarCpf(cpf) {
  if (!cpf || cpf.length !== 11 || todosDigitosIguais(cpf)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i += 1) {
    soma += Number(cpf[i]) * (10 - i);
  }
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== Number(cpf[9])) return false;

  soma = 0;
  for (let i = 0; i < 10; i += 1) {
    soma += Number(cpf[i]) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;

  return resto === Number(cpf[10]);
}

function validarCnpj(cnpj) {
  if (!cnpj || cnpj.length !== 14 || todosDigitosIguais(cnpj)) return false;

  const pesosPrimeiro = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesosSegundo = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const calcularDigito = (base, pesos) => {
    const soma = base.split('').reduce((acc, digito, index) => acc + Number(digito) * pesos[index], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const base = cnpj.slice(0, 12);
  const digito1 = calcularDigito(base, pesosPrimeiro);
  const digito2 = calcularDigito(base + digito1, pesosSegundo);

  return cnpj === `${base}${digito1}${digito2}`;
}

function formatarCpf(valor) {
  const digitos = extrairDigitosDocumento(valor).slice(0, 11);
  return digitos
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function formatarCnpj(valor) {
  const digitos = extrairDigitosDocumento(valor).slice(0, 14);
  return digitos
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

function atualizarCampoDocumento() {
  const tipo = documentTypeEl.value === 'cnpj' ? 'cnpj' : 'cpf';
  documentNumberLabelEl.textContent = tipo.toUpperCase();
  documentNumberEl.placeholder = tipo === 'cnpj' ? '00.000.000/0000-00' : '000.000.000-00';
  documentNumberEl.value = tipo === 'cnpj'
    ? formatarCnpj(documentNumberEl.value)
    : formatarCpf(documentNumberEl.value);
}

function validarDocumentoSeInformado() {
  const tipo = documentTypeEl.value === 'cnpj' ? 'cnpj' : 'cpf';
  const digitos = extrairDigitosDocumento(documentNumberEl.value);

  if (!digitos) return true;

  if (tipo === 'cpf' && !validarCpf(digitos)) {
    mostrarFeedback('CPF inválido. Verifique os dígitos informados.', 'erro');
    return false;
  }

  if (tipo === 'cnpj' && !validarCnpj(digitos)) {
    mostrarFeedback('CNPJ inválido. Verifique os dígitos informados.', 'erro');
    return false;
  }

  return true;
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
      >${item.label || item.display_name}</button>`)
    .join('');

  suggestionsEl.style.display = 'block';
}

function enderecoPareceCompleto(endereco) {
  const texto = endereco.trim();
  const possuiNumero = /\d+/.test(texto);
  return texto.length >= 12 && possuiNumero;
}

function extrairNumeroDoTexto(texto) {
  const match = texto.match(/(?:,\s*|\s+)(\d+)\s*(?:[,\s]|$)/);
  return match ? match[1] : null;
}

function extrairRuaDoTexto(texto) {
  return texto.replace(/(?:,\s*|\s+)\d+.*$/, '').trim();
}

function injetarNumeroNoDisplayName(displayName, road, numero) {
  if (!road || !numero) return displayName;
  const idx = displayName.indexOf(road);
  if (idx === -1) return displayName;
  const after = displayName.slice(idx + road.length);
  if (/^\s*,\s*\d+/.test(after)) return displayName;
  return displayName.slice(0, idx + road.length) + ', ' + numero + after;
}

async function buscarSugestoesEndereco(texto) {
  if (requestController) {
    requestController.abort();
  }

  requestController = new AbortController();

  const numero = extrairNumeroDoTexto(texto);
  const textoBusca = numero ? extrairRuaDoTexto(texto) : texto;
  const q = textoBusca.toLowerCase().includes('belo horizonte')
    ? textoBusca
    : `${textoBusca}, Belo Horizonte, Minas Gerais, Brasil`;

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '7');
  url.searchParams.set('countrycodes', 'br');

  const res = await fetch(url.toString(), {
    signal: requestController.signal,
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error('Falha ao buscar sugestões');
  }

  const data = await res.json();
  const filtrados = data.filter((item) => {
    const nome = (item.display_name || '').toLowerCase();
    const addr = item.address || {};
    const cidade = (addr.city || addr.town || addr.village || '').toLowerCase();
    return nome.includes('belo horizonte') || cidade.includes('belo horizonte');
  });

  return filtrados.map((item) => {
    const addr = item.address || {};
    const road = addr.road || addr.pedestrian || addr.footway || addr.path || addr.street || '';
    const label = numero
      ? injetarNumeroNoDisplayName(item.display_name, road, numero)
      : item.display_name;
    return { ...item, label, _numeroDigitado: numero || null };
  });
}

function selecionarEndereco(item) {
  enderecoSelecionado = item;
  addressInput.value = item.label || item.display_name;
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

  const labelSelecionado = enderecoSelecionado?.label || enderecoSelecionado?.display_name;
  if (enderecoSelecionado && labelSelecionado === endereco) {
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

function lerArquivoBase64(arquivo) {
  return new Promise((resolve, reject) => {
    if (arquivo.size > MAX_IMAGEM_BYTES) {
      reject(new Error(`A imagem "${arquivo.name}" excede o limite de 2 MB.`));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Erro ao ler arquivo.'));
    reader.readAsDataURL(arquivo);
  });
}

const fotoPerfInput  = document.getElementById('foto-perfil');
const fotoPerfPreview = document.getElementById('foto-perfil-preview');
const btnRemoverFoto  = document.getElementById('btn-remover-foto-perfil');

fotoPerfInput.addEventListener('change', async () => {
  const arquivo = fotoPerfInput.files[0];
  if (!arquivo) return;
  try {
    fotoPerfilBase64 = await lerArquivoBase64(arquivo);
    fotoPerfPreview.innerHTML = `<img src="${fotoPerfilBase64}" alt="Foto de perfil">`;
    btnRemoverFoto.style.display = 'inline-flex';
  } catch (err) {
    alert(err.message);
    fotoPerfInput.value = '';
  }
});

btnRemoverFoto.addEventListener('click', () => {
  fotoPerfilBase64 = null;
  fotoPerfInput.value = '';
  fotoPerfPreview.innerHTML = '<i class="fa-solid fa-user"></i>';
  btnRemoverFoto.style.display = 'none';
});


const galeriaInput   = document.getElementById('galeria-fotos');
const galeriaGrid    = document.getElementById('galeria-preview-grid');

function renderGaleriaPreview() {
  galeriaGrid.innerHTML = galeriaBase64.map((src, idx) => `
    <div class="galeria-thumb">
      <img src="${src}" alt="Foto ${idx + 1}">
      <button type="button" class="galeria-thumb-remove" data-idx="${idx}" aria-label="Remover foto">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>`).join('');
}

galeriaGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('.galeria-thumb-remove');
  if (!btn) return;
  const idx = Number(btn.dataset.idx);
  galeriaBase64.splice(idx, 1);
  renderGaleriaPreview();
});

galeriaInput.addEventListener('change', async () => {
  const arquivos = Array.from(galeriaInput.files);
  const vagas = MAX_GALERIA_FOTOS - galeriaBase64.length;

  if (vagas <= 0) {
    alert(`Você já adicionou o máximo de ${MAX_GALERIA_FOTOS} fotos.`);
    galeriaInput.value = '';
    return;
  }

  const selecionados = arquivos.slice(0, vagas);
  if (arquivos.length > vagas) {
    alert(`Limite de ${MAX_GALERIA_FOTOS} fotos. Apenas as primeiras ${vagas} foram adicionadas.`);
  }

  const erros = [];
  for (const arq of selecionados) {
    try {
      const b64 = await lerArquivoBase64(arq);
      galeriaBase64.push(b64);
    } catch (err) {
      erros.push(err.message);
    }
  }

  if (erros.length) alert(erros.join('\n'));
  renderGaleriaPreview();
  galeriaInput.value = '';
});

documentTypeEl.addEventListener('change', atualizarCampoDocumento);

phoneInput.addEventListener('input', () => {
  phoneInput.value = formatarTelefone(phoneInput.value);
});

documentNumberEl.addEventListener('input', () => {
  if (documentTypeEl.value === 'cnpj') {
    documentNumberEl.value = formatarCnpj(documentNumberEl.value);
    return;
  }

  documentNumberEl.value = formatarCpf(documentNumberEl.value);
});

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

  if (!validarDocumentoSeInformado()) {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Cadastrar';
    return;
  }

  const tipoDocumento = documentTypeEl.value === 'cnpj' ? 'cnpj' : 'cpf';
  const numeroDocumento = extrairDigitosDocumento(documentNumberEl.value);

  const payload = {
    nome: document.getElementById('name').value.trim(),
    email: document.getElementById('email').value.trim(),
    telefone: document.getElementById('phone').value.trim(),
    cpf: tipoDocumento === 'cpf' ? numeroDocumento : '',
    cnpj: tipoDocumento === 'cnpj' ? numeroDocumento : '',
    documentoTipo: tipoDocumento,
    documento: numeroDocumento || '',
    nomeNegocio: document.getElementById('business-name').value.trim(),
    tipoNegocio: document.getElementById('business-type').value,
    descricao: document.getElementById('description').value.trim(),
    endereco: document.getElementById('address').value.trim(),
    latitude: enderecoSelecionado ? Number(enderecoSelecionado.lat) : null,
    longitude: enderecoSelecionado ? Number(enderecoSelecionado.lon) : null,
    fotoPerfil: fotoPerfilBase64,
    galeriaFotos: galeriaBase64.length ? galeriaBase64 : [],
    redesSociais: {
      instagram: document.getElementById('social-instagram').value.trim() || null,
      facebook:  document.getElementById('social-facebook').value.trim()  || null,
      whatsapp:  document.getElementById('social-whatsapp').value.trim()  || null,
      linkedin:  document.getElementById('social-linkedin').value.trim()  || null,
      website:   document.getElementById('social-website').value.trim()   || null,
    },
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
  payload.latitude = enderecoSelecionado ? Number(enderecoSelecionado.lat) : null;
  payload.longitude = enderecoSelecionado ? Number(enderecoSelecionado.lon) : null;

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
      fotoPerfilBase64 = null;
      galeriaBase64 = [];
      atualizarCampoDocumento();
      fotoPerfPreview.innerHTML = '<i class="fa-solid fa-user"></i>';
      btnRemoverFoto.style.display = 'none';
      renderGaleriaPreview();
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
  atualizarCampoDocumento();
});
