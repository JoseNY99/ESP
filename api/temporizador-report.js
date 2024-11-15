const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'tccesp.cra46uwu2j45.us-east-2.rds.amazonaws.com',
  user: 'admin',
  password: 'Tcc2024*',
  database: 'TccEsp1'
};

router.get('/temporizador-report', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);
    
    const query = `
      SELECT id, led, fecha, hora, accion, id_usuario
      FROM temporizador
      WHERE id_usuario = ?
      ORDER BY fecha DESC, hora DESC
    `;
    
    const [rows] = await connection.execute(query, [req.session.userId]);
    await connection.end();

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No se encontraron datos' });
    }

    res.status(200).json(rows);

  } catch (err) {
    console.error('Error al obtener datos del temporizador:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Asegúrate de que todas tus otras rutas estén aquí también

module.exports = router;