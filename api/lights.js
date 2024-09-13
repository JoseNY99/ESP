const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'tccesp.cra46uwu2j45.us-east-2.rds.amazonaws.com',
  user: 'admin',
  password: 'Tcc2024*',
  database: 'TccEsp1',
  port: 3306
};

async function handler(req, res) {
  if (req.method === 'POST') {
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
      console.error(err);
      res.status(500).json({ error: 'Error al insertar en la base de datos' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

module.exports = handler;