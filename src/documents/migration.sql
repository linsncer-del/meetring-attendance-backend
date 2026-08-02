-- Organization profile (single-row config for branding)
CREATE TABLE organization_profile (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            varchar(200) NOT NULL DEFAULT 'Kenya National Highways Authority',
    short_name      varchar(50) DEFAULT 'KeNHA',
    logo_url        varchar(500),
    address         text,
    phone           varchar(50),
    email           varchar(150),
    website         varchar(200),
    vision          text,
    mission         text,
    core_values     text,
    stamp_url       varchar(500),
    seal_url        varchar(500),
    watermark_url   varchar(500),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Document templates
CREATE TABLE document_templates (
    template_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            varchar(200) NOT NULL,
    description     text,
    category        varchar(50) NOT NULL DEFAULT 'attendance_register',
    is_default      boolean NOT NULL DEFAULT false,
    is_active       boolean NOT NULL DEFAULT true,
    current_version int NOT NULL DEFAULT 1,
    created_by      uuid NOT NULL REFERENCES profiles(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Template versions (immutable snapshots)
CREATE TABLE template_versions (
    version_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id     uuid NOT NULL REFERENCES document_templates(template_id) ON DELETE CASCADE,
    version_number  int NOT NULL,
    file_path       varchar(500) NOT NULL,
    file_size       int,
    metadata        jsonb,
    changelog       text,
    created_by      uuid NOT NULL REFERENCES profiles(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_template_version UNIQUE (template_id, version_number)
);

-- Organization assets (logos, stamps, seals)
CREATE TABLE organization_assets (
    asset_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            varchar(200) NOT NULL,
    asset_type      varchar(50) NOT NULL,
    file_path       varchar(500) NOT NULL,
    mime_type       varchar(100),
    file_size       int,
    uploaded_by     uuid NOT NULL REFERENCES profiles(id),
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Generated documents (audit trail)
CREATE TABLE generated_documents (
    document_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id      uuid NOT NULL REFERENCES meetings(meeting_id),
    template_id     uuid REFERENCES document_templates(template_id),
    version_used    int,
    file_path       varchar(500) NOT NULL,
    format          varchar(10) NOT NULL DEFAULT 'pdf',
    document_number varchar(50),
    generated_by    uuid NOT NULL REFERENCES profiles(id),
    generated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_templates_category ON document_templates(category);
CREATE INDEX idx_templates_active ON document_templates(is_active);
CREATE INDEX idx_template_versions_template ON template_versions(template_id);
CREATE INDEX idx_generated_docs_meeting ON generated_documents(meeting_id);
CREATE INDEX idx_org_assets_type ON organization_assets(asset_type);

-- RLS
ALTER TABLE organization_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_profile_read_auth" ON organization_profile FOR SELECT TO authenticated USING (true);
CREATE POLICY "templates_read_auth" ON document_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "template_versions_read_auth" ON template_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "org_assets_read_auth" ON organization_assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "generated_docs_read_auth" ON generated_documents FOR SELECT TO authenticated USING (true);

-- Seed default org profile
INSERT INTO organization_profile (name, short_name, address, phone, email, website, vision, mission, core_values)
VALUES (
    'Kenya National Highways Authority',
    'KeNHA',
    'Barabara Plaza, Block A & C, Jomo Kenyatta International Airport (JKIA), Off Airport South Road, along Mazao Road, P.O Box 49712 - 00100 Nairobi',
    'Tel 020 - 4954000 / 0700 423 606',
    'dg@kenha.co.ke',
    'www.kenha.co.ke',
    'A quality National Trunk Road Network to all for prosperity',
    'To develop and manage resilient, safe, and adequate National Trunk Roads for sustainable development through innovation and optimal utilization of resources',
    'Accountability, Sustainability, Innovation, Teamwork'
);
