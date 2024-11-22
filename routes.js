const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();
const deleteInterfaceHandler = require('./api/user-interfaces/[id]');
const userInterfacesHandler = require('./api/user-interfaces');

const dbConfig = {
  host: 'tccesp.cra46uwu2j45.us-east-2.rds.amazonaws.com',
  user: 'admin',
  password: 'Tcc2024*',
  database: 'TccEsp1'
};

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
    let respuesta = '';

    switch (tipo) {
      case 'consumo24h':
        const [consumo24h] = await connection.execute(
          'SELECT SUM(value) as consumo FROM sensor_data WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)'
        );
        respuesta = `En las últimas 24 horas has consumido aproximadamente ${(consumo24h[0].consumo / 1000).toFixed(2)} kWh.`;
        break;

      case 'consumoMensual':
        const [consumoMensual] = await connection.execute(
          'SELECT SUM(value) as consumo FROM sensor_data WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 MONTH)'
        );
        respuesta = `Tu consumo mensual de energía es de aproximadamente ${(consumoMensual[0].consumo / 1000).toFixed(2)} kWh.`;
        break;

      case 'reducirConsumo':
        respuesta = "Para reducir el consumo de energía:\n1. Apaga las luces cuando no estés en la habitación.\n2. Utiliza temporizadores para las luces exteriores.\n3. Reemplaza las bombillas tradicionales por LED.\n4. Aprovecha la luz natural durante el día.";
        break;

      case 'eficienciaIluminacion':
        respuesta = "Para mejorar la eficiencia energética de la iluminación:\n1. Usa bombillas LED de alta eficiencia.\n2. Instala sensores de movimiento en pasillos y exteriores.\n3. Utiliza reguladores de intensidad.\n4. Pinta las paredes de colores claros para reflejar mejor la luz.";
        break;

      case 'alertaConsumo':
        const [alertaConsumo] = await connection.execute(
          'SELECT AVG(value) as promedio FROM sensor_data WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 HOUR)'
        );
        const promedioHora = alertaConsumo[0].promedio;
        if (promedioHora > 1000) { // Suponiendo que 1000 mA es un umbral alto
          respuesta = `Alerta: El consumo promedio en la última hora (${promedioHora.toFixed(2)} mA) es elevado.`;
        } else {
          respuesta = "No se han detectado alertas de consumo excesivo en este momento.";
        }
        break;

      case 'tipsAhorro':
        respuesta = "Tips de ahorro de energía:\n1. Usa electrodomésticos eficientes.\n2. Desconecta aparatos que no estés usando.\n3. Aprovecha la luz natural.\n4. Mantén una temperatura adecuada en tu hogar.\n5. Realiza mantenimiento regular a tus electrodomésticos.";
        break;

      case 'lucesConsumo':
        const [lucesConsumo] = await connection.execute(
          'SELECT sensor_type, AVG(value) as promedio FROM sensor_data GROUP BY sensor_type ORDER BY promedio DESC LIMIT 3'
        );
        respuesta = "Las luces que más consumen son:\n" + 
          lucesConsumo.map(luz => `${luz.sensor_type}: ${luz.promedio.toFixed(2)} mA en promedio`).join('\n');
        break;

      case 'intensidadLED':
        respuesta = "El consumo de energía de las luces LED varía linealmente con la intensidad. Reducir la intensidad al 50% generalmente resulta en un ahorro de energía del 50%.";
        break;

      case 'tiempoUsoLED':
        respuesta = "El tiempo ideal de uso diario para optimizar el ahorro con luces LED es utilizarlas solo cuando sea necesario. Las LED son eficientes incluso con uso prolongado, pero se recomienda apagarlas cuando no se necesiten para maximizar el ahorro.";
        break;

      case 'configuracionHorarios':
        respuesta = "Configuración recomendada para optimizar el consumo:\n1. Luces exteriores: Encendido al anochecer, apagado al amanecer.\n2. Áreas comunes: Encendido a las 6 AM, apagado a las 11 PM.\n3. Dormitorios: Encendido a las 7 PM, apagado a las 11 PM.\n4. Usa sensores de movimiento en pasillos y baños.";
        break;

      default:
        respuesta = "Tipo de consulta no reconocido.";
    }

    await connection.end();
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