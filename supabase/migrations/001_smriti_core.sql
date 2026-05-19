-- Smriti core tables — run in Supabase SQL editor or via CLI migrations

create extension if not exists "pgcrypto";

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  age int,
  locale text default 'hi',
  phone text,
  created_at timestamptz default now()
);

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  symptoms_hindi text not null,
  doctor_name text,
  bp_sys int,
  bp_dia int,
  medicines text,
  created_at timestamptz default now()
);

create table if not exists public.sigma_store (
  patient_id uuid primary key references public.patients (id) on delete cascade,
  sigma_b64 text not null,
  dim int not null default 64,
  updated_at timestamptz default now()
);

create index if not exists visits_patient_created_idx
  on public.visits (patient_id, created_at desc);

alter table public.patients enable row level security;
alter table public.visits enable row level security;
alter table public.sigma_store enable row level security;

-- Policies: tighten per auth.uid() when Supabase Auth is wired
