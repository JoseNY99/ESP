const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const mysql = require('mysql2/promise');
const session = require('express-session');
const routes = require('./routes');
const temporizadorreportHandler = require('./api/temporizador-report');
const userInterfacesHandler = require('./api/user-interfaces/[id]');
const SibApiV3Sdk = require('sib-api-v3-sdk');
const crypto = require('crypto');
const brevo = require("@getbrevo/brevo");
require('dotenv').config(); // Carga variables de entorno


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

// Configure Brevo API
const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(
  brevo.TransactionalEmailsApiApiKeys.apiKey,
  
);
// In-memory storage for verification codes (replace with database in production)
const verificationCodes = {};
const pendingUsers = {};
const resetCodes = {};
const verificationCodes2 = new Map();

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
    res.json({ authenticated: true, userId: req.session.userId });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

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
      req.session.userId = results[0].id;
      res.json({ success: true, userId: results[0].id });
    } else {
      res.json({ success: false, message: 'Usuario o contraseña incorrectos' });
    }
  } catch (err) {
    console.error('Error al consultar la base de datos:', err);
    res.status(500).json({ success: false, message: 'Error en el servidor' });
  }
});

app.post('/api/lights', async (req, res) => {
  const { nombre, lucesid, tipo, id_usuario } = req.body;

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute(
      'INSERT INTO interfaces (nombre, lucesid, tipo, id_usuario) VALUES (?, ?, ?, ?)',
      [nombre, lucesid, tipo, id_usuario]
    );
    await connection.end();

    res.status(201).json({ id: result.insertId, nombre, lucesid, tipo, id_usuario });
  } catch (err) {
    console.error('Error al insertar en la base de datos:', err);
    res.status(500).json({ error: 'Error al insertar en la base de datos' });
  }
});

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

app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'No se pudo cerrar sesión' });
    }
    res.status(200).json({ success: true });
  });
});

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

    res.status(201).json({ id: result.insertId, led, fecha, hora, accion, estado: true });
  } catch (err) {
    console.error('Error al insertar el temporizador:', err);
    res.status(500).json({ error: 'Error al insertar el temporizador' });
  }
});

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

app.post('/api/forgot-password-username', async (req, res) => {
  const { username } = req.body;

  try {
    const connection = await mysql.createConnection(dbConfig);
    
    // Look up the email associated with the username
    const [rows] = await connection.execute(
      'SELECT email, nombre FROM usuario WHERE nombre_usuario = ?',
      [username]
    );
    
    await connection.end();

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const email = rows[0].email;
    const nombre = rows[0].nombre;

    // Generate a verification code
    const resetCode = crypto.randomBytes(3).toString('hex').toUpperCase();
    
    // Store the verification code with an expiration time (5 minutes)
    resetCodes[email] = {
      code: resetCode,
      expires: Date.now() + 300000 // 5 minutos de expiración
    };

    // Send the verification code email
    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.subject = "Restablecimiento de contraseña";
    sendSmtpEmail.to = [{ email: email, name: nombre }];
    sendSmtpEmail.htmlContent = `<html><body><h1>Hola ${nombre}</h1><p>Recibimos una solicitud para restablecer tu contraseña en <strong>domoticadelailuminacion</strong>. Si fuiste tú quien hizo esta solicitud, este es tu código de verificación: <strong>${resetCode}</strong>. Si no solicitaste este cambio, puedes ignorar este mensaje. Tu contraseña seguirá siendo la misma y nadie podrá modificarla sin este enlace. Este código expirará en 5 minutos. Si necesitas ayuda adicional, no dudes en contactarnos.</p><p>Gracias,<br>El equipo de <strong>domoticadelailuminacion</strong></p></body></html>`;
    sendSmtpEmail.sender = {
      name: "Domotica de la iluminacion",
      email: "domoticadelailuminacion@gmail.com",
    };

    await apiInstance.sendTransacEmail(sendSmtpEmail);

    res.json({ success: true, message: 'Se ha enviado un código de verificación a tu correo electrónico.' });
  } catch (error) {
    console.error('Error en el proceso de recuperación de contraseña:', error);
    res.status(500).json({ success: false, message: 'Error en el proceso de recuperación de contraseña' });
  }
});

app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      'SELECT * FROM usuario WHERE email = ?',
      [email]
    );
    await connection.end();

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const resetCode = crypto.randomBytes(3).toString('hex').toUpperCase();
    resetCodes[email] = {
      code: resetCode,
      expires: Date.now() + 300000 // 5 minutos de expiración
    };

    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.subject = "Restablecimiento de contraseña";
    sendSmtpEmail.to = [{ email: email, name: rows[0].nombre }];
    sendSmtpEmail.htmlContent = `<html><body><h1>Hola ${rows[0].nombre}</h1><p>Recibimos una solicitud para restablecer tu contraseña en <strong>domoticadelailuminacion</strong>. Si fuiste tú quien hizo esta solicitud, este es tu código de verificación: <strong>${resetCode}</strong>. Si no solicitaste este cambio, puedes ignorar este mensaje. Tu contraseña seguirá siendo la misma y nadie podrá modificarla sin este enlace. Este código expirará en 5 minutos. Si necesitas ayuda adicional, no dudes en contactarnos.</p><p>Gracias,<br>El equipo de <strong>domoticadelailuminacion</strong></p></body></html>`;
    sendSmtpEmail.sender = {
      name: "Domotica de la iluminacion",
      email: "domoticadelailuminacion@gmail.com",
    };

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    res.json({ success: true, message: 'Código de restablecimiento enviado' });
  } catch (error) {
    console.error('Error en el proceso de recuperación de contraseña:', error);
    res.status(500).json({ success: false, message: 'Error en el proceso de recuperación de contraseña' });
  }
});

app.post('/api/reset-password', async (req, res) => {
  const { email, username, code, newPassword } = req.body;

  let userEmail = email;

  // If username is provided instead of email, fetch the email
  if (!email && username) {
    try {
      const connection = await mysql.createConnection(dbConfig);
      const [rows] = await connection.execute(
        'SELECT email FROM usuario WHERE nombre_usuario = ?',
        [username]
      );
      await connection.end();

      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      }

      userEmail = rows[0].email;
    } catch (error) {
      console.error('Error al buscar el email del usuario:', error);
      return res.status(500).json({ success: false, message: 'Error al procesar la solicitud' });
    }
  }

  if (!resetCodes[userEmail] || resetCodes[userEmail].code !== code) {
    return res.status(400).json({ success: false, message: 'Código de restablecimiento inválido' });
  }

  if (Date.now() > resetCodes[userEmail].expires) {
    delete resetCodes[userEmail];
    return res.status(400).json({ success: false, message: 'El código de restablecimiento ha expirado' });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute(
      'UPDATE usuario SET contrasena = ? WHERE email = ?',
      [newPassword, userEmail]
    );
    await connection.end();

    delete resetCodes[userEmail];
    res.json({ success: true, message: 'Contraseña restablecida con éxito' });
  } catch (error) {
    console.error('Error al restablecer la contraseña:', error);
    res.status(500).json({ success: false, message: 'Error al restablecer la contraseña' });
  }
});
app.get('/api/check-availability', async (req, res) => {
  const { field, value } = req.query;

  if (!field || !value) {
    return res.status(400).json({ error: 'Field and value are required' });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      `SELECT COUNT(*) as count FROM usuario WHERE ${field} = ?`,
      [value]
    );
    await connection.end();

    const isAvailable = rows[0].count === 0;
    res.json({ available: isAvailable });
  } catch (err) {
    console.error(`Error checking ${field} availability:`, err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});
app.post('/api/register', async (req, res) => {
  const { email, nombre, apellido, cedula, username, password } = req.body;

  if (!email || !nombre || !apellido || !cedula || !username || !password) {
    return res.status(400).json({ success: false, message: 'Faltan datos requeridos' });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);
    
    // Check if email or username already exists
    const [existingUsers] = await connection.execute(
      'SELECT email, nombre_usuario FROM usuario WHERE email = ? OR nombre_usuario = ?',
      [email, username]
    );

    if (existingUsers.length > 0) {
      await connection.end();
      const field = existingUsers[0].email === email ? 'email' : 'nombre de usuario';
      return res.status(400).json({ success: false, message: `El ${field} ya está registrado` });
    }

    // If email and username are available, proceed with registration
    const verificationCode = crypto.randomBytes(3).toString('hex').toUpperCase();

    verificationCodes[email] = {
      code: verificationCode,
      expires: Date.now() + 30000 // 30 seconds expiration
    };

    pendingUsers[email] = { nombre, apellido, cedula, username, password };

    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.subject = "Verificación de correo electrónico";
    sendSmtpEmail.to = [{ email: email, name: `${nombre} ${apellido}` }];
    sendSmtpEmail.htmlContent = `<html><body><h1>Hola ${nombre}</h1><p>Gracias por registrarte en <strong>domoticadelailuminacion</strong>. Para completar tu registro y activar tu cuenta, necesitamos verificar tu correo electrónico.</p><p>Su código de verificación es: <strong>${verificationCode}</strong>. Este código expirará en 2 minutos.</p><p><strong>¿Por qué es necesaria esta verificación?</strong><br>La verificación asegura que tu cuenta sea segura y que tengas acceso completo a todas las funcionalidades de nuestra plataforma.</p><p>Si no realizaste este registro, puedes ignorar este mensaje.</p><p>Gracias,<br>El equipo de <strong>domoticadelailuminacion</strong></p></body></html>`;
     sendSmtpEmail.sender = {
      name: "Domotica de la iluminacion",
      email: "domoticadelailuminacion@gmail.com",
    };

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    await connection.end();
    
    res.json({ success: true, message: 'Código de verificación enviado' });
  } catch (error) {
    console.error('Error in registration process:', error);
    res.status(500).json({ success: false, message: 'Error en el proceso de registro' });
  }
});

app.post('/api/verify', async (req, res) => {
  const { email, code } = req.body;

  if (!verificationCodes[email] || verificationCodes[email].code !== code) {
    return res.status(400).json({ success: false, message: 'Código de verificación inválido' });
  }

  if (Date.now() > verificationCodes[email].expires) {
    delete verificationCodes[email];
    delete pendingUsers[email];
    return res.status(400).json({ success: false, message: 'El código de verificación ha expirado' });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute(
      'INSERT INTO usuario (nombre, apellido, cedula, nombre_usuario, email, contrasena) VALUES (?, ?, ?, ?, ?, ?)',
      [pendingUsers[email].nombre, pendingUsers[email].apellido, pendingUsers[email].cedula, pendingUsers[email].username, email, pendingUsers[email].password]
    );
    await connection.end();

    delete verificationCodes[email];
    delete pendingUsers[email];

    res.json({ success: true, message: 'Usuario registrado exitosamente' });
  } catch (error) {
    console.error('Error inserting user into database:', error);
    res.status(500).json({ success: false, message: 'Error al registrar el usuario' });
  }
});

app.listen(port, () => {
  console.log(`Servidor ejecutándose en http://localhost:${port}`);
});

console.log('Server code updated successfully.');

