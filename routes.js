const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const deleteInterfaceHandler = require('./api/user-interfaces/[id]');
const userInterfacesHandler = require('./api/user-interfaces');

const dbConfig = {
  host: 'tccesp.cra46uwu2j45.us-east-2.rds.amazonaws.com',
  user: 'admin',
  password: 'Tcc2024*',
  database: 'TccEsp1'
};

// Initialize Gemini API
const genAI = new GoogleGenerativeAI("AIzaSyCxRDa-O8tYEEs78is4tOGt0G-mD0nPrY4");

// Middleware to check authentication
const checkAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
};

router.get('/user-interfaces', checkAuth, userInterfacesHandler);
router.delete('/user-interfaces/:id', checkAuth, deleteInterfaceHandler);

router.get('/user', checkAuth, async (req, res) => {
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

router.post('/change-password', checkAuth, async (req, res) => {
  const { contrasenha } = req.body;

  if (!contrasenha) {
    return res.status(400).json({ error: 'La nueva contraseña es requerida' });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute(
      'UPDATE usuario SET contrasena = ? WHERE id = ?',
      [contrasenha, req.session.userId]
    );
    await connection.end();

    res.status(200).json({ message: 'Contraseña actualizada exitosamente' });
  } catch (err) {
    console.error('Error al cambiar la contraseña:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

router.post('/api/sensor-data', async (req, res) => {
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

router.get('/api/sensor-data', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT * FROM sensor_data ORDER BY timestamp DESC LIMIT 100');
    await connection.end();
    res.json(rows);
  } catch (error) {
    console.error('Error fetching sensor data:', error);
    res.status(500).json({ error: 'Error fetching sensor data' });
  }
});

router.get('/api/consulta-energia', async (req, res) => {
  const { tipo } = req.query;

  if (!tipo) {
    return res.status(400).json({ error: 'Tipo de consulta no especificado' });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);
    let prompt = '';

    switch (tipo) {
      case 'consumo24h':
        const [consumo24h] = await connection.execute(
          'SELECT SUM(value) as consumo FROM sensor_data WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)'
        );
        prompt = `En las últimas 24 horas se ha consumido aproximadamente ${(consumo24h[0].consumo / 1000).toFixed(2)} kWh. Proporciona un análisis detallado de este consumo y sugerencias para mejorarlo.`;
        break;

      case 'consumoMensual':
        const [consumoMensual] = await connection.execute(
          'SELECT SUM(value) as consumo FROM sensor_data WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 MONTH)'
        );
        prompt = `El consumo mensual de energía es de aproximadamente ${(consumoMensual[0].consumo / 1000).toFixed(2)} kWh. Analiza este consumo y proporciona recomendaciones para reducirlo.`;
        break;

      case 'reducirConsumo':
        prompt = "Proporciona consejos detallados sobre cómo reducir el consumo de energía durante el día y la noche en un hogar.";
        break;

      case 'eficienciaIluminacion':
        prompt = "Explica cómo mejorar la eficiencia energética de la iluminación en un hogar, incluyendo tipos de bombillas y estrategias de uso.";
        break;

      case 'alertaConsumo':
        const [alertaConsumo] = await connection.execute(
          'SELECT AVG(value) as promedio FROM sensor_data WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 HOUR)'
        );
        const promedioHora = alertaConsumo[0].promedio;
        prompt = `El consumo promedio en la última hora es de ${promedioHora.toFixed(2)} mA. Analiza si esto representa un consumo excesivo y proporciona recomendaciones.`;
        break;

      case 'tipsAhorro':
        prompt = "Proporciona tips detallados y específicos para ahorrar energía en un hogar, basados en las últimas tendencias y tecnologías.";
        break;

      case 'lucesConsumo':
        const [lucesConsumo] = await connection.execute(
          'SELECT sensor_type, AVG(value) as promedio FROM sensor_data GROUP BY sensor_type ORDER BY promedio DESC LIMIT 3'
        );
        prompt = "Analiza el consumo de las siguientes luces y proporciona recomendaciones para optimizar su uso: " + 
          lucesConsumo.map(luz => `${luz.sensor_type}: ${luz.promedio.toFixed(2)} mA en promedio`).join(', ');
        break;

      case 'intensidadLED':
        prompt = "Explica cómo varía el consumo de energía cuando se ajusta la intensidad de las luces LED y proporciona recomendaciones para su uso óptimo.";
        break;

      case 'tiempoUsoLED':
        prompt = "Analiza y recomienda el tiempo ideal de uso diario para optimizar el ahorro con luces LED en diferentes áreas de un hogar.";
        break;

      case 'configuracionHorarios':
        prompt = "Proporciona una configuración detallada de horarios para las luces LED en diferentes áreas de un hogar para optimizar el consumo de energía.";
        break;

      default:
        prompt = "Proporciona información general sobre el ahorro de energía en el hogar.";
    }

    await connection.end();

    // Call Gemini API
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const respuesta = response.text();

    res.json({ respuesta });
  } catch (error) {
    console.error('Error en la consulta de energía:', error);
    res.status(500).json({ error: 'Error en el servidor al procesar la consulta' });
  }
});

router.get('/api/energy-consumption', async (req, res) => {
  const { period } = req.query;

  if (!period || !['day', 'week', 'month'].includes(period)) {
    return res.status(400).json({ error: 'Invalid period specified' });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);
    let query;
    let interval;

    switch (period) {
      case 'day':
        interval = 'HOUR';
        query = `
          SELECT DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00') as time_interval, 
                 AVG(value) as average_consumption
          FROM sensor_data
          WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 DAY)
          GROUP BY time_interval
          ORDER BY time_interval
        `;
        break;
      case 'week':
        interval = 'DAY';
        query = `
          SELECT DATE(timestamp) as time_interval, 
                 AVG(value) as average_consumption
          FROM sensor_data
          WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 WEEK)
          GROUP BY time_interval
          ORDER BY time_interval
        `;
        break;
      case 'month':
        interval = 'DAY';
        query = `
          SELECT DATE(timestamp) as time_interval, 
                 AVG(value) as average_consumption
          FROM sensor_data
          WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
          GROUP BY time_interval
          ORDER BY time_interval
        `;
        break;
    }

    const [rows] = await connection.execute(query);
    await connection.end();

    res.json({ data: rows, interval });
  } catch (error) {
    console.error('Error fetching energy consumption data:', error);
    res.status(500).json({ error: 'Error fetching energy consumption data' });
  }
});

module.exports = router;

