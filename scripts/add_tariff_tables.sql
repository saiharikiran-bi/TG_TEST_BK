-- Add refresh_tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    userId INTEGER NOT NULL,
    token TEXT NOT NULL,
    expiresAt TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    createdAt TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updatedAt TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Add tariff table
CREATE TABLE IF NOT EXISTS tariff (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL,
    category INTEGER NOT NULL,
    tariff_name TEXT NOT NULL,
    type TEXT NOT NULL,
    device TEXT NOT NULL,
    min_demand INTEGER,
    min_demand_unit_rate DOUBLE PRECISION,
    min_demand_excess_unit_rate DOUBLE PRECISION,
    base_unit_rate DOUBLE PRECISION NOT NULL,
    elec_duty_unit_rate DOUBLE PRECISION,
    ims DOUBLE PRECISION,
    gst DOUBLE PRECISION,
    valid_from TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    valid_to TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Add tariff_slabs table
CREATE TABLE IF NOT EXISTS tariff_slabs (
    id SERIAL PRIMARY KEY,
    tariff_id INTEGER NOT NULL,
    slab_order INTEGER NOT NULL,
    unit_limit INTEGER NOT NULL,
    unit_rate DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_tariff_slabs_tariff FOREIGN KEY (tariff_id) REFERENCES tariff(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_userId ON refresh_tokens(userId);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_tariff_client_id ON tariff(client_id);
CREATE INDEX IF NOT EXISTS idx_tariff_category ON tariff(category);
CREATE INDEX IF NOT EXISTS idx_tariff_valid_from ON tariff(valid_from);
CREATE INDEX IF NOT EXISTS idx_tariff_slabs_tariff_id ON tariff_slabs(tariff_id);
CREATE INDEX IF NOT EXISTS idx_tariff_slabs_slab_order ON tariff_slabs(slab_order);

-- Add comments for documentation
COMMENT ON TABLE refresh_tokens IS 'Refresh tokens for user authentication and session management';
COMMENT ON TABLE tariff IS 'Tariff configuration table for different consumer categories';
COMMENT ON TABLE tariff_slabs IS 'Tariff slabs for consumption-based pricing';
COMMENT ON COLUMN refresh_tokens.userId IS 'User ID reference';
COMMENT ON COLUMN refresh_tokens.token IS 'Refresh token string';
COMMENT ON COLUMN refresh_tokens.expiresAt IS 'Token expiration timestamp';
COMMENT ON COLUMN refresh_tokens.createdAt IS 'Token creation timestamp';
COMMENT ON COLUMN refresh_tokens.updatedAt IS 'Token last update timestamp';
COMMENT ON COLUMN tariff.client_id IS 'Client identifier';
COMMENT ON COLUMN tariff.category IS 'Consumer category';
COMMENT ON COLUMN tariff.tariff_name IS 'Name of the tariff';
COMMENT ON COLUMN tariff.type IS 'Type of tariff (e.g., residential, commercial, industrial)';
COMMENT ON COLUMN tariff.device IS 'Device type (e.g., single phase, three phase)';
COMMENT ON COLUMN tariff.min_demand IS 'Minimum demand in kW';
COMMENT ON COLUMN tariff.min_demand_unit_rate IS 'Unit rate for minimum demand';
COMMENT ON COLUMN tariff.min_demand_excess_unit_rate IS 'Unit rate for excess demand';
COMMENT ON COLUMN tariff.base_unit_rate IS 'Base unit rate per kWh';
COMMENT ON COLUMN tariff.elec_duty_unit_rate IS 'Electricity duty rate';
COMMENT ON COLUMN tariff.ims IS 'IMS rate';
COMMENT ON COLUMN tariff.gst IS 'GST rate';
COMMENT ON COLUMN tariff.valid_from IS 'Tariff validity start date';
COMMENT ON COLUMN tariff.valid_to IS 'Tariff validity end date';
COMMENT ON COLUMN tariff_slabs.tariff_id IS 'Reference to tariff table';
COMMENT ON COLUMN tariff_slabs.slab_order IS 'Order of the slab';
COMMENT ON COLUMN tariff_slabs.unit_limit IS 'Upper limit for this slab';
COMMENT ON COLUMN tariff_slabs.unit_rate IS 'Unit rate for this slab';
