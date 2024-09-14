const express = require('express');
const router = express.Router();
const deleteInterfaceHandler = require('./api/user-interfaces/[id]'); // Ajusta la ruta según tu estructura
const userInterfacesHandler = require('./api/user-interfaces');

router.get('/user-interfaces', userInterfacesHandler);
router.delete('/user-interfaces/:id', deleteInterfaceHandler); // Usa el handler para eliminar

module.exports = router;
