const ApiError = require("../errors/ApiError");
const sequelize = require("../db");
const { User, Game } = require("../models/models");
const points = require("../utilities/points.json");

class GameController {
  // Множители для каждой ячейки (индексы 0-16)
  multipliers = {
    0: 16,
    1: 9,
    2: 2,
    3: 1.4,
    4: 1.4,
    5: 1.2,
    6: 1.1,
    7: 1,
    8: 0.5,
    9: 1,
    10: 1.1,
    11: 1.2,
    12: 1.4,
    13: 1.4,
    14: 2,
    15: 9,
    16: 16
  };

  // Функция для выбора случайной точки с весом к центру
  getRandomPointWithCenterBias = () => {
    const totalSinks = 17;
    const center = 8; // центральная ячейка (индекс 8)
    
    // Создаем веса - чем ближе к центру, тем больше вес
    const weights = [];
    for (let i = 0; i < totalSinks; i++) {
      const distanceFromCenter = Math.abs(i - center);
      // Обратный вес - чем дальше от центра, тем меньше вес
      const weight = Math.max(1, totalSinks - distanceFromCenter * 2);
      weights.push(weight);
    }
    
    // Выбираем случайную ячейку с учетом весов
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;
    
    let selectedSink = 0;
    for (let i = 0; i < weights.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        selectedSink = i;
        break;
      }
    }
    
    // Выбираем случайную точку из выбранной ячейки
    const sinkPoints = points[selectedSink.toString()];
    if (!sinkPoints || sinkPoints.length === 0) {
      // Fallback на центральную ячейку если нет данных
      const centerPoints = points["8"];
      const randomIndex = Math.floor(Math.random() * centerPoints.length);
      return {
        sinkIndex: 8,
        point: centerPoints[randomIndex],
        multiplier: this.multipliers[8]
      };
    }
    
    const randomIndex = Math.floor(Math.random() * sinkPoints.length);
    return {
      sinkIndex: selectedSink,
      point: sinkPoints[randomIndex],
      multiplier: this.multipliers[selectedSink]
    };
  };

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

      // Получаем случайную точку и множитель
      const gameResult = this.getRandomPointWithCenterBias();
      const winAmount = Math.round(betAmount * gameResult.multiplier * 100) / 100; // Округляем до 2 знаков

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
          multiplier: gameResult.multiplier,
          winAmount: winAmount,
          newBalance: user.balance,
          sinkIndex: gameResult.sinkIndex,
          ballStartPosition: gameResult.point
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