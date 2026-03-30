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

create table if not exists participants (
  id bigserial primary key,
  external_participant_id text not null unique,
  name text,
  age integer not null check (age between 0 and 120),
  gender text not null,
  country text not null,
  state_region text not null,
  city text,
  socioeconomic jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists participants_country_idx on participants (country);

create table if not exists assessment_submissions (
  id bigserial primary key,
  participant_id bigint not null references participants(id) on delete cascade,
  ip_address text,
  assessment_type text not null,
  total_score double precision,
  max_score double precision,
  normalized_score double precision,
  result_label text,
  answers jsonb not null,
  metadata jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now()
);

create index if not exists assessment_submissions_participant_idx on assessment_submissions (participant_id);
create index if not exists assessment_submissions_ip_idx on assessment_submissions (ip_address);
create index if not exists assessment_submissions_type_idx on assessment_submissions (assessment_type);
create unique index if not exists assessment_submissions_unique_participant_type_idx
  on assessment_submissions (participant_id, assessment_type);
create unique index if not exists assessment_submissions_unique_ip_type_idx
  on assessment_submissions (ip_address, assessment_type)
  where ip_address is not null;
