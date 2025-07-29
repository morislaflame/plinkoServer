const ApiError = require("../errors/ApiError");
const sequelize = require("../db");
const { User, Game } = require("../models/models");

class GameController {
  // Функция для определения множителя выигрыша
  calculateMultiplier = () => {
    const random = Math.random() * 100;
    
    // Распределение вероятностей (в процентах)
    if (random < 40) return 0.2;        // 40% шанс
    if (random < 70) return 0.6;        // 30% шанс
    if (random < 85) return 1.2;        // 15% шанс
    if (random < 93) return 3;          // 8% шанс
    if (random < 97) return 10;         // 4% шанс
    if (random < 99) return 15;         // 2% шанс
    return 50;                          // 1% шанс
  }

  async startGame(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const userId = req.user.id;

      // Проверяем существование пользователя
      const user = await User.findByPk(userId, { transaction });
      if (!user) {
        await transaction.rollback();
        return next(ApiError.notFound("User not found"));
      }

      // Создаем новую игру с нулевой ставкой и выигрышем
      const game = await Game.create(
        {
          player_id: userId,
          bet: 0,
          win: 0,
        },
        { transaction }
      );

      await transaction.commit();

      return res.json({
        game: {
          id: game.id,
          player_id: game.player_id,
          bet: game.bet,
          win: game.win,
          createdAt: game.createdAt,
        },
        message: "Game started successfully",
      });
    } catch (e) {
      await transaction.rollback();
      console.error("Error starting game:", e);
      next(ApiError.internal(e.message));
    }
  }

  makeBet = async (req, res, next) => {
    const transaction = await sequelize.transaction();

    try {
      const userId = req.user.id;
      const { gameId, betAmount } = req.body;

      // Валидация входных данных
      if (!gameId || !betAmount || betAmount <= 0) {
        await transaction.rollback();
        return next(ApiError.badRequest("Game ID and valid bet amount are required"));
      }

      // Проверяем пользователя
      const user = await User.findByPk(userId, { transaction });
      if (!user) {
        await transaction.rollback();
        return next(ApiError.notFound("User not found"));
      }

      // Проверяем баланс пользователя
      if (user.balance < betAmount) {
        await transaction.rollback();
        return next(ApiError.badRequest("Insufficient balance"));
      }

      // Проверяем существование игры и принадлежность пользователю
      const game = await Game.findOne({
        where: { id: gameId, player_id: userId },
        transaction,
      });

      if (!game) {
        await transaction.rollback();
        return next(ApiError.notFound("Game not found or doesn't belong to user"));
      }

      // Списываем ставку с баланса
      user.balance -= betAmount;
      await user.save({ transaction });

      // Рассчитываем выигрыш - ИСПРАВЛЕНИЕ: используем this.calculateMultiplier()
      const multiplier = this.calculateMultiplier();
      const winAmount = Math.floor(betAmount * multiplier);

      // Обновляем игру
      game.bet += betAmount;
      game.win += winAmount;
      await game.save({ transaction });

      // Добавляем выигрыш к балансу пользователя
      user.balance += winAmount;
      await user.save({ transaction });

      await transaction.commit();

      return res.json({
        game: {
          id: game.id,
          player_id: game.player_id,
          bet: game.bet,
          win: game.win,
          updatedAt: game.updatedAt,
        },
        betResult: {
          betAmount,
          multiplier,
          winAmount,
          newBalance: user.balance,
        },
        message: "Bet placed successfully",
      });
    } catch (e) {
      await transaction.rollback();
      console.error("Error making bet:", e);
      next(ApiError.internal(e.message));
    }
  }

  async getGameHistory(req, res, next) {
    try {
      const userId = req.user.id;
      const { limit = 10, offset = 0 } = req.query;

      const games = await Game.findAll({
        where: { player_id: userId },
        order: [["createdAt", "DESC"]],
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      return res.json({
        games,
        message: "Game history retrieved successfully",
      });
    } catch (e) {
      console.error("Error getting game history:", e);
      next(ApiError.internal(e.message));
    }
  }

  async getGameById(req, res, next) {
    try {
      const userId = req.user.id;
      const { gameId } = req.params;

      const game = await Game.findOne({
        where: { id: gameId, player_id: userId },
      });

      if (!game) {
        return next(ApiError.notFound("Game not found"));
      }

      return res.json({
        game,
        message: "Game retrieved successfully",
      });
    } catch (e) {
      console.error("Error getting game:", e);
      next(ApiError.internal(e.message));
    }
  }
}

module.exports = new GameController();