const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'tccesp.cra46uwu2j45.us-east-2.rds.amazonaws.com',
  user: 'admin',
  password: 'Tcc2024*',
  database: 'TccEsp1',
  port: 3306
};

async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'GET') {
    // ... (keep existing GET logic)
  } else if (req.method === 'DELETE') {
    try {
      const connection = await mysql.createConnection(dbConfig);
      
      const [result] = await connection.execute(
        'DELETE FROM interfaces WHERE id = ? AND id_usuario = ?',
        [id, 1] // Assuming user ID is 1
      );

      await connection.end();

      if (result.affectedRows > 0) {
        res.status(200).json({ message: 'Interface deleted successfully' });
      } else {
        res.status(404).json({ error: 'Interface not found' });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error deleting interface' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

module.exports = handler;