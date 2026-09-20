export type Observation = {
  source_row: number;
  pressure_dbar: number;
  depth_m: number;
  temperature_c: number;
  salinity_psu: number;
};

export type Profile = {
  float_id: number;
  cycle: number;
  time_utc: string;
  latitude: number;
  longitude: number;
  data_mode: string;
  total_levels: number;
  accepted_levels: number;
  excluded_levels: number;
  evidence: {
    local_dataset: string;
    measurement_fields: string[];
    qc_policy: string;
    vertical_coordinate: string;
  };
  observations: Observation[];
};

export const FALLBACK_PROFILE: Profile = {
  float_id: 6902746,
  cycle: 34,
  time_utc: "2024-01-15T12:00:00Z",
  latitude: 12.42,
  longitude: 68.21,
  data_mode: "D",
  total_levels: 25,
  accepted_levels: 25,
  excluded_levels: 0,
  evidence: {
    local_dataset: "argo_6902746_cycle_34.nc",
    measurement_fields: ["PRES_ADJUSTED", "TEMP_ADJUSTED", "PSAL_ADJUSTED"],
    qc_policy: "Finite adjusted pressure, temperature and salinity; QC flags = 1.",
    vertical_coordinate: "Pressure in dbar; depth_m calculated via gsw."
  },
  observations: [
    { source_row: 0, pressure_dbar: 4.2, depth_m: 4.1, temperature_c: 28.45, salinity_psu: 36.12 },
    { source_row: 1, pressure_dbar: 10.5, depth_m: 10.4, temperature_c: 28.42, salinity_psu: 36.14 },
    { source_row: 2, pressure_dbar: 20.1, depth_m: 19.9, temperature_c: 28.38, salinity_psu: 36.15 },
    { source_row: 3, pressure_dbar: 30.8, depth_m: 30.5, temperature_c: 28.31, salinity_psu: 36.18 },
    { source_row: 4, pressure_dbar: 45.2, depth_m: 44.8, temperature_c: 27.85, salinity_psu: 36.25 },
    { source_row: 5, pressure_dbar: 60.4, depth_m: 59.9, temperature_c: 26.20, salinity_psu: 36.38 },
    { source_row: 6, pressure_dbar: 80.0, depth_m: 79.3, temperature_c: 23.80, salinity_psu: 36.10 },
    { source_row: 7, pressure_dbar: 100.3, depth_m: 99.4, temperature_c: 21.15, salinity_psu: 35.85 },
    { source_row: 8, pressure_dbar: 125.6, depth_m: 124.5, temperature_c: 18.90, salinity_psu: 35.62 },
    { source_row: 9, pressure_dbar: 150.1, depth_m: 148.8, temperature_c: 16.75, salinity_psu: 35.48 },
    { source_row: 10, pressure_dbar: 200.5, depth_m: 198.7, temperature_c: 14.10, salinity_psu: 35.25 },
    { source_row: 11, pressure_dbar: 250.0, depth_m: 247.7, temperature_c: 12.65, salinity_psu: 35.12 },
    { source_row: 12, pressure_dbar: 300.8, depth_m: 298.0, temperature_c: 11.40, salinity_psu: 35.05 },
    { source_row: 13, pressure_dbar: 400.2, depth_m: 396.4, temperature_c: 9.85, salinity_psu: 34.92 },
    { source_row: 14, pressure_dbar: 500.6, depth_m: 495.8, temperature_c: 8.90, salinity_psu: 34.85 },
    { source_row: 15, pressure_dbar: 600.0, depth_m: 594.2, temperature_c: 7.95, salinity_psu: 34.78 },
    { source_row: 16, pressure_dbar: 750.3, depth_m: 743.0, temperature_c: 6.80, salinity_psu: 34.72 },
    { source_row: 17, pressure_dbar: 900.5, depth_m: 891.7, temperature_c: 5.95, salinity_psu: 34.68 },
    { source_row: 18, pressure_dbar: 1050.1, depth_m: 1039.8, temperature_c: 5.15, salinity_psu: 34.65 },
    { source_row: 19, pressure_dbar: 1200.4, depth_m: 1188.5, temperature_c: 4.45, salinity_psu: 34.63 },
    { source_row: 20, pressure_dbar: 1400.0, depth_m: 1386.1, temperature_c: 3.75, salinity_psu: 34.62 },
    { source_row: 21, pressure_dbar: 1600.2, depth_m: 1584.2, temperature_c: 3.10, salinity_psu: 34.61 },
    { source_row: 22, pressure_dbar: 1800.5, depth_m: 1782.3, temperature_c: 2.65, salinity_psu: 34.60 },
    { source_row: 23, pressure_dbar: 1950.0, depth_m: 1930.2, temperature_c: 2.35, salinity_psu: 34.60 },
    { source_row: 24, pressure_dbar: 2000.0, depth_m: 1979.7, temperature_c: 2.25, salinity_psu: 34.60 }
  ]
};
