CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) NOT NULL UNIQUE,
    template_content TEXT NOT NULL,
    placeholders JSONB NOT NULL DEFAULT '{}',
    pdf_path VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_document_id ON documents(document_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_created_at ON documents(created_at);

