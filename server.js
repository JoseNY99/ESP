const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const mysql = require('mysql2/promise');
const session = require('express-session');
const routes = require('./routes');
const temporizadorreportHandler = require('./api/temporizador-report');
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
app.use(session({
  secret: 'tu_secreto_aqui',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Cambia a true si usas HTTPS
}));
app.use('/api', routes);
app.use('/', routes);
app.use('/api', temporizadorreportHandler);
app.get('/api/user-interfaces', userInterfacesHandler);

// Routes
app.get('/api/user', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      'SELECT email, nombre, apellido, nombre_usuario FROM usuario WHERE id = ?',
      [req.session.userId]
    );
    await connection.end();

    if (rows.length > 0) {
      res.status(200).json(rows[0]);
    } else {
      res.status(404).json({ error: 'Usuario no encontrado' });
    }
  } catch (err) {
    console.error('Error al obtener los datos del usuario:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.post('/api/sensor-data', async (req, res) => {
  const { sensor_type, value } = req.body;

  if (!sensor_type || value === undefined) {
    return res.status(400).json({ error: 'Sensor type and value are required' });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);
    
    const [result] = await connection.execute(
      'INSERT INTO sensor_data (sensor_type, value) VALUES (?, ?)',
      [sensor_type, value]
    );

    await connection.end();

    res.status(201).json({ message: 'Sensor data stored successfully', id: result.insertId });
  } catch (err) {
    console.error('Error storing sensor data:', err);
    res.status(500).json({ error: 'Error storing sensor data' });
  }
});

app.get('/api/check-auth', (req, res) => {
  if (req.session.userId) {
    // User is authenticated
    res.json({ authenticated: true, userId: req.session.userId });
  } else {
    // User is not authenticated
    res.status(401).json({ authenticated: false });
  }
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
      req.session.userId = results[0].id; // Set the user ID in the session
      res.json({ success: true, userId: results[0].id });
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
  if (!req.session.userId) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      'SELECT id, nombre FROM interfaces WHERE id_usuario = ?',
      [req.session.userId]
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
  if (!req.session.userId) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const { id } = req.params;

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      'SELECT * FROM interfaces WHERE id = ? AND id_usuario = ?',
      [id, req.session.userId]
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
// Ruta para obtener los datos del usuario para la página de ajustes
app.get('/api/user-settings', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      'SELECT nombre_usuario, email, nombre, apellido FROM usuario WHERE id = ?',
      [req.session.userId]
    );
    await connection.end();

    if (rows.length > 0) {
      res.status(200).json(rows[0]);
    } else {
      res.status(404).json({ error: 'Usuario no encontrado' });
    }
  } catch (err) {
    console.error('Error al obtener los ajustes del usuario:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});
// Ruta para cambiar la contraseña
app.post('/api/change-password', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const { newPassword } = req.body;

  try {
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute(
      'UPDATE usuario SET contrasena = ? WHERE id = ?',
      [newPassword, req.session.userId]
    );
    await connection.end();

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error al actualizar la contraseña:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Ruta para cerrar sesión
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'No se pudo cerrar sesión' });
    }
    res.status(200).json({ success: true });
  });
});

// New route: Add Timer
app.post('/api/add-timer', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const { led, fecha, hora, accion } = req.body;

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute(
      'INSERT INTO temporizador (led, fecha, hora, accion, estado, id_usuario) VALUES (?, ?, ?, ?, TRUE, ?)',
      [led, fecha, hora, accion, req.session.userId]
    );
    await connection.end();

    res.status(200).json({ id: result.insertId, led, fecha, hora, accion, estado: true });
  } catch (err) {
    console.error('Error al insertar el temporizador:', err);
    res.status(500).json({ error: 'Error al insertar el temporizador' });
  }
});

// New route: Get Timers
app.get('/api/get-timers', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      'SELECT * FROM temporizador WHERE id_usuario = ? AND fecha >= CURDATE() ORDER BY fecha, hora',
      [req.session.userId]
    );
    await connection.end();

    res.status(200).json(rows);
  } catch (err) {
    console.error('Error al obtener los temporizadores:', err);
    res.status(500).json({ error: 'Error al obtener los temporizadores' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Servidor ejecutándose en http://localhost:${port}`);
});