-- FloatChat — Supabase PostGIS Database Initialization Schema
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- 1. Enable PostGIS Extension for Spatial Bounding Box & Geodesic Queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. ARGO Float Catalog Table
CREATE TABLE IF NOT EXISTS argo_floats (
    id BIGSERIAL PRIMARY KEY,
    float_id INT NOT NULL,
    cycle INT NOT NULL,
    time_utc TIMESTAMPTZ NOT NULL,
    location GEOGRAPHY(Point, 4326) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    data_mode VARCHAR(10) DEFAULT 'D',
    accepted_levels INT DEFAULT 0,
    total_levels INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_float_cycle UNIQUE (float_id, cycle)
);

-- Index for Spatial Bounding Box Queries (PostGIS GIST Index)
CREATE INDEX IF NOT EXISTS idx_argo_location ON argo_floats USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_argo_float_id ON argo_floats (float_id);

-- 3. Natural Language Query Execution History Log
CREATE TABLE IF NOT EXISTS query_logs (
    id BIGSERIAL PRIMARY KEY,
    user_query TEXT NOT NULL,
    tool_name VARCHAR(100),
    sql_executed TEXT,
    execution_time_ms DOUBLE PRECISION,
    result_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. User Saved Profile Selections
CREATE TABLE IF NOT EXISTS saved_profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID,
    float_id INT NOT NULL,
    cycle INT NOT NULL,
    dataset_name VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comment
COMMENT ON TABLE argo_floats IS 'ARGO Autonomous Float Observatory Profile Catalog with PostGIS GIS Indexing';
