# MMR, rank estimates, and data sources

## Local match feed

The connector reads Rocket League Stats API events from `127.0.0.1:49123` by
default. The TCP stream may contain consecutive JSON objects without line
delimiters; RocketStats frames objects across chunks and also accepts the
legacy newline-delimited adapter format.

The feed can provide match state, scores, clock/overtime, goals, demos, saves,
crossbar hits, pauses, and results. An active match that disappears without a
result is recorded as a provisional early-leave loss. A later Ranked Reconnect
result replaces that provisional outcome.

The Stats API does not publish MMR, matchmaking search duration, or ban
countdowns.

## MMR source and limitations

On Windows, RocketStats reads Rocket League's local `Launch.log` in read-only
mode. It uses solo ranked queue reservations and recognizes 1v1, 2v2, 3v3,
4v4 Quads, Hoops, Rumble, Dropshot, Snow Day, and Heatseeker.

The log's observed skill value is converted with the community-observed formula
`skill × 20 + 100`; this is not documented by Psyonix. Party queues and
multi-playlist queues are excluded when the local player's MMR cannot be
identified reliably. Casual MMR is not available from this source.

The queued value appears after the next match is loaded and reflects the rating
after the preceding match. A rating change from the last match of a session is
not available until another queue. On macOS, set `RL_LOG_PATH` explicitly.

Verified game identity takes precedence. Manual-name fallback is accepted only
when exactly one player matches and no verified account is available; that
attribution remains marked unverified.

## Rank and division estimates

Rank estimates use the local
[`rank-distributions.json`](../com.rocketstats.livestats.sdPlugin/data/rank-distributions.json)
table, based on community-listed ranges from
[Tracker Network](https://rocketleague.tracker.network/rocket-league/distribution?playlist=11).
The table includes capture dates and source URLs for supported playlists.

These are not official promotion or demotion thresholds. The Stats API does not
expose the real division, and promotion buffers can make the game's displayed
division differ. A `~` marks an approximate division; missing or ambiguous
intervals may show `DIV ?`.

To update the table, verify each playlist on the source site, preserve listed
overlaps and gaps, update the capture date/source URL, then run `npm test`.
No player profiles are queried, and no web connection is needed while playing.
