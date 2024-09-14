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
      console.log('Iniciando conexión a la base de datos...');
      const connection = await mysql.createConnection(dbConfig);
      console.log('Conexión establecida exitosamente.');
      
      const query = 'SELECT id, nombre, lucesid, tipo FROM interfaces WHERE id_usuario = ?';
      const values = [1]; // Asumimos que el ID del usuario es 1 por ahora
      
      console.log('Ejecutando query:', query);
      console.log('Con valores:', values);
      
      const [rows] = await connection.execute(query, values);
      
      console.log('Query ejecutada. Número de filas devueltas:', rows.length);
      console.log('Primera fila de resultados:', rows[0]);
      console.log('Todos los resultados:', JSON.stringify(rows, null, 2));

      await connection.end();
      console.log('Conexión a la base de datos cerrada.');

      console.log('Datos enviados desde la API:', rows);

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