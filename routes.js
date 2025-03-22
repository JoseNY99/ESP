const express = require("express")
const mysql = require("mysql2/promise")
const router = express.Router()
const { GoogleGenerativeAI } = require("@google/generative-ai")
const deleteInterfaceHandler = require("./api/user-interfaces/[id]")
const userInterfacesHandler = require("./api/user-interfaces")
const rateLimit = require("express-rate-limit")

const dbConfig = {
  host: "tccesp.cra46uwu2j45.us-east-2.rds.amazonaws.com",
  user: "admin",
  password: "Tcc2024*",
  database: "TccEsp1",
}

// Initialize Gemini API with v1 API version
const genAI = new GoogleGenerativeAI("AIzaSyAP2kXnTbbbX5ML-smVrYq1XiR_6whPZTg", {
  apiVersion: "v1", // Use v1 instead of v1beta
})

// Create a rate limiter for AI requests
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // limit each IP to 5 requests per minute
  message: { error: "Demasiadas consultas a la IA, por favor intente más tarde" },
  standardHeaders: true,
  legacyHeaders: false,
})

// Fallback responses when API is unavailable
const fallbackResponses = {
  consumo24h:
    "Basado en su consumo de las últimas 24 horas, se recomienda revisar los dispositivos que están encendidos durante la noche. Las luces LED son eficientes, pero dejarlas encendidas innecesariamente sigue consumiendo energía. Considere usar temporizadores para apagar automáticamente las luces en habitaciones no utilizadas.",
  consumoMensual:
    "Su consumo mensual está dentro del rango normal para un hogar. Para reducirlo, considere: 1) Reemplazar bombillas incandescentes con LED, 2) Desconectar cargadores cuando no estén en uso, 3) Utilizar temporizadores para las luces, 4) Ajustar la intensidad de las luces según la necesidad.",
  reducirConsumo:
    "Para reducir el consumo durante el día: aproveche la luz natural, ajuste la intensidad de las luces LED según la actividad, y apague las luces en habitaciones vacías. Durante la noche: use luces con sensores de movimiento en pasillos, configure temporizadores para apagar luces automáticamente, y utilice luces de baja intensidad para orientación nocturna.",
  eficienciaIluminacion:
    "Para mejorar la eficiencia energética de la iluminación: 1) Use bombillas LED de alta eficiencia, 2) Instale reguladores de intensidad, 3) Utilice sensores de movimiento en áreas de paso, 4) Aproveche la luz natural con cortinas ligeras, 5) Limpie regularmente las lámparas para mantener su luminosidad.",
  alertaConsumo:
    "No se detecta un consumo excesivo en este momento. Su consumo actual está dentro de los parámetros normales para un hogar con iluminación LED.",
  tipsAhorro:
    "Tips para ahorrar energía: 1) Configure escenas de iluminación para diferentes actividades, 2) Use temporizadores para apagar luces automáticamente, 3) Instale sensores de presencia, 4) Ajuste la intensidad según la hora del día, 5) Agrupe las luces por zonas para controlar mejor su uso.",
  lucesConsumo:
    "Las luces que más consumen en su hogar son generalmente las de uso continuo. Recomendaciones: 1) Reemplace las bombillas de mayor uso con LED de alta eficiencia, 2) Instale temporizadores en estas áreas, 3) Considere reducir la intensidad cuando no se necesite iluminación completa.",
  intensidadLED:
    "El consumo de las luces LED varía linealmente con la intensidad. Al reducir la intensidad al 50%, el consumo se reduce aproximadamente al 50%. Para optimizar: 1) Use intensidad alta solo cuando sea necesario, 2) Configure escenas predeterminadas para diferentes actividades, 3) Utilice la función de atenuación automática según la hora del día.",
  tiempoUsoLED:
    "Tiempo ideal de uso para luces LED: Sala/comedor: 4-6 horas, Cocina: 3-4 horas, Dormitorios: 2-3 horas, Baños: 1-2 horas, Pasillos: usar sensores de movimiento. Aunque las LED son eficientes, apagarlas cuando no se necesitan siempre ahorra más energía.",
  configuracionHorarios:
    "Configuración recomendada: Mañana (6-9am): intensidad media en áreas comunes. Día (9am-5pm): apagado automático o intensidad baja. Tarde (5-10pm): intensidad completa en áreas de actividad. Noche (10pm-6am): luces de orientación en pasillos con sensores de movimiento, resto apagadas o en modo nocturno de baja intensidad.",
  validacion: "SI", // Por defecto, permitimos la consulta si no podemos validarla
  consulta_libre: "Lo siento, el servicio de IA no está disponible en este momento. Por favor, intenta más tarde.",
}

// Function to list available models
async function listAvailableModels() {
  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1/models", {
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": "AIzaSyAP2kXnTbbbX5ML-smVrYq1XiR_6whPZTg",
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    console.log(
      "Available models:",
      data.models.map((m) => m.name),
    )
    return data.models
  } catch (error) {
    console.error("Error listing models:", error)
    return []
  }
}

// Call this function when your server starts
listAvailableModels().then((models) => {
  if (models.length > 0) {
    // Lista de modelos preferidos en orden de preferencia
    const preferredModels = [
      "gemini-1.5-flash",
      "gemini-1.5-pro",
      "gemini-1.5-pro-latest",
      "gemini-pro",
      "gemini-pro-latest",
    ]

    // Intenta encontrar uno de los modelos preferidos
    let selectedModel = null
    for (const preferredModel of preferredModels) {
      const model = models.find(
        (m) =>
          m.name.includes(preferredModel) &&
          m.supportedGenerationMethods &&
          m.supportedGenerationMethods.includes("generateContent"),
      )

      if (model) {
        selectedModel = model
        break
      }
    }

    // Si no encontramos ninguno de los preferidos, usa el primer modelo disponible que soporte generateContent
    if (!selectedModel) {
      selectedModel = models.find(
        (m) => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"),
      )
    }

    if (selectedModel) {
      console.log(`Using model: ${selectedModel.name}`)
      // Store the model name in a variable to use in your API calls
      global.availableModel = selectedModel.name.split("/").pop()
    } else {
      console.warn("No suitable model found. Using fallback model name.")
      global.availableModel = "gemini-1.5-flash" // Fallback to a known model
    }
  } else {
    console.warn("No models available. Using fallback model name.")
    global.availableModel = "gemini-1.5-flash" // Fallback to a known model
  }
})

// Function to call Gemini API with retry logic and fallback
async function callGeminiWithRetry(prompt, queryType, maxRetries = 3) {
  // Check if we should use fallback mode
  if (process.env.USE_AI_MOCK === "true" && fallbackResponses[queryType]) {
    console.log("Using mock response for:", queryType)
    return fallbackResponses[queryType]
  }

  let retries = 0

  while (retries < maxRetries) {
    try {
      // Try different model names
      const modelName = global.availableModel || "gemini-1.5-flash"
      console.log(`Attempting to use model: ${modelName}`)

      const model = genAI.getGenerativeModel({ model: modelName })
      const result = await model.generateContent(prompt)
      const response = await result.response
      return response.text()
    } catch (error) {
      console.error(`Error with model attempt ${retries + 1}:`, error.message)

      if ((error.status === 429 || error.status === 404) && retries < maxRetries - 1) {
        // Calculate exponential backoff time (1s, 2s, 4s, etc.)
        const waitTime = Math.pow(2, retries) * 1000
        console.log(`Retrying in ${waitTime}ms...`)
        await new Promise((resolve) => setTimeout(resolve, waitTime))
        retries++
      } else {
        // If we've exhausted retries or got a different error, use fallback if available
        if (fallbackResponses[queryType]) {
          console.log("Using fallback response after API failure for:", queryType)
          return fallbackResponses[queryType]
        }
        throw error
      }
    }
  }

  // If we've exhausted retries, use fallback if available
  if (fallbackResponses[queryType]) {
    console.log("Using fallback response after max retries for:", queryType)
    return fallbackResponses[queryType]
  }

  throw new Error("Failed to get response after maximum retries")
}

// Función para validar si una consulta está relacionada con la aplicación
async function validarConsulta(consulta) {
  try {
    // Palabras clave relacionadas con la aplicación
    const palabrasClave = [
      "luz",
      "luces",
      "led",
      "bombilla",
      "lámpara",
      "iluminación",
      "consumo",
      "energía",
      "electricidad",
      "watts",
      "vatios",
      "potencia",
      "ahorro",
      "eficiencia",
      "gasto",
      "factura",
      "costo",
      "tarifa",
      "encendido",
      "apagado",
      "intensidad",
      "brillo",
      "temporizador",
      "sensor",
      "movimiento",
      "automatización",
      "smart",
      "inteligente",
      "energia",
    ]

    // Verificar si la consulta contiene alguna palabra clave
    const consultaLowerCase = consulta.toLowerCase()
    const contienePalabraClave = palabrasClave.some((palabra) => consultaLowerCase.includes(palabra))

    // Si la consulta es muy corta, podemos usar la IA para validarla
    if (!contienePalabraClave && consulta.length > 10) {
      const promptValidacion = `
        Determina si la siguiente consulta está relacionada con el consumo de energía de luces o iluminación en un hogar:
        "${consulta}"
        
        Responde únicamente con "SI" si está relacionada o "NO" si no lo está.
      `

      const respuestaValidacion = await callGeminiWithRetry(promptValidacion, "validacion")
      return respuestaValidacion.trim().toUpperCase().startsWith("SI")
    }

    return contienePalabraClave
  } catch (error) {
    console.error("Error al validar la consulta:", error)
    // En caso de error, permitimos la consulta para evitar falsos negativos
    return true
  }
}

// Middleware to check authentication
const checkAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "No autorizado" })
  }
  next()
}

router.get("/user-interfaces", checkAuth, userInterfacesHandler)
router.delete("/user-interfaces/:id", checkAuth, deleteInterfaceHandler)

router.get("/user", checkAuth, async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig)
    const [rows] = await connection.execute(
      "SELECT email, nombre, apellido, nombre_usuario FROM usuario WHERE id = ?",
      [req.session.userId],
    )
    await connection.end()

    if (rows.length > 0) {
      res.status(200).json(rows[0])
    } else {
      res.status(404).json({ error: "Usuario no encontrado" })
    }
  } catch (err) {
    console.error("Error al obtener los datos del usuario:", err)
    res.status(500).json({ error: "Error en el servidor" })
  }
})

router.post("/change-password", checkAuth, async (req, res) => {
  const { contrasenha } = req.body

  if (!contrasenha) {
    return res.status(400).json({ error: "La nueva contraseña es requerida" })
  }

  try {
    const connection = await mysql.createConnection(dbConfig)
    await connection.execute("UPDATE usuario SET contrasena = ? WHERE id = ?", [contrasenha, req.session.userId])
    await connection.end()

    res.status(200).json({ message: "Contraseña actualizada exitosamente" })
  } catch (err) {
    console.error("Error al cambiar la contraseña:", err)
    res.status(500).json({ error: "Error en el servidor" })
  }
})

router.post("/api/sensor-data", async (req, res) => {
  const { sensor_type, value } = req.body

  if (!sensor_type || value === undefined) {
    return res.status(400).json({ error: "Sensor type and value are required" })
  }

  try {
    const connection = await mysql.createConnection(dbConfig)

    const [result] = await connection.execute("INSERT INTO sensor_data (sensor_type, value) VALUES (?, ?)", [
      sensor_type,
      value,
    ])

    await connection.end()

    res.status(201).json({ message: "Sensor data stored successfully", id: result.insertId })
  } catch (err) {
    console.error("Error storing sensor data:", err)
    res.status(500).json({ error: "Error storing sensor data" })
  }
})

router.get("/api/sensor-data", async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig)
    const [rows] = await connection.execute("SELECT * FROM sensor_data ORDER BY timestamp DESC LIMIT 100")
    await connection.end()
    res.json(rows)
  } catch (error) {
    console.error("Error fetching sensor data:", error)
    res.status(500).json({ error: "Error fetching sensor data" })
  }
})

// Apply rate limiter to the AI endpoint
router.get("/api/consulta-energia", aiLimiter, async (req, res) => {
  const { tipo } = req.query

  if (!tipo) {
    return res.status(400).json({ error: "Tipo de consulta no especificado" })
  }

  try {
    const connection = await mysql.createConnection(dbConfig)
    let prompt = ""

    switch (tipo) {
      case "consumo24h":
        const [consumo24h] = await connection.execute(
          "SELECT SUM(value) as consumo FROM sensor_data WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)",
        )
        prompt = `En las últimas 24 horas se ha consumido aproximadamente ${(consumo24h[0].consumo / 1000).toFixed(2)} kWh. Proporciona un análisis detallado de este consumo y sugerencias para mejorarlo.`
        break

      case "consumoMensual":
        const [consumoMensual] = await connection.execute(
          "SELECT SUM(value) as consumo FROM sensor_data WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 MONTH)",
        )
        prompt = `El consumo mensual de energía es de aproximadamente ${(consumoMensual[0].consumo / 1000).toFixed(2)} kWh. Analiza este consumo y proporciona recomendaciones para reducirlo.`
        break

      case "reducirConsumo":
        prompt =
          "Proporciona consejos detallados sobre cómo reducir el consumo de energía durante el día y la noche en un hogar."
        break

      case "eficienciaIluminacion":
        prompt =
          "Explica cómo mejorar la eficiencia energética de la iluminación en un hogar, incluyendo tipos de bombillas y estrategias de uso."
        break

      case "alertaConsumo":
        const [alertaConsumo] = await connection.execute(
          "SELECT AVG(value) as promedio FROM sensor_data WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 HOUR)",
        )
        const promedioHora = alertaConsumo[0].promedio
        prompt = `El consumo promedio en la última hora es de ${promedioHora.toFixed(2)} mA. Analiza si esto representa un consumo excesivo y proporciona recomendaciones.`
        break

      case "tipsAhorro":
        prompt =
          "Proporciona tips detallados y específicos para ahorrar energía en un hogar, basados en las últimas tendencias y tecnologías."
        break

      case "lucesConsumo":
        const [lucesConsumo] = await connection.execute(
          "SELECT sensor_type, AVG(value) as promedio FROM sensor_data GROUP BY sensor_type ORDER BY promedio DESC LIMIT 3",
        )
        prompt =
          "Analiza el consumo de las siguientes luces y proporciona recomendaciones para optimizar su uso: " +
          lucesConsumo.map((luz) => `${luz.sensor_type}: ${luz.promedio.toFixed(2)} mA en promedio`).join(", ")
        break

      case "intensidadLED":
        prompt =
          "Explica cómo varía el consumo de energía cuando se ajusta la intensidad de las luces LED y proporciona recomendaciones para su uso óptimo."
        break

      case "tiempoUsoLED":
        prompt =
          "Analiza y recomienda el tiempo ideal de uso diario para optimizar el ahorro con luces LED en diferentes áreas de un hogar."
        break

      case "configuracionHorarios":
        prompt =
          "Proporciona una configuración detallada de horarios para las luces LED en diferentes áreas de un hogar para optimizar el consumo de energía."
        break

      default:
        prompt = "Proporciona información general sobre el ahorro de energía en el hogar."
    }

    await connection.end()

    // Use the retry function with fallback
    try {
      const respuesta = await callGeminiWithRetry(prompt, tipo)
      res.json({ respuesta })
    } catch (aiError) {
      console.error("Error al llamar a la API de Gemini:", aiError)

      // If we have a fallback for this query type, use it
      if (fallbackResponses[tipo]) {
        res.json({
          respuesta: fallbackResponses[tipo],
          note: "Esta respuesta es una alternativa debido a la indisponibilidad del servicio de IA.",
        })
      } else {
        res.status(503).json({
          error: "Error al procesar la consulta con la IA",
          message: "El servicio de IA no está disponible en este momento. Por favor, intente más tarde.",
        })
      }
    }
  } catch (error) {
    console.error("Error en la consulta de energía:", error)
    res.status(500).json({ error: "Error en el servidor al procesar la consulta" })
  }
})

// Add a simple caching mechanism for common AI responses
const responseCache = new Map()
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes in milliseconds

// Helper function to get cached response or generate new one
async function getCachedOrFreshResponse(prompt, tipo) {
  const cacheKey = `${tipo}_${prompt.substring(0, 50)}`

  // Check if we have a cached response that's not expired
  if (responseCache.has(cacheKey)) {
    const cachedItem = responseCache.get(cacheKey)
    if (cachedItem.timestamp > Date.now() - CACHE_TTL) {
      console.log("Using cached response for:", cacheKey)
      return cachedItem.response
    }
  }

  // Generate new response
  const response = await callGeminiWithRetry(prompt, tipo)

  // Cache the response
  responseCache.set(cacheKey, {
    response,
    timestamp: Date.now(),
  })

  return response
}

// Add a new endpoint that uses caching
router.get("/api/consulta-energia-cached", async (req, res) => {
  const { tipo } = req.query

  if (!tipo) {
    return res.status(400).json({ error: "Tipo de consulta no especificado" })
  }

  try {
    const connection = await mysql.createConnection(dbConfig)
    let prompt = ""

    // Same switch case as in the original endpoint
    switch (tipo) {
      case "reducirConsumo":
        prompt =
          "Proporciona consejos detallados sobre cómo reducir el consumo de energía durante el día y la noche en un hogar."
        break
      case "eficienciaIluminacion":
        prompt =
          "Explica cómo mejorar la eficiencia energética de la iluminación en un hogar, incluyendo tipos de bombillas y estrategias de uso."
        break
      case "tipsAhorro":
        prompt =
          "Proporciona tips detallados y específicos para ahorrar energía en un hogar, basados en las últimas tendencias y tecnologías."
        break
      case "intensidadLED":
        prompt =
          "Explica cómo varía el consumo de energía cuando se ajusta la intensidad de las luces LED y proporciona recomendaciones para su uso óptimo."
        break
      case "tiempoUsoLED":
        prompt =
          "Analiza y recomienda el tiempo ideal de uso diario para optimizar el ahorro con luces LED en diferentes áreas de un hogar."
        break
      case "configuracionHorarios":
        prompt =
          "Proporciona una configuración detallada de horarios para las luces LED en diferentes áreas de un hogar para optimizar el consumo de energía."
        break
      // For data-dependent queries, use the original endpoint
      default:
        return res.status(400).json({ error: "Este tipo de consulta no soporta caché" })
    }

    await connection.end()

    // Get cached or fresh response
    try {
      const respuesta = await getCachedOrFreshResponse(prompt, tipo)
      res.json({ respuesta })
    } catch (aiError) {
      console.error("Error al llamar a la API de Gemini:", aiError)

      // If we have a fallback for this query type, use it
      if (fallbackResponses[tipo]) {
        res.json({
          respuesta: fallbackResponses[tipo],
          note: "Esta respuesta es una alternativa debido a la indisponibilidad del servicio de IA.",
        })
      } else {
        res.status(503).json({
          error: "Error al procesar la consulta con la IA",
          message: "El servicio de IA no está disponible en este momento. Por favor, intente más tarde.",
        })
      }
    }
  } catch (error) {
    console.error("Error en la consulta de energía:", error)
    res.status(500).json({ error: "Error en el servidor al procesar la consulta" })
  }
})

// Endpoint para consultas libres a la IA
router.post("/api/consulta-libre", aiLimiter, async (req, res) => {
  const { consulta } = req.body

  if (!consulta) {
    return res.status(400).json({ error: "La consulta es requerida" })
  }

  try {
    // Primero validamos si la consulta está relacionada con la aplicación
    const esConsultaValida = await validarConsulta(consulta)

    if (!esConsultaValida) {
      return res.json({
        error:
          "Lo siento, tu consulta no parece estar relacionada con el consumo de energía de las luces. Por favor, realiza una consulta relacionada con la aplicación.",
      })
    }

    // Obtenemos datos de contexto para enriquecer la respuesta
    const connection = await mysql.createConnection(dbConfig)

    // Obtener datos de consumo de las últimas 24 horas
    const [consumo24h] = await connection.execute(
      "SELECT AVG(value) as promedio FROM sensor_data WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)",
    )

    // Obtener datos de consumo del último mes
    const [consumoMensual] = await connection.execute(
      "SELECT AVG(value) as promedio FROM sensor_data WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 MONTH)",
    )

    // Obtener tipos de luces y su consumo promedio
    const [tiposLuces] = await connection.execute(
      "SELECT sensor_type, AVG(value) as promedio FROM sensor_data GROUP BY sensor_type HAVING sensor_type LIKE '%led%' OR sensor_type LIKE '%luz%' OR sensor_type LIKE '%lamp%' ORDER BY promedio DESC LIMIT 5",
    )

    await connection.end()

    // Crear un prompt enriquecido con el contexto
    const promptEnriquecido = `
      Consulta del usuario: "${consulta}"
      
      Contexto actual del sistema:
      - Consumo promedio en las últimas 24 horas: ${consumo24h[0].promedio ? consumo24h[0].promedio.toFixed(2) : "No disponible"} mA
      - Consumo promedio en el último mes: ${consumoMensual[0].promedio ? consumoMensual[0].promedio.toFixed(2) : "No disponible"} mA
      - Tipos de luces y su consumo: ${tiposLuces.map((luz) => `${luz.sensor_type}: ${luz.promedio.toFixed(2)} mA`).join(", ")}
      
      Responde a la consulta del usuario de manera concisa y útil, utilizando el contexto proporcionado cuando sea relevante. La respuesta debe estar enfocada en el consumo de energía de las luces y cómo optimizarlo.
    `

    // Llamar a la API de IA con el prompt enriquecido
    const respuesta = await callGeminiWithRetry(promptEnriquecido, "consulta_libre")
    res.json({ respuesta })
  } catch (error) {
    console.error("Error al procesar la consulta libre:", error)
    res.status(500).json({ error: "Error en el servidor al procesar la consulta" })
  }
})

router.get("/api/energy-consumption", async (req, res) => {
  const { period } = req.query

  if (!period || !["day", "week", "month", "year"].includes(period)) {
    return res.status(400).json({ error: "Invalid period specified" })
  }

  try {
    const connection = await mysql.createConnection(dbConfig)
    let query
    let interval

    switch (period) {
      case "day":
        interval = "HOUR"
        query = `
          SELECT DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00') as time_interval, 
                 AVG(value) as average_consumption
          FROM sensor_data
          WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 DAY)
          GROUP BY time_interval
          ORDER BY time_interval
        `
        break
      case "week":
        interval = "DAY"
        query = `
          SELECT DATE(timestamp) as time_interval, 
                 AVG(value) as average_consumption
          FROM sensor_data
          WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 WEEK)
          GROUP BY time_interval
          ORDER BY time_interval
        `
        break
      case "month":
        interval = "DAY"
        query = `
          SELECT DATE(timestamp) as time_interval, 
                 AVG(value) as average_consumption
          FROM sensor_data
          WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
          GROUP BY time_interval
          ORDER BY time_interval
        `
        break
      case "year":
        interval = "MONTH"
        query = `
          SELECT DATE_FORMAT(timestamp, '%Y-%m-01') as time_interval, 
                 AVG(value) as average_consumption
          FROM sensor_data
          WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 YEAR)
          GROUP BY time_interval
          ORDER BY time_interval
        `
        break
    }

    const [rows] = await connection.execute(query)
    await connection.end()

    res.json({ data: rows, interval })
  } catch (error) {
    console.error("Error fetching energy consumption data:", error)
    res.status(500).json({ error: "Error fetching energy consumption data" })
  }
})

// Agregar un nuevo endpoint para obtener datos de consumo de energía de las últimas 24 horas
router.get("/api/energy-cost-data", async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig)

    // Consulta para obtener datos de las últimas 24 horas
    const query = `
      SELECT 
        AVG(value) as average_consumption,
        MIN(value) as min_consumption,
        MAX(value) as max_consumption,
        COUNT(*) as sample_count
      FROM sensor_data
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `

    const [rows] = await connection.execute(query)
    await connection.end()

    if (!rows[0].average_consumption) {
      return res.status(404).json({ error: "No hay datos disponibles para las últimas 24 horas" })
    }

    // Calcular el consumo en kWh y el costo
    const avgConsumptionAmps = rows[0].average_consumption / 1000 // Convertir mA a A
    const voltage = 220 // Voltaje estándar en Paraguay (V)
    const powerWatts = voltage * avgConsumptionAmps
    const energyConsumed = (powerWatts * 24) / 1000 // kWh en 24 horas
    const tariff = 435.51 // G/kWh
    const dailyCost = energyConsumed * tariff
    const monthlyCost = dailyCost * 30
    const annualCost = monthlyCost * 12

    res.json({
      raw_data: rows[0],
      calculations: {
        average_consumption_amps: avgConsumptionAmps,
        power_watts: powerWatts,
        energy_consumed_kwh: energyConsumed,
        daily_cost: dailyCost,
        monthly_cost: monthlyCost,
        annual_cost: annualCost,
      },
    })
  } catch (error) {
    console.error("Error calculando el costo de energía:", error)
    res.status(500).json({ error: "Error calculando el costo de energía" })
  }
})

module.exports = router

