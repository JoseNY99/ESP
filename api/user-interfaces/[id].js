const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'tccesp.cra46uwu2j45.us-east-2.rds.amazonaws.com',
  user: 'admin',
  password: 'Tcc2024*',
  database: 'TccEsp1'
};

async function handler(req, res) {
  const { id } = req.params; // Usa req.params para obtener el id de la URL

  if (req.method === 'DELETE') {
    try {
      const connection = await mysql.createConnection(dbConfig);
      
      const [result] = await connection.execute(
        'DELETE FROM interfaces WHERE id = ? AND id_usuario = ?',
        [id, 1] // Asumiendo que el ID del usuario es 1
      );

      await connection.end();

      if (result.affectedRows > 0) {
        res.status(200).json({ message: 'Interfaz eliminada exitosamente' });
      } else {
        res.status(404).json({ error: 'Interfaz no encontrada' });
      }
    } catch (err) {
      console.error('Error al eliminar la interfaz:', err);
      res.status(500).json({ error: 'Error al eliminar la interfaz' });
    }
  } else {
    res.setHeader('Allow', ['DELETE']);
    res.status(405).json({ error: `Método ${req.method} no permitido` });
  }
}

module.exports = handler;
