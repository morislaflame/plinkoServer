require("dotenv").config();
const express = require("express");
const cors = require("cors");
const sequelize = require("./db");
const router = require("./routes");
const errorHandler = require("./middlewares/errorHandlingMiddleware");
// const { bot } = require("./services/botInstance");
// const { initializeBuckets } = require("./services/mediaService");
// const { webhookCallback } = require("grammy"); // Импортируем webhookCallback
// const promBundle = require("express-prom-bundle"); // <--- Добавляем импорт

const app = express();
const CLIENT_URL = "*";

// Добавляем middleware для сбора метрик
// Обычно это делают до определения маршрутов, чтобы захватить все запросы
// const metricsMiddleware = promBundle({
//   includeMethod: true, // Включать метод HTTP в метки
//   includePath: true,   // Включать путь в метки
//   includeStatusCode: true, // Включать код состояния HTTP в метки
//   promClient: {
//     collectDefaultMetrics: {} // Собирать стандартные метрики Node.js (CPU, память и т.д.)
//   }
// });
// app.use(metricsMiddleware); // <--- Используем middleware

app.set("trust proxy", 1);
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json());
app.use("/api", router);

// Настраиваем маршрут для вебхука
// const secretToken = process.env.WEBHOOK_SECRET_TOKEN || "my-secret-token";
// app.use("/webhook", webhookCallback(bot, "express", { secretToken }));

// Обработка ошибок — в самом конце
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    // Подключаемся к базе
    await sequelize.authenticate();
    await sequelize.sync({ alter: true, force: false });
    console.log("Database synced");

    // Инициализация MinIO
    // await initializeBuckets();
    // console.log("MinIO buckets initialized");

    // Стартуем веб-сервер и устанавливаем вебхук
    app.listen(PORT, async () => {
      console.log(`Server started on port ${PORT}`);
      // const webhookUrl =
      //   process.env.WEBHOOK_URL || `https://my-domain.com/webhook`;
      // await bot.api.setWebhook(webhookUrl, { secret_token: secretToken });
      // console.log(`Webhook set to ${webhookUrl}`);
    });
  } catch (e) {
    console.log("Error in start():", e);
  }
}

start();
