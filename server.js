const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = 3000;
const USUARIOS_PATH = path.join(__dirname, 'data', 'usuarios.json');
const DB_PATH = path.join(__dirname, 'data', 'empreendedores.json');

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.static(__dirname));

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
 */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
    }

    let dados = { usuarios: [] };
    if (fs.existsSync(USUARIOS_PATH)) {
      dados = JSON.parse(fs.readFileSync(USUARIOS_PATH, 'utf-8'));
    }

    if (dados.usuarios.some(u => u.email === email)) {
      return res.status(400).json({ error: 'Email já cadastrado.' });
    }

    const senhaCriptografada = await bcrypt.hash(senha, 10);
    const token = Buffer.from(`${email}:${Date.now()}`).toString('base64');

    const novoUsuario = {
      id: Date.now(),
      nome,
      email,
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
      usuario: { id: novoUsuario.id, nome, email },
    });
  } catch (err) {
    console.error('Erro ao registrar:', err);
    res.status(500).json({ error: 'Erro ao registrar usuário.' });
  }
});

/**
 * POST /api/auth/login
 * Faz login com email e senha, retorna token
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

    if (!fs.existsSync(USUARIOS_PATH)) {
      return res.status(401).json({ error: 'Email ou senha incorretos.' });
    }

    const dados = JSON.parse(fs.readFileSync(USUARIOS_PATH, 'utf-8'));
    const usuario = dados.usuarios.find(u => u.email === email);

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
 */
app.post('/api/empreendedores', verificarAutenticacao, (req, res) => {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const data = JSON.parse(raw);

    const novo = {
      id: Date.now(),
      usuarioId: req.usuarioId,
      usuarioEmail: req.usuarioEmail,
      nome: req.body.nome || '',
      email: req.body.email || '',
      telefone: req.body.telefone || '',
      cpf: req.body.cpf || '',
      nomeNegocio: req.body.nomeNegocio || '',
      tipoNegocio: req.body.tipoNegocio || 'outro',
      descricao: req.body.descricao || '',
      endereco: req.body.endereco || '',
      latitude: Number.isFinite(Number(req.body.latitude)) ? Number(req.body.latitude) : null,
      longitude: Number.isFinite(Number(req.body.longitude)) ? Number(req.body.longitude) : null,
      fotoPerfil: req.body.fotoPerfil || null,
      galeriaFotos: Array.isArray(req.body.galeriaFotos) ? req.body.galeriaFotos : [],
      produtos: normalizarProdutos(req.body.produtos),
      redesSociais: req.body.redesSociais && typeof req.body.redesSociais === 'object' ? req.body.redesSociais : {},
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

    const camposPermitidos = {
      nome: req.body.nome,
      email: req.body.email,
      telefone: req.body.telefone,
      cpf: req.body.cpf,
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
