import { DataTypes, Model } from "sequelize";
import sequelize from "@utils/database.ts";

interface DocumentAttributes {
  id?: number;
  document_id: string;
  template_content: string;
  placeholders: Record<string, any>;
  pdf_path?: string;
  status: "pending" | "processing" | "completed" | "failed";
  error_message?: string;
  created_at?: Date;
  updated_at?: Date;
}

class Document extends Model<DocumentAttributes> implements DocumentAttributes {
  declare id: number;

  declare document_id: string;

  declare template_content: string;

  declare placeholders: Record<string, any>;

  declare pdf_path?: string;

  declare status: "pending" | "processing" | "completed" | "failed";

  declare error_message?: string;

  declare created_at: Date;

  declare updated_at: Date;
}

Document.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    document_id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    template_content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    placeholders: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    pdf_path: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("pending", "processing", "completed", "failed"),
      allowNull: false,
      defaultValue: "pending",
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "document",
    tableName: "documents",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export default Document;
