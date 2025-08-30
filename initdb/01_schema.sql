CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'web_anon') THEN
    CREATE ROLE web_anon NOLOGIN;
  END IF;
END$$;

CREATE TABLE public.teams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  captain_id uuid,
  CONSTRAINT teams_pkey PRIMARY KEY (id)
);
CREATE TABLE public.team_members (
  team_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'player'::text,
  CONSTRAINT team_members_pkey PRIMARY KEY (team_id,user_id),
  CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON UPDATE NO ACTION ON DELETE NO ACTION
);
CREATE TABLE public.games (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  video_url text,
  date text NOT NULL,
  hastimestamps boolean DEFAULT false,
  isscored boolean DEFAULT false,
  players jsonb NOT NULL DEFAULT '[]'::jsonb,
  processed boolean DEFAULT false,
  team_id uuid,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT games_pkey PRIMARY KEY (id),
  CONSTRAINT games_team_fk FOREIGN KEY (team_id) REFERENCES public.teams(id) ON UPDATE CASCADE ON DELETE NO ACTION
);
CREATE TABLE public.stats (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL,
  timestamp double precision DEFAULT '0'::double precision,
  rally_id smallint NOT NULL,
  import_seq numeric NOT NULL,
  player text,
  action_type text,
  quality numeric,
  result text,
  notes text,
  our_score smallint NOT NULL,
  opp_score smallint NOT NULL,
  set_to_position text,
  set_to_player text,
  set smallint NOT NULL,
  team_id uuid,
  player_user_id uuid,
  set_to_user_id uuid,
  CONSTRAINT stats_pkey PRIMARY KEY (id),
  CONSTRAINT stats_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT stats_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON UPDATE CASCADE ON DELETE NO ACTION
);
CREATE INDEX idx_games_team_id ON public.games USING btree (team_id);
CREATE INDEX idx_stats_player_user ON public.stats USING btree (player_user_id);
CREATE INDEX idx_stats_set_to_user ON public.stats USING btree (set_to_user_id);
CREATE INDEX idx_stats_team_id ON public.stats USING btree (team_id);
CREATE INDEX idx_teams_captain_id ON public.teams USING btree (captain_id);

GRANT USAGE ON SCHEMA public TO web_anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO web_anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO web_anon;