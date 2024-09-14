const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const mysql = require('mysql2/promise');
const routes = require('./routes');
const userInterfacesHandler = require('./api/user-interfaces/[id]');

const app = express();
const port = process.env.PORT || 4000;

// Database connection configuration
const dbConfig = {
  host: 'tccesp.cra46uwu2j45.us-east-2.rds.amazonaws.com',
  user: 'admin',
  password: 'Tcc2024*',
  database: 'TccEsp1'
};

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use('/api', routes);
app.get('/api/user-interfaces', userInterfacesHandler);
// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [results] = await connection.execute(
      'SELECT * FROM usuario WHERE nombre_usuario = ? AND contrasena = ?',
      [username, password]
    );
    await connection.end();

    if (results.length > 0) {
      res.json({ success: true });
    } else {
      res.json({ success: false, message: 'Usuario o contraseña incorrectos' });
    }
  } catch (err) {
    console.error('Error al consultar la base de datos:', err);
    res.status(500).json({ success: false, message: 'Error en el servidor' });
  }
});

// Lights API route
app.post('/api/lights', async (req, res) => {
  const { nombre, lucesid, tipo, id_usuario } = req.body;

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute(
      'INSERT INTO interfaces (nombre, lucesid, tipo, id_usuario) VALUES (?, ?, ?, ?)',
      [nombre, lucesid, tipo, id_usuario]
    );
    await connection.end();

    res.status(200).json({ id: result.insertId, nombre, lucesid, tipo, id_usuario });
  } catch (err) {
    console.error('Error al insertar en la base de datos:', err);
    res.status(500).json({ error: 'Error al insertar en la base de datos' });
  }
});

// User Interfaces API route
app.get('/api/user-interfaces', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      'SELECT id, nombre FROM interfaces WHERE id_usuario = ?',
      [1] // Assuming user ID is 1 for now
    );
    await connection.end();

    res.status(200).json(rows);
  } catch (err) {
    console.error('Error al obtener las interfaces del usuario:', err);
    res.status(500).json({ error: 'Error al obtener las interfaces del usuario' });
  }
});

// User Interface Details API route
app.get('/api/user-interfaces/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      'SELECT * FROM interfaces WHERE id = ? AND id_usuario = ?',
      [id, 1] // Assuming user ID is 1 for now
    );
    await connection.end();

    if (rows.length > 0) {
      res.status(200).json(rows[0]);
    } else {
      res.status(404).json({ error: 'Interfaz no encontrada' });
    }
  } catch (err) {
    console.error('Error al obtener los detalles de la interfaz:', err);
    res.status(500).json({ error: 'Error al obtener los detalles de la interfaz' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Servidor ejecutándose en http://localhost:${port}`);
});