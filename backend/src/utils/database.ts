import { Sequelize } from "sequelize";
import env from "@utils/env.ts";

const sequelize = new Sequelize(env.DATABASE_URL, {
  dialect: "postgres",
  logging: env.APP_ENV === "dev" ? console.log : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  define: {
    timestamps: true,
    underscored: true,
    freezeTableName: true,
  },
});

export const testConnection = async (): Promise<boolean> => {
  try {
    await sequelize.authenticate();
    console.log("Database connection established successfully.");
    return true;
  } catch (error) {
    console.error("Unable to connect to the database:", error);
    return false;
  }
};

export const closeConnection = async (): Promise<void> => {
  try {
    await sequelize.close();
    console.log("Database connection closed.");
  } catch (error) {
    console.error("Error closing database connection:", error);
  }
};

export default sequelize;
