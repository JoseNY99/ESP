const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();
const deleteInterfaceHandler = require('./api/user-interfaces/[id]'); // Ajusta la ruta según tu estructura
const userInterfacesHandler = require('./api/user-interfaces');

const dbConfig = {
  host: 'tccesp.cra46uwu2j45.us-east-2.rds.amazonaws.com',
  user: 'admin',
  password: 'Tcc2024*',
  database: 'TccEsp1'
};

router.get('/user-interfaces', userInterfacesHandler);
router.delete('/user-interfaces/:id', deleteInterfaceHandler);

// Add this new route
router.get('/user', async (req, res) => {
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
  
  router.post('/change-password', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }
  
    const { contrasenha } = req.body;
  
    if (!contrasenha) {
      return res.status(400).json({ error: 'La nueva contraseña es requerida' });
    }
  
    try {
      const connection = await mysql.createConnection(dbConfig);
      await connection.execute(
        'UPDATE usuario SET contrasenha = ? WHERE id = ?',
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
  module.exports = router;
