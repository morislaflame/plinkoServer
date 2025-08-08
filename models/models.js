const sequelize = require("../db");
const { DataTypes } = require("sequelize");

// ***********************
// Существующие модели
// ***********************

const User = sequelize.define(
  "user",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    email: { type: DataTypes.STRING, unique: true, allowNull: true },
    password: { type: DataTypes.STRING, allowNull: true },
    role: {
      type: DataTypes.ENUM("USER", "ADMIN"),
      defaultValue: "USER",
      allowNull: false,
    },
    balance: { type: DataTypes.FLOAT, defaultValue: 0, allowNull: false },
  },
);

const Game = sequelize.define(
  "game",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    player_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: "users", key: "id" } },
    bet: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    win: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  },
);

User.hasMany(Game, { foreignKey: "player_id" });
Game.belongsTo(User, { foreignKey: "player_id" });


module.exports = {
  User,
  Game,
};