create table if not exists public.course_resources (
  id uuid primary key,
  created_at timestamptz not null,
  resource jsonb not null
);

alter table public.course_resources enable row level security;

grant all on table public.course_resources to service_role;
