const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'tccesp.cra46uwu2j45.us-east-2.rds.amazonaws.com',
  user: 'admin',
  password: 'Tcc2024*',
  database: 'TccEsp1',
  port: 3306
};

async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const connection = await mysql.createConnection(dbConfig);
      const query = 'SELECT id, nombre,estado, lucesid, tipo FROM interfaces WHERE id_usuario = ?';
      const values = [req.session.userId];
      
      const [rows] = await connection.execute(query, values);
      
      await connection.end();

      res.status(200).json(rows);
    } catch (err) {
      console.error('Error en el servidor:', err);
      res.status(500).json({ error: 'Error al obtener las interfaces del usuario', details: err.message });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

module.exports = handler;