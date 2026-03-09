-- PostgreSQL schema for the countries table.
-- Run with: psql <connection> -f sql/schema.sql

create table if not exists countries (
  id bigserial primary key,
  country text not null unique,
  total_count integer not null,
  frail_count integer not null,
  non_frail_count integer not null,
  frail_percentage double precision not null,
  avg_age double precision not null,
  female_count integer not null,
  male_count integer not null,
  female_percentage double precision not null,
  male_percentage double precision not null,
  comorbidity_yes integer not null,
  comorbidity_no integer not null,
  comorbidity_percentage double precision not null,
  age_groups jsonb not null,
  health_ratings jsonb not null,
  marital_status jsonb not null,
  marriage_age_categories jsonb not null
);

create index if not exists countries_country_idx on countries (country);

create table if not exists country_frailty_factors (
  country text not null,
  rank smallint not null check (rank between 1 and 3),
  factor_name text not null,
  score double precision not null,
  accuracy double precision,
  primary key (country, rank)
);

create index if not exists country_frailty_factors_country_idx
  on country_frailty_factors (country);
