const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'tccesp.cra46uwu2j45.us-east-2.rds.amazonaws.com',
  user: 'admin',
  password: 'Tcc2024*',
  database: 'TccEsp1'
};

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