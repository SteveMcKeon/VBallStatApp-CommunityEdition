COPY public.teams (
  id,
  name,
  created_at,
  captain_id
)
FROM '/docker-entrypoint-initdb.d/teams_demo.csv'
WITH (FORMAT csv, HEADER true);

COPY public.games (
  id,
  title,
  video_url,
  date,
  hastimestamps,
  isscored,
  players,
  team_id, created_at
)
FROM '/docker-entrypoint-initdb.d/games_demo.csv'
WITH (FORMAT csv, HEADER true);

COPY public.stats (
  id,
  game_id,
  "timestamp",
  rally_id,
  import_seq,
  player,
  action_type,
  quality,
  result,
  notes,
  our_score,
  opp_score,
  set_to_position,
  set_to_player,
  "set",
  team_id,
  player_user_id,
  set_to_user_id
)
FROM '/docker-entrypoint-initdb.d/stats_demo.csv'
WITH (FORMAT csv, HEADER true);
