const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'data', 'empreendedores.json');

app.use(cors());
app.use(express.json());

app.use(express.static(__dirname));

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

app.post('/api/empreendedores', (req, res) => {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const data = JSON.parse(raw);

    const novo = {
      id: Date.now(),
      nome: req.body.nome || '',
      email: req.body.email || '',
      telefone: req.body.telefone || '',
      cpf: req.body.cpf || '',
      nomeNegocio: req.body.nomeNegocio || '',
      tipoNegocio: req.body.tipoNegocio || 'outro',
      descricao: req.body.descricao || '',
      endereco: req.body.endereco || '',
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

app.listen(PORT, () => {
  console.log(`ConectaBH rodando em http://localhost:${PORT}`);
  console.log(`   Banco de dados: ${DB_PATH}`);
});
