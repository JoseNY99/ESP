const express = require('express');
const router = express.Router();
const deleteInterfaceHandler = require('./api/user-interfaces/[id]'); // Ajusta la ruta según tu estructura

router.delete('/user-interfaces/:id', deleteInterfaceHandler); // Usa el handler para eliminar

module.exports = router;
