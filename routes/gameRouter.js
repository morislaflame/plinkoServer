const Router = require("express");
const router = new Router();
const gameController = require("../controllers/gameController");
const authMiddleware = require("../middlewares/authMiddleware");
const { userLimiter } = require("../utilities/ApiLimiter");

// Начать новую игру
router.post("/start", authMiddleware, userLimiter, gameController.startGame);

// Сделать ставку в игре
router.post("/bet", authMiddleware, userLimiter, gameController.makeBet);

// Получить историю игр пользователя
router.get("/history", authMiddleware, userLimiter, gameController.getGameHistory);

// Получить информацию о конкретной игре
router.get("/:gameId", authMiddleware, userLimiter, gameController.getGameById);

module.exports = router;