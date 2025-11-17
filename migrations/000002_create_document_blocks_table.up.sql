CREATE TABLE document_blocks (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) NOT NULL UNIQUE,
    previous_hash VARCHAR(255),
    hash VARCHAR(255) NOT NULL UNIQUE,
    content_hash VARCHAR(255) NOT NULL,
    signature_data TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_document_blocks_document_id ON document_blocks(document_id);
CREATE INDEX idx_document_blocks_hash ON document_blocks(hash);
CREATE INDEX idx_document_blocks_previous_hash ON document_blocks(previous_hash);
CREATE INDEX idx_document_blocks_created_at ON document_blocks(created_at);

