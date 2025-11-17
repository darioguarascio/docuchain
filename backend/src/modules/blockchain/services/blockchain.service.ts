import sequelize from '@utils/database.ts';
import { calculateHash, deterministicStringify } from '@utils/hash.ts';
import { DataTypes, Model } from 'sequelize';

interface DocumentBlockAttributes {
  id?: number;
  document_id: string;
  previous_hash: string | null;
  hash: string;
  content_hash: string;
  signature_data: string;
  metadata: Record<string, any>;
  created_at?: Date;
}

class DocumentBlock extends Model<DocumentBlockAttributes> implements DocumentBlockAttributes {
  declare id: number;
  declare document_id: string;
  declare previous_hash: string | null;
  declare hash: string;
  declare content_hash: string;
  declare signature_data: string;
  declare metadata: Record<string, any>;
  declare created_at: Date;
}

DocumentBlock.init(
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
    previous_hash: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    hash: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    content_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    signature_data: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
  },
  {
    sequelize,
    modelName: 'document_block',
    tableName: 'document_blocks',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  }
);

/**
 * Creates a new block in the blockchain
 */
export async function createBlock(
  documentId: string,
  contentHash: string,
  signatureData: string,
  metadata: Record<string, any> = {}
): Promise<DocumentBlock> {
  // Get the previous block's hash
  const previousBlock = await DocumentBlock.findOne({
    order: [['created_at', 'DESC']],
  });

  const previousHash = previousBlock ? previousBlock.hash : null;

  // Create block data - use consistent JSON serialization
  const timestamp = new Date().toISOString();
  const blockData = {
    document_id: documentId,
    previous_hash: previousHash,
    content_hash: contentHash,
    signature_data: signatureData,
    metadata: JSON.parse(JSON.stringify(metadata)), // Normalize metadata
    timestamp,
  };

  // Calculate hash - use deterministic stringify for consistency
  const hash = calculateHash(deterministicStringify(blockData));

  // Create block
  const block = await DocumentBlock.create({
    document_id: documentId,
    previous_hash: previousHash,
    hash,
    content_hash: contentHash,
    signature_data: signatureData,
    metadata,
  });

  return block;
}

/**
 * Verifies the integrity of the blockchain
 */
export async function verifyBlockchain(): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  const blocks = await DocumentBlock.findAll({
    order: [['created_at', 'ASC']],
  });

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    // Verify block hash - use consistent JSON serialization
    const blockData = {
      document_id: block.document_id,
      previous_hash: block.previous_hash,
      content_hash: block.content_hash,
      signature_data: block.signature_data,
      metadata: JSON.parse(JSON.stringify(block.metadata)), // Normalize metadata
      timestamp: block.created_at.toISOString(),
    };

    const calculatedHash = calculateHash(deterministicStringify(blockData));
    if (calculatedHash !== block.hash) {
      errors.push(`Block ${block.id} has invalid hash`);
    }

    // Verify previous hash link
    if (i > 0) {
      const previousBlock = blocks[i - 1];
      if (block.previous_hash !== previousBlock.hash) {
        errors.push(`Block ${block.id} has invalid previous hash link`);
      }
    } else if (block.previous_hash !== null) {
      errors.push(`First block ${block.id} should have null previous_hash`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Verifies a specific document's integrity
 */
export async function verifyDocument(documentId: string): Promise<{
  valid: boolean;
  block?: DocumentBlock;
  errors: string[];
}> {
  const errors: string[] = [];
  const block = await DocumentBlock.findOne({
    where: { document_id: documentId },
  });

  if (!block) {
    return {
      valid: false,
      errors: ['Document not found in blockchain'],
    };
  }

  // Verify block hash - use consistent JSON serialization
  const blockData = {
    document_id: block.document_id,
    previous_hash: block.previous_hash,
    content_hash: block.content_hash,
    signature_data: block.signature_data,
    metadata: JSON.parse(JSON.stringify(block.metadata)), // Normalize metadata
    timestamp: block.created_at.toISOString(),
  };

  const calculatedHash = calculateHash(deterministicStringify(blockData));
  if (calculatedHash !== block.hash) {
    errors.push('Block hash verification failed');
  }

  // Verify previous hash link
  if (block.previous_hash) {
    const previousBlock = await DocumentBlock.findOne({
      where: { hash: block.previous_hash },
    });

    if (!previousBlock) {
      errors.push('Previous block not found');
    }
  }

  return {
    valid: errors.length === 0,
    block,
    errors,
  };
}

/**
 * Verifies a document by its content hash (from PDF file)
 */
export async function verifyDocumentByHash(contentHash: string): Promise<{
  valid: boolean;
  block?: DocumentBlock;
  errors: string[];
}> {
  const errors: string[] = [];
  const block = await DocumentBlock.findOne({
    where: { content_hash: contentHash },
  });

  if (!block) {
    return {
      valid: false,
      errors: ['Document not found in blockchain - this PDF was not generated by DocuChain or has been modified'],
    };
  }

  // Verify block hash - use consistent JSON serialization
  const blockData = {
    document_id: block.document_id,
    previous_hash: block.previous_hash,
    content_hash: block.content_hash,
    signature_data: block.signature_data,
    metadata: JSON.parse(JSON.stringify(block.metadata)), // Normalize metadata
    timestamp: block.created_at.toISOString(),
  };

  const calculatedHash = calculateHash(deterministicStringify(blockData));
  if (calculatedHash !== block.hash) {
    errors.push('Block hash verification failed - document may have been tampered with');
  }

  // Verify previous hash link
  if (block.previous_hash) {
    const previousBlock = await DocumentBlock.findOne({
      where: { hash: block.previous_hash },
    });

    if (!previousBlock) {
      errors.push('Previous block not found - blockchain integrity compromised');
    }
  }

  return {
    valid: errors.length === 0,
    block,
    errors,
  };
}

/**
 * Gets the blockchain history
 */
export async function getBlockchainHistory(limit: number = 100): Promise<DocumentBlock[]> {
  return DocumentBlock.findAll({
    order: [['created_at', 'DESC']],
    limit,
  });
}

export { DocumentBlock };

const parseSignatureData = (data: string | null): string[] => {
  if (!data) {
    return [];
  }
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Failed to parse signature data:', error);
    return [];
  }
};

export interface AnonymizedBlock {
  sequence: number;
  block_hash: string;
  previous_hash: string | null;
  content_hash: string;
  signature_count: number;
  signature_hash: string;
  metadata_keys: string[];
  created_at: Date;
}

export async function getAnonymizedBlockchain(limit: number = 1000): Promise<AnonymizedBlock[]> {
  const blocks = await DocumentBlock.findAll({
    order: [['created_at', 'ASC']],
    limit,
  });

  return blocks.map((block, index) => {
    const signatureArray = parseSignatureData(block.signature_data);
    return {
      sequence: index + 1,
      block_hash: block.hash,
      previous_hash: block.previous_hash,
      content_hash: block.content_hash,
      signature_count: signatureArray.length,
      signature_hash: calculateHash(block.signature_data ?? ''),
      metadata_keys: Object.keys(block.metadata ?? {}),
      created_at: block.created_at,
    };
  });
}

