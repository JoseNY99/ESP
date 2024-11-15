const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'tccesp.cra46uwu2j45.us-east-2.rds.amazonaws.com',
  user: 'admin',
  password: 'Tcc2024*',
  database: 'TccEsp1'
};

router.get('/user', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);
    
    // Consulta SQL específica para obtener todos los campos necesarios
    const [rows] = await connection.execute(
      'SELECT nombre_usuario, nombre, apellido, email FROM usuario WHERE id = ?',
      [req.session.userId]
    );
    
    await connection.end();

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Log para debugging
    console.log('Datos del usuario encontrados:', rows[0]);

    // Asegurarse de que todos los campos estén presentes en la respuesta
    const userData = {
      nombre_usuario: rows[0].nombre_usuario,
      nombre: rows[0].nombre,
      apellido: rows[0].apellido,
      email: rows[0].email
    };

    res.status(200).json(userData);

  } catch (err) {
    console.error('Error al obtener datos del usuario:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

module.exports = router;