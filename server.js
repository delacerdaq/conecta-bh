const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
const USUARIOS_PATH = path.join(__dirname, 'data', 'usuarios.json');
const DB_PATH = path.join(__dirname, 'data', 'empreendedores.json');

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.static(__dirname));

// ─── Segurança ───────────────────────────────────────────────────────────────

// Rate limiter em memória (sem dependências extras)
const _rlMap = new Map();
function criarRateLimiter({ max, windowMs, mensagem }) {
  const bucket = mensagem || 'default';
  return (req, res, next) => {
    const ip = (req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || 'unknown')
      .split(',')[0].trim();
    const chave = `${bucket}:${ip}`;
    const agora = Date.now();
    const entrada = _rlMap.get(chave);
    if (!entrada || agora > entrada.resetTime) {
      _rlMap.set(chave, { count: 1, resetTime: agora + windowMs });
      return next();
    }
    if (entrada.count >= max) {
      return res.status(429).json({ error: mensagem || 'Muitas tentativas. Aguarde e tente novamente.' });
    }
    entrada.count += 1;
    next();
  };
}

// 5 cadastros por IP a cada 15 min; 10 logins por IP a cada 15 min; 10 negócios por IP/hora
const limitarRegistro = criarRateLimiter({ max: 5,  windowMs: 15 * 60 * 1000, mensagem: 'Muitos cadastros seguidos. Aguarde 15 minutos.' });
const limitarLogin    = criarRateLimiter({ max: 10, windowMs: 15 * 60 * 1000, mensagem: 'Muitas tentativas de login. Aguarde 15 minutos.' });
const limitarNegocio  = criarRateLimiter({ max: 10, windowMs: 60 * 60 * 1000, mensagem: 'Limite de cadastros por hora atingido. Aguarde.' });

/** Remove tags HTML e limita o comprimento de campos de texto livre */
function sanitizarTexto(valor, maxLen) {
  if (typeof valor !== 'string') return '';
  return valor.replace(/<[^>]*>/g, '').trim().slice(0, maxLen || 1000);
}

/** Sanitiza cada campo do objeto de redes sociais */
function sanitizarRedesSociais(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const campos = ['instagram', 'facebook', 'whatsapp', 'linkedin', 'website'];
  const resultado = {};
  for (const campo of campos) {
    const val = typeof obj[campo] === 'string'
      ? obj[campo].replace(/<[^>]*>/g, '').trim().slice(0, 200)
      : null;
    resultado[campo] = val || null;
  }
  return resultado;
}

/** Valida formato de e-mail */
function validarEmail(email) {
  return typeof email === 'string'
    && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
    && email.trim().length <= 150;
}

/** Exige pelo menos 8 chars, com letras e números */
function validarForcaSenha(senha) {
  if (typeof senha !== 'string' || senha.length < 8) return false;
  if (!/[a-zA-Z]/.test(senha)) return false;
  if (!/\d/.test(senha)) return false;
  return true;
}

/** Verifica se o valor é um data URI de imagem válido (JPEG, PNG, WEBP ou GIF) */
function validarBase64Imagem(valor) {
  if (!valor) return true;
  if (typeof valor !== 'string') return false;
  return /^data:image\/(jpeg|jpg|png|webp|gif);base64,/.test(valor);
}

/** Retorna true (e responde 400) se o campo honeypot estiver preenchido — bloqueia robôs */
function verificarHoneypot(req, res) {
  const val = req.body?._gotcha;
  if (typeof val === 'string' && val !== '') {
    res.status(400).json({ error: 'Requisição bloqueada.' });
    return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────

function normalizarProdutos(lista) {
  if (!Array.isArray(lista)) return [];

  return lista
    .slice(0, 6)
    .map((produto) => ({
      id: Number.isFinite(Number(produto?.id)) ? Number(produto.id) : Date.now() + Math.floor(Math.random() * 100000),
      nome: typeof produto?.nome === 'string' ? produto.nome.trim() : '',
      descricao: typeof produto?.descricao === 'string' ? produto.descricao.trim() : '',
      preco: typeof produto?.preco === 'string'
        ? produto.preco.trim()
        : (produto?.preco == null ? '' : String(produto.preco)),
      foto: typeof produto?.foto === 'string' ? produto.foto : null,
      dataCadastro: produto?.dataCadastro || new Date().toISOString(),
    }))
    .filter((produto) => produto.nome || produto.descricao || produto.foto || produto.preco);
}

function sanitizarDocumento(valor) {
  return typeof valor === 'string' ? valor.replace(/\D/g, '') : '';
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

function verificarAutenticacao(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Não autenticado. Faça login primeiro.' });
  }
  try {
    const usuarios = JSON.parse(fs.readFileSync(USUARIOS_PATH, 'utf-8')).usuarios || [];
    const usuario = usuarios.find(u => u.token === token);
    if (!usuario) {
      return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }
    req.usuarioId = usuario.id;
    req.usuarioEmail = usuario.email;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Erro na autenticação.' });
  }
}

/**
 * POST /api/auth/register
 * Registra um novo usuário com email e senha criptografada
 * Proteções: rate limit, honeypot, validação de e-mail, força de senha, sanitização do nome
 */
app.post('/api/auth/register', limitarRegistro, async (req, res) => {
  try {
    if (verificarHoneypot(req, res)) return;

    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
    }

    const nomeSanitizado = sanitizarTexto(nome, 100);
    if (nomeSanitizado.length < 2) {
      return res.status(400).json({ error: 'Nome deve ter pelo menos 2 caracteres.' });
    }

    if (!validarEmail(email)) {
      return res.status(400).json({ error: 'Formato de e-mail inválido.' });
    }

    if (!validarForcaSenha(senha)) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 8 caracteres com letras e números.' });
    }

    const emailNormalizado = email.trim().toLowerCase();

    let dados = { usuarios: [] };
    if (fs.existsSync(USUARIOS_PATH)) {
      dados = JSON.parse(fs.readFileSync(USUARIOS_PATH, 'utf-8'));
    }

    if (dados.usuarios.some(u => u.email.toLowerCase() === emailNormalizado)) {
      return res.status(400).json({ error: 'Email já cadastrado.' });
    }

    const senhaCriptografada = await bcrypt.hash(senha, 10);
    const token = Buffer.from(
      `${emailNormalizado}:${Date.now()}:${Math.random().toString(36).slice(2)}`
    ).toString('base64');

    const novoUsuario = {
      id: Date.now(),
      nome: nomeSanitizado,
      email: emailNormalizado,
      senha: senhaCriptografada,
      token,
      dataCadastro: new Date().toISOString(),
    };

    dados.usuarios.push(novoUsuario);
    fs.writeFileSync(USUARIOS_PATH, JSON.stringify(dados, null, 2));

    res.status(201).json({
      success: true,
      message: 'Usuário registrado com sucesso!',
      token,
      usuario: { id: novoUsuario.id, nome: nomeSanitizado, email: emailNormalizado },
    });
  } catch (err) {
    console.error('Erro ao registrar:', err);
    res.status(500).json({ error: 'Erro ao registrar usuário.' });
  }
});

/**
 * POST /api/auth/login
 * Faz login com email e senha, retorna token
 * Proteções: rate limit, busca de e-mail insensível a maiúsculas
 */
app.post('/api/auth/login', limitarLogin, async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

    if (!fs.existsSync(USUARIOS_PATH)) {
      return res.status(401).json({ error: 'Email ou senha incorretos.' });
    }

    const dados = JSON.parse(fs.readFileSync(USUARIOS_PATH, 'utf-8'));
    const emailBusca = email.trim().toLowerCase();
    const usuario = dados.usuarios.find(u => u.email.toLowerCase() === emailBusca);

    if (!usuario) {
      return res.status(401).json({ error: 'Email ou senha incorretos.' });
    }

    // Verificar senha
    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      return res.status(401).json({ error: 'Email ou senha incorretos.' });
    }

    res.json({
      success: true,
      message: 'Login realizado com sucesso!',
      token: usuario.token,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email },
    });
  } catch (err) {
    console.error('Erro ao fazer login:', err);
    res.status(500).json({ error: 'Erro ao fazer login.' });
  }
});

/**
 * GET /api/auth/perfil
 * Retorna dados do usuário autenticado
 */
app.get('/api/auth/perfil', verificarAutenticacao, (req, res) => {
  try {
    const dados = JSON.parse(fs.readFileSync(USUARIOS_PATH, 'utf-8'));
    const usuario = dados.usuarios.find(u => u.id === req.usuarioId);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    res.json({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar perfil.' });
  }
});

/**
 * GET /api/empreendedores
 * Retorna lista de todos os empreendedores
 */
app.get('/api/empreendedores', (req, res) => {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const data = JSON.parse(raw);
    res.json(data);
  } catch (err) {
    console.error('Erro ao ler banco:', err);
    res.status(500).json({ error: 'Erro ao ler os dados.' });
  }
});

/**
 * POST /api/empreendedores
 * Cadastra novo empreendedor (requer autenticação)
 * Proteções: rate limit, honeypot, sanitização de texto, validação de imagens base64
 */
app.post('/api/empreendedores', verificarAutenticacao, limitarNegocio, (req, res) => {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const data = JSON.parse(raw);

    if (verificarHoneypot(req, res)) return;

    // Sanitização e validação de campos de texto livre
    const nomeNegocioSanitizado = sanitizarTexto(req.body.nomeNegocio, 100);
    const descricaoSanitizada   = sanitizarTexto(req.body.descricao, 1500);
    const enderecoSanitizado    = sanitizarTexto(req.body.endereco, 250);
    const telefoneSanitizado    = sanitizarTexto(req.body.telefone, 25);
    const nomeSanitizado        = sanitizarTexto(req.body.nome, 100);

    if (!nomeNegocioSanitizado || !descricaoSanitizada || !enderecoSanitizado) {
      return res.status(400).json({ error: 'Nome do negócio, descrição e endereço são obrigatórios.' });
    }

    // Validação de imagens (deve ser data URI de imagem válida)
    const fotoPerfilNegocio = req.body.fotoPerfil || null;
    if (!validarBase64Imagem(fotoPerfilNegocio)) {
      return res.status(400).json({ error: 'Formato da foto de perfil inválido.' });
    }

    const galeriaFotosNegocio = Array.isArray(req.body.galeriaFotos) ? req.body.galeriaFotos : [];
    if (galeriaFotosNegocio.some((f) => !validarBase64Imagem(f))) {
      return res.status(400).json({ error: 'Uma ou mais fotos da galeria têm formato inválido.' });
    }

    // Sanitização de redes sociais
    const redesSociaisSanitizadas = sanitizarRedesSociais(req.body.redesSociais);

    const documentoTipo = req.body.documentoTipo === 'cnpj' ? 'cnpj' : 'cpf';
    const cpfRecebido = sanitizarDocumento(req.body.cpf);
    const cnpjRecebido = sanitizarDocumento(req.body.cnpj);
    const documentoRecebido = sanitizarDocumento(req.body.documento);

    if (cpfRecebido && !validarCpf(cpfRecebido)) {
      return res.status(400).json({ error: 'CPF inválido.' });
    }
    if (cnpjRecebido && !validarCnpj(cnpjRecebido)) {
      return res.status(400).json({ error: 'CNPJ inválido.' });
    }

    const documento = documentoTipo === 'cnpj'
      ? (cnpjRecebido || documentoRecebido)
      : (cpfRecebido || documentoRecebido);

    if (documento) {
      if (documentoTipo === 'cpf' && !validarCpf(documento)) {
        return res.status(400).json({ error: 'CPF inválido.' });
      }
      if (documentoTipo === 'cnpj' && !validarCnpj(documento)) {
        return res.status(400).json({ error: 'CNPJ inválido.' });
      }
    }

    const cpf = documentoTipo === 'cpf' ? documento : '';
    const cnpj = documentoTipo === 'cnpj' ? documento : '';

    const novo = {
      id: Date.now(),
      usuarioId: req.usuarioId,
      usuarioEmail: req.usuarioEmail,
      nome: nomeSanitizado,
      email: sanitizarTexto(req.body.email, 150),
      telefone: telefoneSanitizado,
      cpf,
      cnpj,
      documentoTipo,
      documento,
      nomeNegocio: nomeNegocioSanitizado,
      tipoNegocio: req.body.tipoNegocio || 'outro',
      descricao: descricaoSanitizada,
      endereco: enderecoSanitizado,
      latitude: Number.isFinite(Number(req.body.latitude)) ? Number(req.body.latitude) : null,
      longitude: Number.isFinite(Number(req.body.longitude)) ? Number(req.body.longitude) : null,
      fotoPerfil: fotoPerfilNegocio,
      galeriaFotos: galeriaFotosNegocio,
      produtos: normalizarProdutos(req.body.produtos),
      redesSociais: redesSociaisSanitizadas,
      dataCadastro: new Date().toISOString(),
    };

    data.empreendedores.push(novo);

    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), { encoding: 'utf-8', flag: 'w' });

    res.status(201).json({ success: true, empreendedor: novo });
  } catch (err) {
    console.error('Erro ao salvar cadastro:', err);
    res.status(500).json({ error: 'Erro ao salvar os dados.' });
  }
});

/**
 * PUT /api/empreendedores/:id
 * Atualiza um empreendedor do próprio usuário autenticado
 * Proteções: sanitização de texto, validação de imagens base64, sanitização de redes sociais
 */
app.put('/api/empreendedores/:id', verificarAutenticacao, (req, res) => {
  try {
    const empreendedorId = Number(req.params.id);
    if (!Number.isFinite(empreendedorId)) {
      return res.status(400).json({ error: 'ID do negócio inválido.' });
    }

    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const data = JSON.parse(raw);
    const index = (data.empreendedores || []).findIndex((emp) => emp.id === empreendedorId);

    if (index === -1) {
      return res.status(404).json({ error: 'Negócio não encontrado.' });
    }

    const atual = data.empreendedores[index];
    if (atual.usuarioId !== req.usuarioId) {
      return res.status(403).json({ error: 'Você não tem permissão para editar este negócio.' });
    }

    // Sanitização de campos de texto livre antes de qualquer uso
    if (req.body.nomeNegocio !== undefined) req.body.nomeNegocio = sanitizarTexto(req.body.nomeNegocio, 100);
    if (req.body.descricao   !== undefined) req.body.descricao   = sanitizarTexto(req.body.descricao, 1500);
    if (req.body.endereco    !== undefined) req.body.endereco    = sanitizarTexto(req.body.endereco, 250);
    if (req.body.telefone    !== undefined) req.body.telefone    = sanitizarTexto(req.body.telefone, 25);
    if (req.body.nome        !== undefined) req.body.nome        = sanitizarTexto(req.body.nome, 100);
    if (req.body.email       !== undefined) req.body.email       = sanitizarTexto(req.body.email, 150);

    // Validação de imagens
    if (req.body.fotoPerfil !== undefined && !validarBase64Imagem(req.body.fotoPerfil)) {
      return res.status(400).json({ error: 'Formato da foto de perfil inválido.' });
    }
    if (Array.isArray(req.body.galeriaFotos) && req.body.galeriaFotos.some((f) => !validarBase64Imagem(f))) {
      return res.status(400).json({ error: 'Uma ou mais fotos da galeria têm formato inválido.' });
    }

    // Sanitização de redes sociais
    if (req.body.redesSociais !== undefined) {
      req.body.redesSociais = sanitizarRedesSociais(req.body.redesSociais);
    }

    const houveAtualizacaoDocumento =
      req.body.cpf !== undefined ||
      req.body.cnpj !== undefined ||
      req.body.documento !== undefined ||
      req.body.documentoTipo !== undefined;

    let documentoAtualizado = {};
    if (houveAtualizacaoDocumento) {
      const documentoTipoFinal = req.body.documentoTipo === undefined
        ? (atual.documentoTipo === 'cnpj' ? 'cnpj' : 'cpf')
        : (req.body.documentoTipo === 'cnpj' ? 'cnpj' : 'cpf');

      const cpfAtual = sanitizarDocumento(atual.cpf);
      const cnpjAtual = sanitizarDocumento(atual.cnpj);
      const documentoAtual = sanitizarDocumento(atual.documento);

      const cpfRecebido = req.body.cpf === undefined ? undefined : sanitizarDocumento(req.body.cpf);
      const cnpjRecebido = req.body.cnpj === undefined ? undefined : sanitizarDocumento(req.body.cnpj);
      const documentoRecebido = req.body.documento === undefined ? undefined : sanitizarDocumento(req.body.documento);

      if (cpfRecebido !== undefined && cpfRecebido && !validarCpf(cpfRecebido)) {
        return res.status(400).json({ error: 'CPF inválido.' });
      }
      if (cnpjRecebido !== undefined && cnpjRecebido && !validarCnpj(cnpjRecebido)) {
        return res.status(400).json({ error: 'CNPJ inválido.' });
      }

      const cpfBase = cpfRecebido === undefined ? cpfAtual : cpfRecebido;
      const cnpjBase = cnpjRecebido === undefined ? cnpjAtual : cnpjRecebido;

      const documentoFinal = documentoRecebido !== undefined
        ? documentoRecebido
        : (documentoTipoFinal === 'cnpj'
          ? (cnpjBase || documentoAtual)
          : (cpfBase || documentoAtual));

      if (documentoFinal) {
        if (documentoTipoFinal === 'cpf' && !validarCpf(documentoFinal)) {
          return res.status(400).json({ error: 'CPF inválido.' });
        }
        if (documentoTipoFinal === 'cnpj' && !validarCnpj(documentoFinal)) {
          return res.status(400).json({ error: 'CNPJ inválido.' });
        }
      }

      documentoAtualizado = {
        documentoTipo: documentoTipoFinal,
        documento: documentoFinal || '',
        cpf: documentoTipoFinal === 'cpf' ? (documentoFinal || '') : '',
        cnpj: documentoTipoFinal === 'cnpj' ? (documentoFinal || '') : '',
      };
    }

    const camposPermitidos = {
      nome: req.body.nome,
      email: req.body.email,
      telefone: req.body.telefone,
      cpf: req.body.cpf,
      cnpj: req.body.cnpj,
      documentoTipo: req.body.documentoTipo,
      documento: req.body.documento,
      nomeNegocio: req.body.nomeNegocio,
      tipoNegocio: req.body.tipoNegocio,
      descricao: req.body.descricao,
      endereco: req.body.endereco,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      fotoPerfil: req.body.fotoPerfil,
      galeriaFotos: req.body.galeriaFotos,
      produtos: req.body.produtos,
      redesSociais: req.body.redesSociais,
      ...documentoAtualizado,
    };

    const atualizado = {
      ...atual,
      ...Object.fromEntries(
        Object.entries(camposPermitidos).filter(([, value]) => value !== undefined)
      ),
      tipoNegocio: req.body.tipoNegocio || atual.tipoNegocio || 'outro',
      latitude: req.body.latitude === undefined
        ? atual.latitude
        : (Number.isFinite(Number(req.body.latitude)) ? Number(req.body.latitude) : null),
      longitude: req.body.longitude === undefined
        ? atual.longitude
        : (Number.isFinite(Number(req.body.longitude)) ? Number(req.body.longitude) : null),
      galeriaFotos: req.body.galeriaFotos === undefined
        ? (Array.isArray(atual.galeriaFotos) ? atual.galeriaFotos : [])
        : (Array.isArray(req.body.galeriaFotos) ? req.body.galeriaFotos : []),
      produtos: req.body.produtos === undefined
        ? (Array.isArray(atual.produtos) ? normalizarProdutos(atual.produtos) : [])
        : normalizarProdutos(req.body.produtos),
      redesSociais: req.body.redesSociais === undefined
        ? (atual.redesSociais && typeof atual.redesSociais === 'object' ? atual.redesSociais : {})
        : (req.body.redesSociais && typeof req.body.redesSociais === 'object' ? req.body.redesSociais : {}),
      atualizadoEm: new Date().toISOString(),
    };

    data.empreendedores[index] = atualizado;
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), { encoding: 'utf-8', flag: 'w' });

    return res.json({ success: true, empreendedor: atualizado });
  } catch (err) {
    console.error('Erro ao atualizar negócio:', err);
    return res.status(500).json({ error: 'Erro ao atualizar o negócio.' });
  }
});

/**
 * DELETE /api/empreendedores/:id
 * Exclui um empreendedor do próprio usuário autenticado
 */
app.delete('/api/empreendedores/:id', verificarAutenticacao, (req, res) => {
  try {
    const empreendedorId = Number(req.params.id);
    if (!Number.isFinite(empreendedorId)) {
      return res.status(400).json({ error: 'ID do negócio inválido.' });
    }

    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const data = JSON.parse(raw);
    const index = (data.empreendedores || []).findIndex((emp) => emp.id === empreendedorId);

    if (index === -1) {
      return res.status(404).json({ error: 'Negócio não encontrado.' });
    }

    const atual = data.empreendedores[index];
    if (atual.usuarioId !== req.usuarioId) {
      return res.status(403).json({ error: 'Você não tem permissão para excluir este negócio.' });
    }

    data.empreendedores.splice(index, 1);
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), { encoding: 'utf-8', flag: 'w' });

    return res.json({ success: true });
  } catch (err) {
    console.error('Erro ao excluir negócio:', err);
    return res.status(500).json({ error: 'Erro ao excluir o negócio.' });
  }
});

app.listen(PORT, () => {
  console.log(`ConectaBH rodando em http://localhost:${PORT}`);
  console.log(`   Banco de dados: ${DB_PATH}`);
  console.log(`   Usuários: ${USUARIOS_PATH}`);
});
