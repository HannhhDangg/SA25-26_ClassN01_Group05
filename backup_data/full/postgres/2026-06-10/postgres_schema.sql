--
-- PostgreSQL database dump
--

-- Dumped from database version 15.2 (Ubuntu 15.2-1.pgdg22.04+1)
-- Dumped by pg_dump version 15.2 (Ubuntu 15.2-1.pgdg22.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


--
-- Name: pg_cron; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA public;


--
-- Name: EXTENSION pg_cron; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL';


--
-- Name: metric_helpers; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA metric_helpers;


ALTER SCHEMA metric_helpers OWNER TO postgres;

--
-- Name: user_management; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA user_management;


ALTER SCHEMA user_management OWNER TO postgres;

--
-- Name: zmon_utils; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA zmon_utils;


ALTER SCHEMA zmon_utils OWNER TO postgres;

--
-- Name: plpython3u; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS plpython3u WITH SCHEMA pg_catalog;


--
-- Name: EXTENSION plpython3u; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION plpython3u IS 'PL/Python3U untrusted procedural language';


--
-- Name: file_fdw; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS file_fdw WITH SCHEMA public;


--
-- Name: EXTENSION file_fdw; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION file_fdw IS 'foreign-data wrapper for flat file access';


--
-- Name: pg_auth_mon; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_auth_mon WITH SCHEMA public;


--
-- Name: EXTENSION pg_auth_mon; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_auth_mon IS 'monitor connection attempts per user';


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pg_stat_kcache; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_kcache WITH SCHEMA public;


--
-- Name: EXTENSION pg_stat_kcache; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_stat_kcache IS 'Kernel statistics gathering';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: set_user; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS set_user WITH SCHEMA public;


--
-- Name: EXTENSION set_user; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION set_user IS 'similar to SET ROLE but with added logging';


--
-- Name: system_information; Type: TYPE; Schema: zmon_utils; Owner: postgres
--

CREATE TYPE zmon_utils.system_information AS (
	parameter text,
	setting text
);


ALTER TYPE zmon_utils.system_information OWNER TO postgres;

--
-- Name: schedule_in_database(text, text, text); Type: FUNCTION; Schema: cron; Owner: postgres
--

CREATE FUNCTION cron.schedule_in_database(p_schedule text, p_database text, p_command text) RETURNS bigint
    LANGUAGE plpgsql
    AS $$
DECLARE
    l_jobid bigint;
BEGIN
    IF NOT (SELECT rolcanlogin FROM pg_roles WHERE rolname = current_user)
    THEN RAISE 'You cannot create a job using a role that cannot log in';
    END IF;

    SELECT schedule INTO l_jobid FROM cron.schedule(p_schedule, p_command);
    UPDATE cron.job SET database = p_database, nodename = '' WHERE jobid = l_jobid;
    RETURN l_jobid;
END;
$$;


ALTER FUNCTION cron.schedule_in_database(p_schedule text, p_database text, p_command text) OWNER TO postgres;

--
-- Name: get_btree_bloat_approx(); Type: FUNCTION; Schema: metric_helpers; Owner: postgres
--

CREATE FUNCTION metric_helpers.get_btree_bloat_approx(OUT i_database name, OUT i_schema_name name, OUT i_table_name name, OUT i_index_name name, OUT i_real_size numeric, OUT i_extra_size numeric, OUT i_extra_ratio double precision, OUT i_fill_factor integer, OUT i_bloat_size double precision, OUT i_bloat_ratio double precision, OUT i_is_na boolean) RETURNS SETOF record
    LANGUAGE sql IMMUTABLE STRICT SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
SELECT current_database(), nspname AS schemaname, tblname, idxname, bs*(relpages)::bigint AS real_size,
  bs*(relpages-est_pages)::bigint AS extra_size,
  100 * (relpages-est_pages)::float / relpages AS extra_ratio,
  fillfactor,
  CASE WHEN relpages > est_pages_ff
    THEN bs*(relpages-est_pages_ff)
    ELSE 0
  END AS bloat_size,
  100 * (relpages-est_pages_ff)::float / relpages AS bloat_ratio,
  is_na
  -- , 100-(pst).avg_leaf_density AS pst_avg_bloat, est_pages, index_tuple_hdr_bm, maxalign, pagehdr, nulldatawidth, nulldatahdrwidth, reltuples, relpages -- (DEBUG INFO)
FROM (
  SELECT coalesce(1 +
         ceil(reltuples/floor((bs-pageopqdata-pagehdr)/(4+nulldatahdrwidth)::float)), 0 -- ItemIdData size + computed avg size of a tuple (nulldatahdrwidth)
      ) AS est_pages,
      coalesce(1 +
         ceil(reltuples/floor((bs-pageopqdata-pagehdr)*fillfactor/(100*(4+nulldatahdrwidth)::float))), 0
      ) AS est_pages_ff,
      bs, nspname, tblname, idxname, relpages, fillfactor, is_na
      -- , pgstatindex(idxoid) AS pst, index_tuple_hdr_bm, maxalign, pagehdr, nulldatawidth, nulldatahdrwidth, reltuples -- (DEBUG INFO)
  FROM (
      SELECT maxalign, bs, nspname, tblname, idxname, reltuples, relpages, idxoid, fillfactor,
            ( index_tuple_hdr_bm +
                maxalign - CASE -- Add padding to the index tuple header to align on MAXALIGN
                  WHEN index_tuple_hdr_bm%maxalign = 0 THEN maxalign
                  ELSE index_tuple_hdr_bm%maxalign
                END
              + nulldatawidth + maxalign - CASE -- Add padding to the data to align on MAXALIGN
                  WHEN nulldatawidth = 0 THEN 0
                  WHEN nulldatawidth::integer%maxalign = 0 THEN maxalign
                  ELSE nulldatawidth::integer%maxalign
                END
            )::numeric AS nulldatahdrwidth, pagehdr, pageopqdata, is_na
            -- , index_tuple_hdr_bm, nulldatawidth -- (DEBUG INFO)
      FROM (
          SELECT n.nspname, ct.relname AS tblname, i.idxname, i.reltuples, i.relpages,
              i.idxoid, i.fillfactor, current_setting('block_size')::numeric AS bs,
              CASE -- MAXALIGN: 4 on 32bits, 8 on 64bits (and mingw32 ?)
                WHEN version() ~ 'mingw32' OR version() ~ '64-bit|x86_64|ppc64|ia64|amd64' THEN 8
                ELSE 4
              END AS maxalign,
              /* per page header, fixed size: 20 for 7.X, 24 for others */
              24 AS pagehdr,
              /* per page btree opaque data */
              16 AS pageopqdata,
              /* per tuple header: add IndexAttributeBitMapData if some cols are null-able */
              CASE WHEN max(coalesce(s.stanullfrac,0)) = 0
                  THEN 2 -- IndexTupleData size
                  ELSE 2 + (( 32 + 8 - 1 ) / 8) -- IndexTupleData size + IndexAttributeBitMapData size ( max num filed per index + 8 - 1 /8)
              END AS index_tuple_hdr_bm,
              /* data len: we remove null values save space using it fractionnal part from stats */
              sum( (1-coalesce(s.stanullfrac, 0)) * coalesce(s.stawidth, 1024)) AS nulldatawidth,
              max( CASE WHEN a.atttypid = 'pg_catalog.name'::regtype THEN 1 ELSE 0 END ) > 0 AS is_na
          FROM (
              SELECT idxname, reltuples, relpages, tbloid, idxoid, fillfactor,
                  CASE WHEN indkey[i]=0 THEN idxoid ELSE tbloid END AS att_rel,
                  CASE WHEN indkey[i]=0 THEN i ELSE indkey[i] END AS att_pos
              FROM (
                  SELECT idxname, reltuples, relpages, tbloid, idxoid, fillfactor, indkey, generate_series(1,indnatts) AS i
                  FROM (
                      SELECT ci.relname AS idxname, ci.reltuples, ci.relpages, i.indrelid AS tbloid,
                          i.indexrelid AS idxoid,
                          coalesce(substring(
                              array_to_string(ci.reloptions, ' ')
                              from 'fillfactor=([0-9]+)')::smallint, 90) AS fillfactor,
                          i.indnatts,
                          string_to_array(textin(int2vectorout(i.indkey)),' ')::int[] AS indkey
                      FROM pg_index i
                      JOIN pg_class ci ON ci.oid=i.indexrelid
                      WHERE ci.relam=(SELECT oid FROM pg_am WHERE amname = 'btree')
                        AND ci.relpages > 0
                  ) AS idx_data
              ) AS idx_data_cross
          ) i
          JOIN pg_attribute a ON a.attrelid = i.att_rel
                             AND a.attnum = i.att_pos
          JOIN pg_statistic s ON s.starelid = i.att_rel
                             AND s.staattnum = i.att_pos
          JOIN pg_class ct ON ct.oid = i.tbloid
          JOIN pg_namespace n ON ct.relnamespace = n.oid
          GROUP BY 1,2,3,4,5,6,7,8,9,10
      ) AS rows_data_stats
  ) AS rows_hdr_pdg_stats
) AS relation_stats;
$$;


ALTER FUNCTION metric_helpers.get_btree_bloat_approx(OUT i_database name, OUT i_schema_name name, OUT i_table_name name, OUT i_index_name name, OUT i_real_size numeric, OUT i_extra_size numeric, OUT i_extra_ratio double precision, OUT i_fill_factor integer, OUT i_bloat_size double precision, OUT i_bloat_ratio double precision, OUT i_is_na boolean) OWNER TO postgres;

--
-- Name: get_table_bloat_approx(); Type: FUNCTION; Schema: metric_helpers; Owner: postgres
--

CREATE FUNCTION metric_helpers.get_table_bloat_approx(OUT t_database name, OUT t_schema_name name, OUT t_table_name name, OUT t_real_size numeric, OUT t_extra_size double precision, OUT t_extra_ratio double precision, OUT t_fill_factor integer, OUT t_bloat_size double precision, OUT t_bloat_ratio double precision, OUT t_is_na boolean) RETURNS SETOF record
    LANGUAGE sql IMMUTABLE STRICT SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
SELECT
  current_database(),
  schemaname,
  tblname,
  (bs*tblpages) AS real_size,
  ((tblpages-est_tblpages)*bs) AS extra_size,
  CASE WHEN tblpages - est_tblpages > 0
    THEN 100 * (tblpages - est_tblpages)/tblpages::float
    ELSE 0
  END AS extra_ratio,
  fillfactor,
  CASE WHEN tblpages - est_tblpages_ff > 0
    THEN (tblpages-est_tblpages_ff)*bs
    ELSE 0
  END AS bloat_size,
  CASE WHEN tblpages - est_tblpages_ff > 0
    THEN 100 * (tblpages - est_tblpages_ff)/tblpages::float
    ELSE 0
  END AS bloat_ratio,
  is_na
FROM (
  SELECT ceil( reltuples / ( (bs-page_hdr)/tpl_size ) ) + ceil( toasttuples / 4 ) AS est_tblpages,
    ceil( reltuples / ( (bs-page_hdr)*fillfactor/(tpl_size*100) ) ) + ceil( toasttuples / 4 ) AS est_tblpages_ff,
    tblpages, fillfactor, bs, tblid, schemaname, tblname, heappages, toastpages, is_na
    -- , tpl_hdr_size, tpl_data_size, pgstattuple(tblid) AS pst -- (DEBUG INFO)
  FROM (
    SELECT
      ( 4 + tpl_hdr_size + tpl_data_size + (2*ma)
        - CASE WHEN tpl_hdr_size%ma = 0 THEN ma ELSE tpl_hdr_size%ma END
        - CASE WHEN ceil(tpl_data_size)::int%ma = 0 THEN ma ELSE ceil(tpl_data_size)::int%ma END
      ) AS tpl_size, bs - page_hdr AS size_per_block, (heappages + toastpages) AS tblpages, heappages,
      toastpages, reltuples, toasttuples, bs, page_hdr, tblid, schemaname, tblname, fillfactor, is_na
      -- , tpl_hdr_size, tpl_data_size
    FROM (
      SELECT
        tbl.oid AS tblid, ns.nspname AS schemaname, tbl.relname AS tblname, tbl.reltuples,
        tbl.relpages AS heappages, coalesce(toast.relpages, 0) AS toastpages,
        coalesce(toast.reltuples, 0) AS toasttuples,
        coalesce(substring(
          array_to_string(tbl.reloptions, ' ')
          FROM 'fillfactor=([0-9]+)')::smallint, 100) AS fillfactor,
        current_setting('block_size')::numeric AS bs,
        CASE WHEN version()~'mingw32' OR version()~'64-bit|x86_64|ppc64|ia64|amd64' THEN 8 ELSE 4 END AS ma,
        24 AS page_hdr,
        23 + CASE WHEN MAX(coalesce(s.null_frac,0)) > 0 THEN ( 7 + count(s.attname) ) / 8 ELSE 0::int END
           + CASE WHEN bool_or(att.attname = 'oid' and att.attnum < 0) THEN 4 ELSE 0 END AS tpl_hdr_size,
        sum( (1-coalesce(s.null_frac, 0)) * coalesce(s.avg_width, 0) ) AS tpl_data_size,
        bool_or(att.atttypid = 'pg_catalog.name'::regtype)
          OR sum(CASE WHEN att.attnum > 0 THEN 1 ELSE 0 END) <> count(s.attname) AS is_na
      FROM pg_attribute AS att
        JOIN pg_class AS tbl ON att.attrelid = tbl.oid
        JOIN pg_namespace AS ns ON ns.oid = tbl.relnamespace
        LEFT JOIN pg_stats AS s ON s.schemaname=ns.nspname
          AND s.tablename = tbl.relname AND s.inherited=false AND s.attname=att.attname
        LEFT JOIN pg_class AS toast ON tbl.reltoastrelid = toast.oid
      WHERE NOT att.attisdropped
        AND tbl.relkind = 'r'
      GROUP BY 1,2,3,4,5,6,7,8,9,10
      ORDER BY 2,3
    ) AS s
  ) AS s2
) AS s3 WHERE schemaname NOT LIKE 'information_schema';
$$;


ALTER FUNCTION metric_helpers.get_table_bloat_approx(OUT t_database name, OUT t_schema_name name, OUT t_table_name name, OUT t_real_size numeric, OUT t_extra_size double precision, OUT t_extra_ratio double precision, OUT t_fill_factor integer, OUT t_bloat_size double precision, OUT t_bloat_ratio double precision, OUT t_is_na boolean) OWNER TO postgres;

--
-- Name: pg_stat_statements(boolean); Type: FUNCTION; Schema: metric_helpers; Owner: postgres
--

CREATE FUNCTION metric_helpers.pg_stat_statements(showtext boolean) RETURNS SETOF public.pg_stat_statements
    LANGUAGE sql IMMUTABLE STRICT SECURITY DEFINER
    AS $$
  SELECT * FROM public.pg_stat_statements(showtext);
$$;


ALTER FUNCTION metric_helpers.pg_stat_statements(showtext boolean) OWNER TO postgres;

--
-- Name: create_application_user(text); Type: FUNCTION; Schema: user_management; Owner: postgres
--

CREATE FUNCTION user_management.create_application_user(username text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $_$
DECLARE
    pw text;
BEGIN
    SELECT user_management.random_password(20) INTO pw;
    EXECUTE format($$ CREATE USER %I WITH PASSWORD %L $$, username, pw);
    RETURN pw;
END
$_$;


ALTER FUNCTION user_management.create_application_user(username text) OWNER TO postgres;

--
-- Name: FUNCTION create_application_user(username text); Type: COMMENT; Schema: user_management; Owner: postgres
--

COMMENT ON FUNCTION user_management.create_application_user(username text) IS 'Creates a user that can login, sets the password to a strong random one,
which is then returned';


--
-- Name: create_application_user_or_change_password(text, text); Type: FUNCTION; Schema: user_management; Owner: postgres
--

CREATE FUNCTION user_management.create_application_user_or_change_password(username text, password text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $_$
BEGIN
    PERFORM 1 FROM pg_roles WHERE rolname = username;

    IF FOUND
    THEN
        EXECUTE format($$ ALTER ROLE %I WITH PASSWORD %L $$, username, password);
    ELSE
        EXECUTE format($$ CREATE USER %I WITH PASSWORD %L $$, username, password);
    END IF;
END
$_$;


ALTER FUNCTION user_management.create_application_user_or_change_password(username text, password text) OWNER TO postgres;

--
-- Name: FUNCTION create_application_user_or_change_password(username text, password text); Type: COMMENT; Schema: user_management; Owner: postgres
--

COMMENT ON FUNCTION user_management.create_application_user_or_change_password(username text, password text) IS 'USE THIS ONLY IN EMERGENCY!  The password will appear in the DB logs.
Creates a user that can login, sets the password to the one provided.
If the user already exists, sets its password.';


--
-- Name: create_role(text); Type: FUNCTION; Schema: user_management; Owner: postgres
--

CREATE FUNCTION user_management.create_role(rolename text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $_$
BEGIN
    -- set ADMIN to the admin user, so every member of admin can GRANT these roles to each other
    EXECUTE format($$ CREATE ROLE %I WITH ADMIN admin $$, rolename);
END;
$_$;


ALTER FUNCTION user_management.create_role(rolename text) OWNER TO postgres;

--
-- Name: FUNCTION create_role(rolename text); Type: COMMENT; Schema: user_management; Owner: postgres
--

COMMENT ON FUNCTION user_management.create_role(rolename text) IS 'Creates a role that cannot log in, but can be used to set up fine-grained privileges';


--
-- Name: create_user(text); Type: FUNCTION; Schema: user_management; Owner: postgres
--

CREATE FUNCTION user_management.create_user(username text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $_$
BEGIN
    EXECUTE format($$ CREATE USER %I IN ROLE zalandos, admin $$, username);
    EXECUTE format($$ ALTER ROLE %I SET log_statement TO 'all' $$, username);
END;
$_$;


ALTER FUNCTION user_management.create_user(username text) OWNER TO postgres;

--
-- Name: FUNCTION create_user(username text); Type: COMMENT; Schema: user_management; Owner: postgres
--

COMMENT ON FUNCTION user_management.create_user(username text) IS 'Creates a user that is supposed to be a human, to be authenticated without a password';


--
-- Name: drop_role(text); Type: FUNCTION; Schema: user_management; Owner: postgres
--

CREATE FUNCTION user_management.drop_role(username text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
SELECT user_management.drop_user(username);
$$;


ALTER FUNCTION user_management.drop_role(username text) OWNER TO postgres;

--
-- Name: FUNCTION drop_role(username text); Type: COMMENT; Schema: user_management; Owner: postgres
--

COMMENT ON FUNCTION user_management.drop_role(username text) IS 'Drop a human or application user.  Intended for cleanup (either after team changes or mistakes in role setup).
Roles (= users) that own database objects cannot be dropped.';


--
-- Name: drop_user(text); Type: FUNCTION; Schema: user_management; Owner: postgres
--

CREATE FUNCTION user_management.drop_user(username text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $_$
BEGIN
    EXECUTE format($$ DROP ROLE %I $$, username);
END
$_$;


ALTER FUNCTION user_management.drop_user(username text) OWNER TO postgres;

--
-- Name: FUNCTION drop_user(username text); Type: COMMENT; Schema: user_management; Owner: postgres
--

COMMENT ON FUNCTION user_management.drop_user(username text) IS 'Drop a human or application user.  Intended for cleanup (either after team changes or mistakes in role setup).
Roles (= users) that own database objects cannot be dropped.';


--
-- Name: random_password(integer); Type: FUNCTION; Schema: user_management; Owner: postgres
--

CREATE FUNCTION user_management.random_password(length integer) RETURNS text
    LANGUAGE sql
    SET search_path TO 'pg_catalog'
    AS $$
WITH chars (c) AS (
    SELECT chr(33)
    UNION ALL
    SELECT chr(i) FROM generate_series (35, 38) AS t (i)
    UNION ALL
    SELECT chr(i) FROM generate_series (42, 90) AS t (i)
    UNION ALL
    SELECT chr(i) FROM generate_series (97, 122) AS t (i)
),
bricks (b) AS (
    -- build a pool of chars (the size will be the number of chars above times length)
    -- and shuffle it
    SELECT c FROM chars, generate_series(1, length) ORDER BY random()
)
SELECT substr(string_agg(b, ''), 1, length) FROM bricks;
$$;


ALTER FUNCTION user_management.random_password(length integer) OWNER TO postgres;

--
-- Name: revoke_admin(text); Type: FUNCTION; Schema: user_management; Owner: postgres
--

CREATE FUNCTION user_management.revoke_admin(username text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $_$
BEGIN
    EXECUTE format($$ REVOKE admin FROM %I $$, username);
END
$_$;


ALTER FUNCTION user_management.revoke_admin(username text) OWNER TO postgres;

--
-- Name: FUNCTION revoke_admin(username text); Type: COMMENT; Schema: user_management; Owner: postgres
--

COMMENT ON FUNCTION user_management.revoke_admin(username text) IS 'Use this function to make a human user less privileged,
ie. when you want to grant someone read privileges only';


--
-- Name: terminate_backend(integer); Type: FUNCTION; Schema: user_management; Owner: postgres
--

CREATE FUNCTION user_management.terminate_backend(pid integer) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
SELECT pg_terminate_backend(pid);
$$;


ALTER FUNCTION user_management.terminate_backend(pid integer) OWNER TO postgres;

--
-- Name: FUNCTION terminate_backend(pid integer); Type: COMMENT; Schema: user_management; Owner: postgres
--

COMMENT ON FUNCTION user_management.terminate_backend(pid integer) IS 'When there is a process causing harm, you can kill it using this function.  Get the pid from pg_stat_activity
(be careful to match the user name (usename) and the query, in order not to kill innocent kittens) and pass it to terminate_backend()';


--
-- Name: get_database_cluster_information(); Type: FUNCTION; Schema: zmon_utils; Owner: postgres
--

CREATE FUNCTION zmon_utils.get_database_cluster_information() RETURNS TABLE(parameter text, setting text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $_$
DECLARE
   wal_segment          BIGINT;
   wal_offset           BIGINT;
   wal_multiplier       BIGINT;
   wal_delay_seconds    BIGINT;
   in_recovery          BOOLEAN;
   xlog_location_string TEXT;
   receive_location     TEXT;
   server_version_num   INTEGER;
   nosync               INTEGER;
BEGIN
  server_version_num := current_setting('server_version_num')::integer;
  SELECT pg_is_in_recovery() INTO in_recovery;
  IF server_version_num >= 100000
  THEN
    SELECT CASE WHEN in_recovery THEN pg_last_wal_replay_lsn()
           ELSE pg_current_wal_lsn()
           END INTO xlog_location_string;
    SELECT pg_last_wal_receive_lsn() INTO receive_location;
  ELSE
    SELECT CASE WHEN in_recovery THEN pg_last_xlog_replay_location()
           ELSE pg_current_xlog_location()
           END INTO xlog_location_string;
    SELECT pg_last_xlog_receive_location() INTO receive_location;
  END IF;
  SELECT ('x'||lpad(split_part(xlog_location_string, '/', 1), 16, '0'))::bit(64)::bigint INTO wal_segment;
  SELECT ('x'||lpad(split_part(xlog_location_string, '/', 2), 16, '0'))::bit(64)::bigint INTO wal_offset;
  SELECT 1 FROM pg_ls_dir('.') as t(name) WHERE name = 'dontsync' INTO nosync;
  IF server_version_num >= 90300
  THEN
    wal_multiplier = CAST(x'FFFFFFFF' as bigint);
  ELSE
    wal_multiplier = CAST(x'FF000000' as bigint);
  END IF;

  IF server_version_num >= 90100 AND in_recovery
  THEN
    wal_delay_seconds := extract(epoch from now() - pg_last_xact_replay_timestamp())::bigint;
  END IF;

  RETURN QUERY
  SELECT 'zmon_utils_version', '11'
   UNION ALL
  SELECT 'server_version_num', server_version_num::text
   UNION ALL
  SELECT s.name, s.setting
    FROM pg_settings as s
   WHERE name in ('archive_mode',
                  'archive_command',
                  'archive_timeout',
                  'checkpoint_segments',
                  'listen_address',      -- connection
                  'port',                -- connection
                  'ssl',                 -- connection
                  'max_connections',     -- connection
                  'data_directory',      -- disk
                  'fsync',               -- disk
                  'full_page_writes',
                  'hba_file',
                  'ident_file',
                  'hot_standby',
                  'log_destination',
                  'log_directory',
                  'log_filename',
                  'shared_buffers',
                  'synchronous_commit'
                 )
   UNION ALL
  SELECT 'cluster_name', COALESCE(CASE WHEN server_version_num >= 90500 THEN current_setting('cluster_name') ELSE NULL END, substring(s.setting from E'/pgsql_([^/]+)/[^/]+/data$'))
    FROM pg_settings as s
   WHERE s.name = 'data_directory'
   UNION ALL
  SELECT 'defined_databases', string_agg(quote_ident(datname), E'\n')
    FROM pg_database
   WHERE datname != 'postgres'
     AND NOT datistemplate
     AND datallowconn
   UNION ALL
  SELECT 'is_in_recovery' as name, in_recovery::text as setting
    UNION ALL
  SELECT 'wal_bytes_from_zero' as name, CAST(wal_segment::numeric * wal_multiplier + wal_offset AS TEXT) as setting
    UNION ALL
  SELECT 'wal_delay_seconds' as name, wal_delay_seconds::text
    UNION ALL
  SELECT 'is_streaming' as name, CAST(receive_location IS NOT NULL AND in_recovery AS TEXT) as setting
    UNION ALL
  SELECT 'archive_nosync' as name, CAST(nosync IS NOT NULL AS TEXT) as setting;
  -- pg_stat_activity column names differ depending on server version
  IF server_version_num >= 90600 THEN
    RETURN QUERY
    SELECT a.name, a.setting
      FROM unnest((select array[('active_connections'::text,
                                 count(CASE WHEN state = 'active' THEN 1 END)::text),
                                ('idle_in_transaction_connections'::text,
                                 count(CASE WHEN state = 'idle in transaction' THEN 1 END)::text),
                                ('idle_in_transaction_max_age'::text,
                                 coalesce(max(CASE WHEN state = 'idle in transaction' THEN extract(epoch from statement_timestamp() - state_change) END), 0)::text),
                                ('locked_connections'::text,
                                 count(CASE WHEN wait_event_type = 'Lock' THEN 1 END)::text),
                                ('current_connections'::text,
                                 count(1)::text),
                                ('transaction_max_age'::text,
                                 -- exclude autovacuum transactions
                                 coalesce(extract(epoch from statement_timestamp() - min(CASE WHEN query like 'autovacuum:%' THEN NULL ELSE xact_start END)),0)::text)
                               ]
                     from pg_stat_activity
                 )) AS a (name text, setting text);
  ELSE
    RETURN QUERY
    SELECT a.name, a.setting
      FROM unnest((select array[('active_connections'::text,
                                 count(CASE WHEN state = 'active' THEN 1 END)::text),
                                ('idle_in_transaction_connections'::text,
                                 count(CASE WHEN state = 'idle in transaction' THEN 1 END)::text),
                                ('idle_in_transaction_max_age'::text,
                                 coalesce(max(CASE WHEN state = 'idle in transaction' THEN extract(epoch from statement_timestamp() - state_change) END), 0)::text),
                                ('locked_connections'::text,
                                 count(CASE WHEN waiting THEN 1 END)::text),
                                ('current_connections'::text,
                                 count(1)::text),
                                ('transaction_max_age'::text,
                                 -- exclude autovacuum transactions
                                 coalesce(extract(epoch from statement_timestamp() - min(CASE WHEN query like 'autovacuum:%' THEN NULL ELSE xact_start END)),0)::text)
                               ]
                     from pg_stat_activity
                 )) AS a (name text, setting text);
  END IF;
END
$_$;


ALTER FUNCTION zmon_utils.get_database_cluster_information() OWNER TO postgres;

--
-- Name: get_database_cluster_system_information(); Type: FUNCTION; Schema: zmon_utils; Owner: postgres
--

CREATE FUNCTION zmon_utils.get_database_cluster_system_information() RETURNS SETOF zmon_utils.system_information
    LANGUAGE plpython3u SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
"""
NOTE: this is python 2.5 compatible code

This function returns the system related data of the database cluster related disks.
It can be slow, so do not call it too often

load.1
load.5
load.15
cpu.count

xlog.location
xlog.size
xlog.device.name
xlog.device.total
xlog.device.used
xlog.devide.free

tablespace.<tablespacename>.size
tablespace.<tablespacename>.device
# for example
tablespace.pg_default.size
tablespace.pg_default.location
tablespace.pg_default.device

memory.commmit.diff

platform.release
platform.version
platform.kernel

vm.overcommit_memory
vm.overcommit_ratio

"""
import os
import platform


def get_mount_point(pathname):
    "Get the mount point of the filesystem containing pathname"
    pathname = os.path.normcase(os.path.realpath(pathname))
    parent_device = path_device = os.stat(pathname).st_dev
    while parent_device == path_device:
        mount_point = pathname
        pathname = os.path.dirname(pathname)
        if pathname == mount_point:
            break
        parent_device = os.stat(pathname).st_dev
    return mount_point


def get_mounted_device(pathname):
    "Get the device mounted at pathname"
    # uses "/proc/mounts"
    pathname = os.path.normcase(pathname)  # might be unnecessary here
    try:
        ifp = open("/proc/mounts", "r")
        try:
            for line in ifp:
                fields = line.rstrip('\n').split()
                # note that line above assumes that
                # no mount points contain whitespace
                if fields[1] == pathname:
                    return fields[0]
        finally:
            ifp.close()
    except EnvironmentError:
        pass
    return None  # explicit


def get_fs_space(pathname):
    "Get the free space of the filesystem containing pathname"
    stat = os.statvfs(pathname)
    # use f_bfree for superuser, or f_bavail if filesystem
    # has reserved space for superuser
    total = stat.f_blocks * stat.f_bsize
    free = stat.f_bavail * stat.f_bsize
    return total, free,


def get_dir_size(pathname):
    """ Get the total size of the directory in bytes.
        Ignore files located on different partitions.
    """
    size = 0
    folders = [pathname]
    root_dev = os.lstat(pathname).st_dev
    while len(folders):
        c = folders.pop()
        for e in os.listdir(c):
            e = os.path.join(c, e)
            try:
                st = os.lstat(e)
                # skip data on different partition
                if st.st_dev != root_dev:
                    continue
                mode = st.st_mode & 0xf000  # S_IFMT
                if mode == 0x4000:  # S_IFDIR
                    folders.append(e)
                    size += st.st_size
                if mode == 0x8000:  # S_IFREG
                    size += st.st_size
            except:
                # probably the file was removed already, so just skip it
                pass
    return size


def collect_tablespaces_stats(data_directory):
    """ fetch tablespaces names and oid - the latter is necessary
        to get the sizes information from the file system
    """
    result = {}
    ts = {}
    stats = {}
    if "stmt_tablespaces" in SD:
        plan = SD['stmt_tablespaces']
    else:
        plan = plpy.prepare("SELECT oid, spcname FROM pg_catalog.pg_tablespace")
        SD['stmt_tablespaces'] = plan

    rv = plpy.execute(plan)
    for r in rv:
        ts[r["oid"]] = r["spcname"]
    # get to the filesystem and fetch sizes and devices
    ts_root = os.path.join(data_directory, 'pg_tblspc')
    for oid in ts:
        # special cases - pg_global and pg_default. We are not interested in pg_global,
        # and will treat pg_default simply as datadir
        if ts[oid] == 'pg_default':
            stats = collect_directory_stats(data_directory, "tablespace.%s" % ts[oid])
        elif ts[oid] != 'pg_global':
            stats = collect_directory_stats(os.path.join(ts_root, oid), "tablespace.%s" % ts[oid])
        result.update(stats)
    return result


def get_platform_information():
    result = {}
    result['platform.version'] = platform.version()
    result['platform.release'] = platform.release()
    result['platform.kernel']  = (platform.release() or '').split('-')[0]

    return result


def collect_directory_stats(path, prefix):
    """ Collect real location, size, mount device, total and free space on a device for a dir """
    stat = {}
    location = os.path.realpath(path)
    stat[prefix+'.location'] = location
    mount_point = get_mount_point(location)
    # do we really need roots here?
    stat[prefix+'.device'] = get_mounted_device(mount_point)
    stat[prefix+'.total'], stat[prefix+'.free'] = get_fs_space(mount_point)
    # might be slow due to traversal of subdirectories
    stat[prefix+'.size'] = get_dir_size(location)
    return stat


def get_load_average():
    return dict(zip(('load.1', 'load.5', 'load.15'), os.getloadavg()))


def get_number_of_cpus():
    try:
        number_of_cpus = open('/proc/cpuinfo').read().count('processor\t:')
        if number_of_cpus > 0:
            return {'cpu.count': number_of_cpus}
    except IOError:
        # on other system, basically on Solaris, this file doesn't exist
        pass


def get_memory_info():
    "Get the memory info"
    # information is obtained from /proc/meminfo
    mem_info = {}
    expected_keys = { 'MemTotal':    'memory.total',
                      'MemFree':     'memory.free',
                      'Buffers':     'memory.buffers',
                      'Cached':      'memory.cached',
                      'SwapTotal':   'memory.swap.total',
                      'SwapFree':    'memory.swap.free',
                      'Dirty':       'memory.dirty',
                      'CommitLimit': 'memory.commit.limit',
                      'Committed_AS':'memory.commit.as',
                    }
    expected_key_count = len(expected_keys)
    try:
        ifp = open("/proc/meminfo", "r")
        try:
            for line in ifp:
                meminfo_key, value, = line.rstrip('\n').split(':')
                key = expected_keys.get(meminfo_key)
                if key:
                    mem_info[key] = int(value.strip(' kB')) * 1024 # we use bytes everywhere
                    if len(mem_info) == expected_key_count:
                        break
        finally:
            ifp.close()
    except EnvironmentError:
        return None
    commit_limit = mem_info['memory.commit.limit']
    committed_as = mem_info['memory.commit.as']
    if commit_limit and committed_as:
        mem_info['memory.commit.diff'] = commit_limit - committed_as
    return mem_info

def get_vm_info():
    "get information about virtual memory configuration, specifically overcommit settings"
    vm_info = {}
    file_keys = { '/proc/sys/vm/overcommit_memory': 'vm.overcommit_memory',
                  '/proc/sys/vm/overcommit_ratio' : 'vm.overcommit_ratio'
                }
    try:
        for fname, kname in file_keys.items():
            try:
                fp = open(fname, 'r')
                val = int(fp.read().strip())
                vm_info[kname] = val
            finally:
                fp.close()
    except EnvironmentError:
        pass
    return vm_info

if "stmt_settings" in SD:
    plan = SD["stmt_settings"]
else:
    plan = plpy.prepare("SELECT name, setting FROM pg_catalog.pg_settings WHERE name in ('data_directory', 'log_directory', 'server_version_num')")
    SD["stmt_settings"] = plan

rv = plpy.execute(plan)
s = {}
for r in rv:
    s[r["name"]] = r["setting"]

data_directory = s["data_directory"]
log_directory = s["log_directory"] = os.path.join(data_directory, s["log_directory"])
pg_tblspc = os.path.join(data_directory, "pg_tblspc")
pg_xlog = os.path.join(data_directory, "pg_xlog" if int(s["server_version_num"]) < 100000 else "pg_wal")

result = {}

# get tablespaces (including pg_default)
ts_stats = collect_tablespaces_stats(data_directory)
if len(ts_stats) > 0:
    result.update(ts_stats)

#get xlog and log directories
for (path, prefix) in ((pg_xlog, 'xlog'), (log_directory, 'log')):
    if os.path.isdir(path):
        stats = collect_directory_stats(path, prefix)
        if len(stats) > 0:
            result.update(stats)

result.update(get_platform_information())
result.update(get_load_average())
result.update(get_number_of_cpus())
mem_info = get_memory_info()
if mem_info:
    result.update(mem_info)
vm_info = get_vm_info()
if vm_info:
    result.update(vm_info)

return result.items()

$$;


ALTER FUNCTION zmon_utils.get_database_cluster_system_information() OWNER TO postgres;

--
-- Name: get_last_status_active_cronjobs(); Type: FUNCTION; Schema: zmon_utils; Owner: postgres
--

CREATE FUNCTION zmon_utils.get_last_status_active_cronjobs(OUT jobid bigint, OUT database text, OUT command text, OUT status text, OUT return_message text, OUT start_time timestamp with time zone, OUT end_time timestamp with time zone) RETURNS SETOF record
    LANGUAGE sql STRICT SECURITY DEFINER
    SET search_path TO 'cron'
    AS $$
SELECT DISTINCT ON (job_run_details.jobid)
       job_run_details.jobid,
       job_run_details.database,
       job_run_details.command,
       job_run_details.status,
       job_run_details.return_message,
       job_run_details.start_time,
       job_run_details.end_time
  FROM job
  JOIN job_run_details USING (jobid)
 WHERE job.active
 ORDER BY job_run_details.jobid, job_run_details.start_time DESC NULLS LAST;
$$;


ALTER FUNCTION zmon_utils.get_last_status_active_cronjobs(OUT jobid bigint, OUT database text, OUT command text, OUT status text, OUT return_message text, OUT start_time timestamp with time zone, OUT end_time timestamp with time zone) OWNER TO postgres;

--
-- Name: pglog; Type: SERVER; Schema: -; Owner: postgres
--

CREATE SERVER pglog FOREIGN DATA WRAPPER file_fdw;


ALTER SERVER pglog OWNER TO postgres;

--
-- Name: index_bloat; Type: VIEW; Schema: metric_helpers; Owner: postgres
--

CREATE VIEW metric_helpers.index_bloat AS
 SELECT get_btree_bloat_approx.i_database,
    get_btree_bloat_approx.i_schema_name,
    get_btree_bloat_approx.i_table_name,
    get_btree_bloat_approx.i_index_name,
    get_btree_bloat_approx.i_real_size,
    get_btree_bloat_approx.i_extra_size,
    get_btree_bloat_approx.i_extra_ratio,
    get_btree_bloat_approx.i_fill_factor,
    get_btree_bloat_approx.i_bloat_size,
    get_btree_bloat_approx.i_bloat_ratio,
    get_btree_bloat_approx.i_is_na
   FROM metric_helpers.get_btree_bloat_approx() get_btree_bloat_approx(i_database, i_schema_name, i_table_name, i_index_name, i_real_size, i_extra_size, i_extra_ratio, i_fill_factor, i_bloat_size, i_bloat_ratio, i_is_na);


ALTER TABLE metric_helpers.index_bloat OWNER TO postgres;

--
-- Name: pg_stat_statements; Type: VIEW; Schema: metric_helpers; Owner: postgres
--

CREATE VIEW metric_helpers.pg_stat_statements AS
 SELECT pg_stat_statements.userid,
    pg_stat_statements.dbid,
    pg_stat_statements.toplevel,
    pg_stat_statements.queryid,
    pg_stat_statements.query,
    pg_stat_statements.plans,
    pg_stat_statements.total_plan_time,
    pg_stat_statements.min_plan_time,
    pg_stat_statements.max_plan_time,
    pg_stat_statements.mean_plan_time,
    pg_stat_statements.stddev_plan_time,
    pg_stat_statements.calls,
    pg_stat_statements.total_exec_time,
    pg_stat_statements.min_exec_time,
    pg_stat_statements.max_exec_time,
    pg_stat_statements.mean_exec_time,
    pg_stat_statements.stddev_exec_time,
    pg_stat_statements.rows,
    pg_stat_statements.shared_blks_hit,
    pg_stat_statements.shared_blks_read,
    pg_stat_statements.shared_blks_dirtied,
    pg_stat_statements.shared_blks_written,
    pg_stat_statements.local_blks_hit,
    pg_stat_statements.local_blks_read,
    pg_stat_statements.local_blks_dirtied,
    pg_stat_statements.local_blks_written,
    pg_stat_statements.temp_blks_read,
    pg_stat_statements.temp_blks_written,
    pg_stat_statements.blk_read_time,
    pg_stat_statements.blk_write_time,
    pg_stat_statements.temp_blk_read_time,
    pg_stat_statements.temp_blk_write_time,
    pg_stat_statements.wal_records,
    pg_stat_statements.wal_fpi,
    pg_stat_statements.wal_bytes,
    pg_stat_statements.jit_functions,
    pg_stat_statements.jit_generation_time,
    pg_stat_statements.jit_inlining_count,
    pg_stat_statements.jit_inlining_time,
    pg_stat_statements.jit_optimization_count,
    pg_stat_statements.jit_optimization_time,
    pg_stat_statements.jit_emission_count,
    pg_stat_statements.jit_emission_time
   FROM metric_helpers.pg_stat_statements(true) pg_stat_statements(userid, dbid, toplevel, queryid, query, plans, total_plan_time, min_plan_time, max_plan_time, mean_plan_time, stddev_plan_time, calls, total_exec_time, min_exec_time, max_exec_time, mean_exec_time, stddev_exec_time, rows, shared_blks_hit, shared_blks_read, shared_blks_dirtied, shared_blks_written, local_blks_hit, local_blks_read, local_blks_dirtied, local_blks_written, temp_blks_read, temp_blks_written, blk_read_time, blk_write_time, temp_blk_read_time, temp_blk_write_time, wal_records, wal_fpi, wal_bytes, jit_functions, jit_generation_time, jit_inlining_count, jit_inlining_time, jit_optimization_count, jit_optimization_time, jit_emission_count, jit_emission_time);


ALTER TABLE metric_helpers.pg_stat_statements OWNER TO postgres;

--
-- Name: table_bloat; Type: VIEW; Schema: metric_helpers; Owner: postgres
--

CREATE VIEW metric_helpers.table_bloat AS
 SELECT get_table_bloat_approx.t_database,
    get_table_bloat_approx.t_schema_name,
    get_table_bloat_approx.t_table_name,
    get_table_bloat_approx.t_real_size,
    get_table_bloat_approx.t_extra_size,
    get_table_bloat_approx.t_extra_ratio,
    get_table_bloat_approx.t_fill_factor,
    get_table_bloat_approx.t_bloat_size,
    get_table_bloat_approx.t_bloat_ratio,
    get_table_bloat_approx.t_is_na
   FROM metric_helpers.get_table_bloat_approx() get_table_bloat_approx(t_database, t_schema_name, t_table_name, t_real_size, t_extra_size, t_extra_ratio, t_fill_factor, t_bloat_size, t_bloat_ratio, t_is_na);


ALTER TABLE metric_helpers.table_bloat OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: announcement_reads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.announcement_reads (
    announcement_id integer NOT NULL,
    user_id integer NOT NULL,
    read_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.announcement_reads OWNER TO postgres;

--
-- Name: announcements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.announcements (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    sender_id integer,
    target_type character varying(20) NOT NULL,
    target_role character varying(20),
    department_id integer,
    target_email character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.announcements OWNER TO postgres;

--
-- Name: announcements_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.announcements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.announcements_id_seq OWNER TO postgres;

--
-- Name: announcements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.announcements_id_seq OWNED BY public.announcements.id;


--
-- Name: attendance_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attendance_logs (
    id integer NOT NULL,
    user_id integer,
    work_date date DEFAULT CURRENT_DATE NOT NULL,
    check_in_time timestamp without time zone,
    check_in_device_id character varying(255),
    check_out_time timestamp without time zone,
    check_out_device_id character varying(255),
    late_minutes integer DEFAULT 0,
    early_leave_minutes integer DEFAULT 0,
    status character varying(50) DEFAULT 'Chưa Vào Làm'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.attendance_logs OWNER TO postgres;

--
-- Name: attendance_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.attendance_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.attendance_logs_id_seq OWNER TO postgres;

--
-- Name: attendance_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.attendance_logs_id_seq OWNED BY public.attendance_logs.id;


--
-- Name: bonuses_penalties; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bonuses_penalties (
    id integer NOT NULL,
    user_id integer,
    type character varying(10) NOT NULL,
    amount numeric(15,2) NOT NULL,
    reason text,
    issue_date date DEFAULT CURRENT_DATE NOT NULL,
    created_by integer
);


ALTER TABLE public.bonuses_penalties OWNER TO postgres;

--
-- Name: bonuses_penalties_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bonuses_penalties_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.bonuses_penalties_id_seq OWNER TO postgres;

--
-- Name: bonuses_penalties_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bonuses_penalties_id_seq OWNED BY public.bonuses_penalties.id;


--
-- Name: departments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.departments (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    manager_id integer,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.departments OWNER TO postgres;

--
-- Name: departments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.departments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.departments_id_seq OWNER TO postgres;

--
-- Name: departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.departments_id_seq OWNED BY public.departments.id;


--
-- Name: postgres_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.postgres_log (
    log_time timestamp(3) with time zone,
    user_name text,
    database_name text,
    process_id integer,
    connection_from text,
    session_id text NOT NULL,
    session_line_num bigint NOT NULL,
    command_tag text,
    session_start_time timestamp with time zone,
    virtual_transaction_id text,
    transaction_id bigint,
    error_severity text,
    sql_state_code text,
    message text,
    detail text,
    hint text,
    internal_query text,
    internal_query_pos integer,
    context text,
    query text,
    query_pos integer,
    location text,
    application_name text,
    backend_type text,
    leader_pid integer,
    query_id bigint,
    CONSTRAINT postgres_log_check CHECK (false) NO INHERIT
);


ALTER TABLE public.postgres_log OWNER TO postgres;

--
-- Name: postgres_log_0; Type: FOREIGN TABLE; Schema: public; Owner: postgres
--

CREATE FOREIGN TABLE public.postgres_log_0 (
)
INHERITS (public.postgres_log)
SERVER pglog
OPTIONS (
    filename '../pg_log/postgresql-0.csv',
    format 'csv',
    header 'false'
);


ALTER FOREIGN TABLE public.postgres_log_0 OWNER TO postgres;

--
-- Name: failed_authentication_0; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.failed_authentication_0 WITH (security_barrier='true') AS
 SELECT postgres_log_0.log_time,
    postgres_log_0.user_name,
    postgres_log_0.database_name,
    postgres_log_0.process_id,
    postgres_log_0.connection_from,
    postgres_log_0.session_id,
    postgres_log_0.session_line_num,
    postgres_log_0.command_tag,
    postgres_log_0.session_start_time,
    postgres_log_0.virtual_transaction_id,
    postgres_log_0.transaction_id,
    postgres_log_0.error_severity,
    postgres_log_0.sql_state_code,
    postgres_log_0.message,
    postgres_log_0.detail,
    postgres_log_0.hint,
    postgres_log_0.internal_query,
    postgres_log_0.internal_query_pos,
    postgres_log_0.context,
    postgres_log_0.query,
    postgres_log_0.query_pos,
    postgres_log_0.location,
    postgres_log_0.application_name,
    postgres_log_0.backend_type,
    postgres_log_0.leader_pid,
    postgres_log_0.query_id
   FROM public.postgres_log_0
  WHERE ((postgres_log_0.command_tag = 'authentication'::text) AND (postgres_log_0.error_severity = 'FATAL'::text));


ALTER TABLE public.failed_authentication_0 OWNER TO postgres;

--
-- Name: postgres_log_1; Type: FOREIGN TABLE; Schema: public; Owner: postgres
--

CREATE FOREIGN TABLE public.postgres_log_1 (
)
INHERITS (public.postgres_log)
SERVER pglog
OPTIONS (
    filename '../pg_log/postgresql-1.csv',
    format 'csv',
    header 'false'
);


ALTER FOREIGN TABLE public.postgres_log_1 OWNER TO postgres;

--
-- Name: failed_authentication_1; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.failed_authentication_1 WITH (security_barrier='true') AS
 SELECT postgres_log_1.log_time,
    postgres_log_1.user_name,
    postgres_log_1.database_name,
    postgres_log_1.process_id,
    postgres_log_1.connection_from,
    postgres_log_1.session_id,
    postgres_log_1.session_line_num,
    postgres_log_1.command_tag,
    postgres_log_1.session_start_time,
    postgres_log_1.virtual_transaction_id,
    postgres_log_1.transaction_id,
    postgres_log_1.error_severity,
    postgres_log_1.sql_state_code,
    postgres_log_1.message,
    postgres_log_1.detail,
    postgres_log_1.hint,
    postgres_log_1.internal_query,
    postgres_log_1.internal_query_pos,
    postgres_log_1.context,
    postgres_log_1.query,
    postgres_log_1.query_pos,
    postgres_log_1.location,
    postgres_log_1.application_name,
    postgres_log_1.backend_type,
    postgres_log_1.leader_pid,
    postgres_log_1.query_id
   FROM public.postgres_log_1
  WHERE ((postgres_log_1.command_tag = 'authentication'::text) AND (postgres_log_1.error_severity = 'FATAL'::text));


ALTER TABLE public.failed_authentication_1 OWNER TO postgres;

--
-- Name: postgres_log_2; Type: FOREIGN TABLE; Schema: public; Owner: postgres
--

CREATE FOREIGN TABLE public.postgres_log_2 (
)
INHERITS (public.postgres_log)
SERVER pglog
OPTIONS (
    filename '../pg_log/postgresql-2.csv',
    format 'csv',
    header 'false'
);


ALTER FOREIGN TABLE public.postgres_log_2 OWNER TO postgres;

--
-- Name: failed_authentication_2; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.failed_authentication_2 WITH (security_barrier='true') AS
 SELECT postgres_log_2.log_time,
    postgres_log_2.user_name,
    postgres_log_2.database_name,
    postgres_log_2.process_id,
    postgres_log_2.connection_from,
    postgres_log_2.session_id,
    postgres_log_2.session_line_num,
    postgres_log_2.command_tag,
    postgres_log_2.session_start_time,
    postgres_log_2.virtual_transaction_id,
    postgres_log_2.transaction_id,
    postgres_log_2.error_severity,
    postgres_log_2.sql_state_code,
    postgres_log_2.message,
    postgres_log_2.detail,
    postgres_log_2.hint,
    postgres_log_2.internal_query,
    postgres_log_2.internal_query_pos,
    postgres_log_2.context,
    postgres_log_2.query,
    postgres_log_2.query_pos,
    postgres_log_2.location,
    postgres_log_2.application_name,
    postgres_log_2.backend_type,
    postgres_log_2.leader_pid,
    postgres_log_2.query_id
   FROM public.postgres_log_2
  WHERE ((postgres_log_2.command_tag = 'authentication'::text) AND (postgres_log_2.error_severity = 'FATAL'::text));


ALTER TABLE public.failed_authentication_2 OWNER TO postgres;

--
-- Name: postgres_log_3; Type: FOREIGN TABLE; Schema: public; Owner: postgres
--

CREATE FOREIGN TABLE public.postgres_log_3 (
)
INHERITS (public.postgres_log)
SERVER pglog
OPTIONS (
    filename '../pg_log/postgresql-3.csv',
    format 'csv',
    header 'false'
);


ALTER FOREIGN TABLE public.postgres_log_3 OWNER TO postgres;

--
-- Name: failed_authentication_3; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.failed_authentication_3 WITH (security_barrier='true') AS
 SELECT postgres_log_3.log_time,
    postgres_log_3.user_name,
    postgres_log_3.database_name,
    postgres_log_3.process_id,
    postgres_log_3.connection_from,
    postgres_log_3.session_id,
    postgres_log_3.session_line_num,
    postgres_log_3.command_tag,
    postgres_log_3.session_start_time,
    postgres_log_3.virtual_transaction_id,
    postgres_log_3.transaction_id,
    postgres_log_3.error_severity,
    postgres_log_3.sql_state_code,
    postgres_log_3.message,
    postgres_log_3.detail,
    postgres_log_3.hint,
    postgres_log_3.internal_query,
    postgres_log_3.internal_query_pos,
    postgres_log_3.context,
    postgres_log_3.query,
    postgres_log_3.query_pos,
    postgres_log_3.location,
    postgres_log_3.application_name,
    postgres_log_3.backend_type,
    postgres_log_3.leader_pid,
    postgres_log_3.query_id
   FROM public.postgres_log_3
  WHERE ((postgres_log_3.command_tag = 'authentication'::text) AND (postgres_log_3.error_severity = 'FATAL'::text));


ALTER TABLE public.failed_authentication_3 OWNER TO postgres;

--
-- Name: postgres_log_4; Type: FOREIGN TABLE; Schema: public; Owner: postgres
--

CREATE FOREIGN TABLE public.postgres_log_4 (
)
INHERITS (public.postgres_log)
SERVER pglog
OPTIONS (
    filename '../pg_log/postgresql-4.csv',
    format 'csv',
    header 'false'
);


ALTER FOREIGN TABLE public.postgres_log_4 OWNER TO postgres;

--
-- Name: failed_authentication_4; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.failed_authentication_4 WITH (security_barrier='true') AS
 SELECT postgres_log_4.log_time,
    postgres_log_4.user_name,
    postgres_log_4.database_name,
    postgres_log_4.process_id,
    postgres_log_4.connection_from,
    postgres_log_4.session_id,
    postgres_log_4.session_line_num,
    postgres_log_4.command_tag,
    postgres_log_4.session_start_time,
    postgres_log_4.virtual_transaction_id,
    postgres_log_4.transaction_id,
    postgres_log_4.error_severity,
    postgres_log_4.sql_state_code,
    postgres_log_4.message,
    postgres_log_4.detail,
    postgres_log_4.hint,
    postgres_log_4.internal_query,
    postgres_log_4.internal_query_pos,
    postgres_log_4.context,
    postgres_log_4.query,
    postgres_log_4.query_pos,
    postgres_log_4.location,
    postgres_log_4.application_name,
    postgres_log_4.backend_type,
    postgres_log_4.leader_pid,
    postgres_log_4.query_id
   FROM public.postgres_log_4
  WHERE ((postgres_log_4.command_tag = 'authentication'::text) AND (postgres_log_4.error_severity = 'FATAL'::text));


ALTER TABLE public.failed_authentication_4 OWNER TO postgres;

--
-- Name: postgres_log_5; Type: FOREIGN TABLE; Schema: public; Owner: postgres
--

CREATE FOREIGN TABLE public.postgres_log_5 (
)
INHERITS (public.postgres_log)
SERVER pglog
OPTIONS (
    filename '../pg_log/postgresql-5.csv',
    format 'csv',
    header 'false'
);


ALTER FOREIGN TABLE public.postgres_log_5 OWNER TO postgres;

--
-- Name: failed_authentication_5; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.failed_authentication_5 WITH (security_barrier='true') AS
 SELECT postgres_log_5.log_time,
    postgres_log_5.user_name,
    postgres_log_5.database_name,
    postgres_log_5.process_id,
    postgres_log_5.connection_from,
    postgres_log_5.session_id,
    postgres_log_5.session_line_num,
    postgres_log_5.command_tag,
    postgres_log_5.session_start_time,
    postgres_log_5.virtual_transaction_id,
    postgres_log_5.transaction_id,
    postgres_log_5.error_severity,
    postgres_log_5.sql_state_code,
    postgres_log_5.message,
    postgres_log_5.detail,
    postgres_log_5.hint,
    postgres_log_5.internal_query,
    postgres_log_5.internal_query_pos,
    postgres_log_5.context,
    postgres_log_5.query,
    postgres_log_5.query_pos,
    postgres_log_5.location,
    postgres_log_5.application_name,
    postgres_log_5.backend_type,
    postgres_log_5.leader_pid,
    postgres_log_5.query_id
   FROM public.postgres_log_5
  WHERE ((postgres_log_5.command_tag = 'authentication'::text) AND (postgres_log_5.error_severity = 'FATAL'::text));


ALTER TABLE public.failed_authentication_5 OWNER TO postgres;

--
-- Name: postgres_log_6; Type: FOREIGN TABLE; Schema: public; Owner: postgres
--

CREATE FOREIGN TABLE public.postgres_log_6 (
)
INHERITS (public.postgres_log)
SERVER pglog
OPTIONS (
    filename '../pg_log/postgresql-6.csv',
    format 'csv',
    header 'false'
);


ALTER FOREIGN TABLE public.postgres_log_6 OWNER TO postgres;

--
-- Name: failed_authentication_6; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.failed_authentication_6 WITH (security_barrier='true') AS
 SELECT postgres_log_6.log_time,
    postgres_log_6.user_name,
    postgres_log_6.database_name,
    postgres_log_6.process_id,
    postgres_log_6.connection_from,
    postgres_log_6.session_id,
    postgres_log_6.session_line_num,
    postgres_log_6.command_tag,
    postgres_log_6.session_start_time,
    postgres_log_6.virtual_transaction_id,
    postgres_log_6.transaction_id,
    postgres_log_6.error_severity,
    postgres_log_6.sql_state_code,
    postgres_log_6.message,
    postgres_log_6.detail,
    postgres_log_6.hint,
    postgres_log_6.internal_query,
    postgres_log_6.internal_query_pos,
    postgres_log_6.context,
    postgres_log_6.query,
    postgres_log_6.query_pos,
    postgres_log_6.location,
    postgres_log_6.application_name,
    postgres_log_6.backend_type,
    postgres_log_6.leader_pid,
    postgres_log_6.query_id
   FROM public.postgres_log_6
  WHERE ((postgres_log_6.command_tag = 'authentication'::text) AND (postgres_log_6.error_severity = 'FATAL'::text));


ALTER TABLE public.failed_authentication_6 OWNER TO postgres;

--
-- Name: postgres_log_7; Type: FOREIGN TABLE; Schema: public; Owner: postgres
--

CREATE FOREIGN TABLE public.postgres_log_7 (
)
INHERITS (public.postgres_log)
SERVER pglog
OPTIONS (
    filename '../pg_log/postgresql-7.csv',
    format 'csv',
    header 'false'
);


ALTER FOREIGN TABLE public.postgres_log_7 OWNER TO postgres;

--
-- Name: failed_authentication_7; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.failed_authentication_7 WITH (security_barrier='true') AS
 SELECT postgres_log_7.log_time,
    postgres_log_7.user_name,
    postgres_log_7.database_name,
    postgres_log_7.process_id,
    postgres_log_7.connection_from,
    postgres_log_7.session_id,
    postgres_log_7.session_line_num,
    postgres_log_7.command_tag,
    postgres_log_7.session_start_time,
    postgres_log_7.virtual_transaction_id,
    postgres_log_7.transaction_id,
    postgres_log_7.error_severity,
    postgres_log_7.sql_state_code,
    postgres_log_7.message,
    postgres_log_7.detail,
    postgres_log_7.hint,
    postgres_log_7.internal_query,
    postgres_log_7.internal_query_pos,
    postgres_log_7.context,
    postgres_log_7.query,
    postgres_log_7.query_pos,
    postgres_log_7.location,
    postgres_log_7.application_name,
    postgres_log_7.backend_type,
    postgres_log_7.leader_pid,
    postgres_log_7.query_id
   FROM public.postgres_log_7
  WHERE ((postgres_log_7.command_tag = 'authentication'::text) AND (postgres_log_7.error_severity = 'FATAL'::text));


ALTER TABLE public.failed_authentication_7 OWNER TO postgres;

--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.leave_requests (
    id integer NOT NULL,
    user_id integer,
    leave_type character varying(20) DEFAULT 'ANNUAL'::character varying,
    reason text,
    start_date date NOT NULL,
    end_date date NOT NULL,
    total_days integer,
    status character varying(20) DEFAULT 'PENDING'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    approved_at timestamp without time zone,
    approver_id integer,
    rejection_reason text
);


ALTER TABLE public.leave_requests OWNER TO postgres;

--
-- Name: leave_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.leave_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.leave_requests_id_seq OWNER TO postgres;

--
-- Name: leave_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.leave_requests_id_seq OWNED BY public.leave_requests.id;


--
-- Name: meeting_attendees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.meeting_attendees (
    meeting_id integer NOT NULL,
    user_id integer NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying
);


ALTER TABLE public.meeting_attendees OWNER TO postgres;

--
-- Name: meetings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.meetings (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone NOT NULL,
    organizer_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.meetings OWNER TO postgres;

--
-- Name: meetings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.meetings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.meetings_id_seq OWNER TO postgres;

--
-- Name: meetings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.meetings_id_seq OWNED BY public.meetings.id;


--
-- Name: monthly_payrolls; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.monthly_payrolls (
    id integer NOT NULL,
    user_id integer,
    payroll_month integer NOT NULL,
    payroll_year integer NOT NULL,
    base_salary numeric(15,2),
    standard_work_days integer NOT NULL,
    total_working_days integer,
    total_leave_days integer,
    total_unpaid_leave_days integer DEFAULT 0,
    total_late_days integer DEFAULT 0,
    total_unexcused_days integer DEFAULT 0,
    total_bonus numeric(15,2) DEFAULT 0,
    total_penalty numeric(15,2) DEFAULT 0,
    net_salary numeric(15,2) NOT NULL,
    status character varying(20) DEFAULT 'DRAFT'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.monthly_payrolls OWNER TO postgres;

--
-- Name: monthly_payrolls_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.monthly_payrolls_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.monthly_payrolls_id_seq OWNER TO postgres;

--
-- Name: monthly_payrolls_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.monthly_payrolls_id_seq OWNED BY public.monthly_payrolls.id;


--
-- Name: shifts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shifts (
    id integer NOT NULL,
    shift_name character varying(50) NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    min_employees integer DEFAULT 3,
    max_employees integer DEFAULT 5
);


ALTER TABLE public.shifts OWNER TO postgres;

--
-- Name: shifts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.shifts_id_seq OWNER TO postgres;

--
-- Name: shifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.shifts_id_seq OWNED BY public.shifts.id;


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_settings (
    key character varying(50) NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.system_settings OWNER TO postgres;

--
-- Name: user_schedules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_schedules (
    id integer NOT NULL,
    user_id integer,
    shift_id integer,
    work_date date NOT NULL
);


ALTER TABLE public.user_schedules OWNER TO postgres;

--
-- Name: user_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.user_schedules_id_seq OWNER TO postgres;

--
-- Name: user_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_schedules_id_seq OWNED BY public.user_schedules.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    password character varying(255) NOT NULL,
    full_name character varying(100),
    email character varying(100),
    phone_number character varying(15),
    avatar_url character varying(255),
    department_id integer,
    max_leave_days integer DEFAULT 12,
    role character varying(20) DEFAULT 'STAFF'::character varying,
    status character varying(20) DEFAULT 'PENDING_ADMIN'::character varying,
    otp_code character varying(6),
    otp_expires_at timestamp without time zone,
    manager_id integer,
    base_salary numeric(15,2) DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: last_status_active_cronjobs; Type: VIEW; Schema: zmon_utils; Owner: postgres
--

CREATE VIEW zmon_utils.last_status_active_cronjobs AS
 SELECT get_last_status_active_cronjobs.jobid,
    get_last_status_active_cronjobs.database,
    get_last_status_active_cronjobs.command,
    get_last_status_active_cronjobs.status,
    get_last_status_active_cronjobs.return_message,
    get_last_status_active_cronjobs.start_time,
    get_last_status_active_cronjobs.end_time
   FROM zmon_utils.get_last_status_active_cronjobs() get_last_status_active_cronjobs(jobid, database, command, status, return_message, start_time, end_time);


ALTER TABLE zmon_utils.last_status_active_cronjobs OWNER TO postgres;

--
-- Name: announcements id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.announcements ALTER COLUMN id SET DEFAULT nextval('public.announcements_id_seq'::regclass);


--
-- Name: attendance_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_logs ALTER COLUMN id SET DEFAULT nextval('public.attendance_logs_id_seq'::regclass);


--
-- Name: bonuses_penalties id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bonuses_penalties ALTER COLUMN id SET DEFAULT nextval('public.bonuses_penalties_id_seq'::regclass);


--
-- Name: departments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_id_seq'::regclass);


--
-- Name: leave_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests ALTER COLUMN id SET DEFAULT nextval('public.leave_requests_id_seq'::regclass);


--
-- Name: meetings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.meetings ALTER COLUMN id SET DEFAULT nextval('public.meetings_id_seq'::regclass);


--
-- Name: monthly_payrolls id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_payrolls ALTER COLUMN id SET DEFAULT nextval('public.monthly_payrolls_id_seq'::regclass);


--
-- Name: shifts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shifts ALTER COLUMN id SET DEFAULT nextval('public.shifts_id_seq'::regclass);


--
-- Name: user_schedules id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_schedules ALTER COLUMN id SET DEFAULT nextval('public.user_schedules_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: announcement_reads announcement_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.announcement_reads
    ADD CONSTRAINT announcement_reads_pkey PRIMARY KEY (announcement_id, user_id);


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: attendance_logs attendance_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_logs
    ADD CONSTRAINT attendance_logs_pkey PRIMARY KEY (id);


--
-- Name: attendance_logs attendance_logs_user_id_work_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_logs
    ADD CONSTRAINT attendance_logs_user_id_work_date_key UNIQUE (user_id, work_date);


--
-- Name: bonuses_penalties bonuses_penalties_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bonuses_penalties
    ADD CONSTRAINT bonuses_penalties_pkey PRIMARY KEY (id);


--
-- Name: departments departments_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_name_key UNIQUE (name);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- Name: meeting_attendees meeting_attendees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.meeting_attendees
    ADD CONSTRAINT meeting_attendees_pkey PRIMARY KEY (meeting_id, user_id);


--
-- Name: meetings meetings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_pkey PRIMARY KEY (id);


--
-- Name: monthly_payrolls monthly_payrolls_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_payrolls
    ADD CONSTRAINT monthly_payrolls_pkey PRIMARY KEY (id);


--
-- Name: monthly_payrolls monthly_payrolls_user_id_payroll_month_payroll_year_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_payrolls
    ADD CONSTRAINT monthly_payrolls_user_id_payroll_month_payroll_year_key UNIQUE (user_id, payroll_month, payroll_year);


--
-- Name: shifts shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (key);


--
-- Name: user_schedules user_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_schedules
    ADD CONSTRAINT user_schedules_pkey PRIMARY KEY (id);


--
-- Name: user_schedules user_schedules_user_id_work_date_shift_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_schedules
    ADD CONSTRAINT user_schedules_user_id_work_date_shift_id_key UNIQUE (user_id, work_date, shift_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: announcement_reads announcement_reads_announcement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.announcement_reads
    ADD CONSTRAINT announcement_reads_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE;


--
-- Name: announcement_reads announcement_reads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.announcement_reads
    ADD CONSTRAINT announcement_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: announcements announcements_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: announcements announcements_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: attendance_logs attendance_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_logs
    ADD CONSTRAINT attendance_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: bonuses_penalties bonuses_penalties_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bonuses_penalties
    ADD CONSTRAINT bonuses_penalties_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: bonuses_penalties bonuses_penalties_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bonuses_penalties
    ADD CONSTRAINT bonuses_penalties_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: departments fk_dept_manager; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT fk_dept_manager FOREIGN KEY (manager_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: leave_requests leave_requests_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id);


--
-- Name: leave_requests leave_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: meeting_attendees meeting_attendees_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.meeting_attendees
    ADD CONSTRAINT meeting_attendees_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE CASCADE;


--
-- Name: meeting_attendees meeting_attendees_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.meeting_attendees
    ADD CONSTRAINT meeting_attendees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: meetings meetings_organizer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES public.users(id);


--
-- Name: monthly_payrolls monthly_payrolls_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_payrolls
    ADD CONSTRAINT monthly_payrolls_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_schedules user_schedules_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_schedules
    ADD CONSTRAINT user_schedules_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shifts(id);


--
-- Name: user_schedules user_schedules_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_schedules
    ADD CONSTRAINT user_schedules_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: users users_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id);


--
-- Name: job cron_job_policy; Type: POLICY; Schema: cron; Owner: postgres
--

CREATE POLICY cron_job_policy ON cron.job USING (((username = CURRENT_USER) OR (pg_has_role(CURRENT_USER, 'cron_admin'::name, 'MEMBER'::text) AND pg_has_role((username)::name, 'cron_admin'::name, 'MEMBER'::text) AND (NOT (EXISTS ( SELECT 1
   FROM pg_roles
  WHERE ((pg_roles.rolname = job.username) AND pg_roles.rolsuper)))))));


--
-- Name: job_run_details cron_job_run_details_policy; Type: POLICY; Schema: cron; Owner: postgres
--

CREATE POLICY cron_job_run_details_policy ON cron.job_run_details USING (((username = CURRENT_USER) OR (pg_has_role(CURRENT_USER, 'cron_admin'::name, 'MEMBER'::text) AND pg_has_role((username)::name, 'cron_admin'::name, 'MEMBER'::text) AND (NOT (EXISTS ( SELECT 1
   FROM pg_roles
  WHERE ((pg_roles.rolname = job_run_details.username) AND pg_roles.rolsuper)))))));


--
-- Name: job; Type: ROW SECURITY; Schema: cron; Owner: postgres
--

ALTER TABLE cron.job ENABLE ROW LEVEL SECURITY;

--
-- Name: job_run_details; Type: ROW SECURITY; Schema: cron; Owner: postgres
--

ALTER TABLE cron.job_run_details ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- Name: SCHEMA cron; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA cron TO cron_admin;


--
-- Name: SCHEMA metric_helpers; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA metric_helpers TO admin;
GRANT USAGE ON SCHEMA metric_helpers TO robot_zmon;


--
-- Name: SCHEMA user_management; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA user_management TO admin;


--
-- Name: SCHEMA zmon_utils; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA zmon_utils TO robot_zmon;


--
-- Name: FUNCTION alter_job(job_id bigint, schedule text, command text, database text, username text, active boolean); Type: ACL; Schema: cron; Owner: postgres
--

GRANT ALL ON FUNCTION cron.alter_job(job_id bigint, schedule text, command text, database text, username text, active boolean) TO cron_admin;


--
-- Name: FUNCTION job_cache_invalidate(); Type: ACL; Schema: cron; Owner: postgres
--

REVOKE ALL ON FUNCTION cron.job_cache_invalidate() FROM PUBLIC;
GRANT ALL ON FUNCTION cron.job_cache_invalidate() TO cron_admin;


--
-- Name: FUNCTION schedule(schedule text, command text); Type: ACL; Schema: cron; Owner: postgres
--

REVOKE ALL ON FUNCTION cron.schedule(schedule text, command text) FROM PUBLIC;
GRANT ALL ON FUNCTION cron.schedule(schedule text, command text) TO cron_admin;


--
-- Name: FUNCTION schedule(job_name text, schedule text, command text); Type: ACL; Schema: cron; Owner: postgres
--

REVOKE ALL ON FUNCTION cron.schedule(job_name text, schedule text, command text) FROM PUBLIC;
GRANT ALL ON FUNCTION cron.schedule(job_name text, schedule text, command text) TO cron_admin;


--
-- Name: FUNCTION schedule_in_database(p_schedule text, p_database text, p_command text); Type: ACL; Schema: cron; Owner: postgres
--

REVOKE ALL ON FUNCTION cron.schedule_in_database(p_schedule text, p_database text, p_command text) FROM PUBLIC;
GRANT ALL ON FUNCTION cron.schedule_in_database(p_schedule text, p_database text, p_command text) TO cron_admin;


--
-- Name: FUNCTION schedule_in_database(job_name text, schedule text, command text, database text, username text, active boolean); Type: ACL; Schema: cron; Owner: postgres
--

GRANT ALL ON FUNCTION cron.schedule_in_database(job_name text, schedule text, command text, database text, username text, active boolean) TO cron_admin;


--
-- Name: FUNCTION unschedule(job_id bigint); Type: ACL; Schema: cron; Owner: postgres
--

REVOKE ALL ON FUNCTION cron.unschedule(job_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION cron.unschedule(job_id bigint) TO cron_admin;


--
-- Name: FUNCTION unschedule(job_name name); Type: ACL; Schema: cron; Owner: postgres
--

REVOKE ALL ON FUNCTION cron.unschedule(job_name name) FROM PUBLIC;
GRANT ALL ON FUNCTION cron.unschedule(job_name name) TO cron_admin;


--
-- Name: FUNCTION get_btree_bloat_approx(OUT i_database name, OUT i_schema_name name, OUT i_table_name name, OUT i_index_name name, OUT i_real_size numeric, OUT i_extra_size numeric, OUT i_extra_ratio double precision, OUT i_fill_factor integer, OUT i_bloat_size double precision, OUT i_bloat_ratio double precision, OUT i_is_na boolean); Type: ACL; Schema: metric_helpers; Owner: postgres
--

REVOKE ALL ON FUNCTION metric_helpers.get_btree_bloat_approx(OUT i_database name, OUT i_schema_name name, OUT i_table_name name, OUT i_index_name name, OUT i_real_size numeric, OUT i_extra_size numeric, OUT i_extra_ratio double precision, OUT i_fill_factor integer, OUT i_bloat_size double precision, OUT i_bloat_ratio double precision, OUT i_is_na boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION metric_helpers.get_btree_bloat_approx(OUT i_database name, OUT i_schema_name name, OUT i_table_name name, OUT i_index_name name, OUT i_real_size numeric, OUT i_extra_size numeric, OUT i_extra_ratio double precision, OUT i_fill_factor integer, OUT i_bloat_size double precision, OUT i_bloat_ratio double precision, OUT i_is_na boolean) TO admin;
GRANT ALL ON FUNCTION metric_helpers.get_btree_bloat_approx(OUT i_database name, OUT i_schema_name name, OUT i_table_name name, OUT i_index_name name, OUT i_real_size numeric, OUT i_extra_size numeric, OUT i_extra_ratio double precision, OUT i_fill_factor integer, OUT i_bloat_size double precision, OUT i_bloat_ratio double precision, OUT i_is_na boolean) TO robot_zmon;


--
-- Name: FUNCTION get_table_bloat_approx(OUT t_database name, OUT t_schema_name name, OUT t_table_name name, OUT t_real_size numeric, OUT t_extra_size double precision, OUT t_extra_ratio double precision, OUT t_fill_factor integer, OUT t_bloat_size double precision, OUT t_bloat_ratio double precision, OUT t_is_na boolean); Type: ACL; Schema: metric_helpers; Owner: postgres
--

REVOKE ALL ON FUNCTION metric_helpers.get_table_bloat_approx(OUT t_database name, OUT t_schema_name name, OUT t_table_name name, OUT t_real_size numeric, OUT t_extra_size double precision, OUT t_extra_ratio double precision, OUT t_fill_factor integer, OUT t_bloat_size double precision, OUT t_bloat_ratio double precision, OUT t_is_na boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION metric_helpers.get_table_bloat_approx(OUT t_database name, OUT t_schema_name name, OUT t_table_name name, OUT t_real_size numeric, OUT t_extra_size double precision, OUT t_extra_ratio double precision, OUT t_fill_factor integer, OUT t_bloat_size double precision, OUT t_bloat_ratio double precision, OUT t_is_na boolean) TO admin;
GRANT ALL ON FUNCTION metric_helpers.get_table_bloat_approx(OUT t_database name, OUT t_schema_name name, OUT t_table_name name, OUT t_real_size numeric, OUT t_extra_size double precision, OUT t_extra_ratio double precision, OUT t_fill_factor integer, OUT t_bloat_size double precision, OUT t_bloat_ratio double precision, OUT t_is_na boolean) TO robot_zmon;


--
-- Name: FUNCTION pg_stat_statements(showtext boolean); Type: ACL; Schema: metric_helpers; Owner: postgres
--

REVOKE ALL ON FUNCTION metric_helpers.pg_stat_statements(showtext boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION metric_helpers.pg_stat_statements(showtext boolean) TO admin;
GRANT ALL ON FUNCTION metric_helpers.pg_stat_statements(showtext boolean) TO robot_zmon;


--
-- Name: FUNCTION pg_switch_wal(); Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT ALL ON FUNCTION pg_catalog.pg_switch_wal() TO admin;


--
-- Name: FUNCTION pg_stat_statements_reset(userid oid, dbid oid, queryid bigint); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint) TO admin;


--
-- Name: FUNCTION set_user(text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_user(text) TO admin;


--
-- Name: FUNCTION create_application_user(username text); Type: ACL; Schema: user_management; Owner: postgres
--

REVOKE ALL ON FUNCTION user_management.create_application_user(username text) FROM PUBLIC;
GRANT ALL ON FUNCTION user_management.create_application_user(username text) TO admin;


--
-- Name: FUNCTION create_application_user_or_change_password(username text, password text); Type: ACL; Schema: user_management; Owner: postgres
--

REVOKE ALL ON FUNCTION user_management.create_application_user_or_change_password(username text, password text) FROM PUBLIC;
GRANT ALL ON FUNCTION user_management.create_application_user_or_change_password(username text, password text) TO admin;


--
-- Name: FUNCTION create_role(rolename text); Type: ACL; Schema: user_management; Owner: postgres
--

REVOKE ALL ON FUNCTION user_management.create_role(rolename text) FROM PUBLIC;
GRANT ALL ON FUNCTION user_management.create_role(rolename text) TO admin;


--
-- Name: FUNCTION create_user(username text); Type: ACL; Schema: user_management; Owner: postgres
--

REVOKE ALL ON FUNCTION user_management.create_user(username text) FROM PUBLIC;
GRANT ALL ON FUNCTION user_management.create_user(username text) TO admin;


--
-- Name: FUNCTION drop_role(username text); Type: ACL; Schema: user_management; Owner: postgres
--

REVOKE ALL ON FUNCTION user_management.drop_role(username text) FROM PUBLIC;
GRANT ALL ON FUNCTION user_management.drop_role(username text) TO admin;


--
-- Name: FUNCTION drop_user(username text); Type: ACL; Schema: user_management; Owner: postgres
--

REVOKE ALL ON FUNCTION user_management.drop_user(username text) FROM PUBLIC;
GRANT ALL ON FUNCTION user_management.drop_user(username text) TO admin;


--
-- Name: FUNCTION revoke_admin(username text); Type: ACL; Schema: user_management; Owner: postgres
--

REVOKE ALL ON FUNCTION user_management.revoke_admin(username text) FROM PUBLIC;
GRANT ALL ON FUNCTION user_management.revoke_admin(username text) TO admin;


--
-- Name: FUNCTION terminate_backend(pid integer); Type: ACL; Schema: user_management; Owner: postgres
--

REVOKE ALL ON FUNCTION user_management.terminate_backend(pid integer) FROM PUBLIC;
GRANT ALL ON FUNCTION user_management.terminate_backend(pid integer) TO admin;


--
-- Name: FUNCTION get_database_cluster_information(); Type: ACL; Schema: zmon_utils; Owner: postgres
--

GRANT ALL ON FUNCTION zmon_utils.get_database_cluster_information() TO robot_zmon;


--
-- Name: FUNCTION get_database_cluster_system_information(); Type: ACL; Schema: zmon_utils; Owner: postgres
--

GRANT ALL ON FUNCTION zmon_utils.get_database_cluster_system_information() TO robot_zmon;


--
-- Name: FUNCTION get_last_status_active_cronjobs(OUT jobid bigint, OUT database text, OUT command text, OUT status text, OUT return_message text, OUT start_time timestamp with time zone, OUT end_time timestamp with time zone); Type: ACL; Schema: zmon_utils; Owner: postgres
--

REVOKE ALL ON FUNCTION zmon_utils.get_last_status_active_cronjobs(OUT jobid bigint, OUT database text, OUT command text, OUT status text, OUT return_message text, OUT start_time timestamp with time zone, OUT end_time timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION zmon_utils.get_last_status_active_cronjobs(OUT jobid bigint, OUT database text, OUT command text, OUT status text, OUT return_message text, OUT start_time timestamp with time zone, OUT end_time timestamp with time zone) TO robot_zmon;


--
-- Name: TABLE job; Type: ACL; Schema: cron; Owner: postgres
--

REVOKE SELECT ON TABLE cron.job FROM PUBLIC;
GRANT SELECT ON TABLE cron.job TO cron_admin;


--
-- Name: COLUMN job.nodename; Type: ACL; Schema: cron; Owner: postgres
--

GRANT UPDATE(nodename) ON TABLE cron.job TO cron_admin;


--
-- Name: COLUMN job.database; Type: ACL; Schema: cron; Owner: postgres
--

GRANT UPDATE(database) ON TABLE cron.job TO cron_admin;


--
-- Name: TABLE job_run_details; Type: ACL; Schema: cron; Owner: postgres
--

REVOKE SELECT,DELETE ON TABLE cron.job_run_details FROM PUBLIC;
GRANT DELETE ON TABLE cron.job_run_details TO PUBLIC;
GRANT SELECT ON TABLE cron.job_run_details TO cron_admin;


--
-- Name: TABLE index_bloat; Type: ACL; Schema: metric_helpers; Owner: postgres
--

GRANT SELECT ON TABLE metric_helpers.index_bloat TO admin;
GRANT SELECT ON TABLE metric_helpers.index_bloat TO robot_zmon;


--
-- Name: TABLE pg_stat_statements; Type: ACL; Schema: metric_helpers; Owner: postgres
--

GRANT SELECT ON TABLE metric_helpers.pg_stat_statements TO admin;
GRANT SELECT ON TABLE metric_helpers.pg_stat_statements TO robot_zmon;


--
-- Name: TABLE table_bloat; Type: ACL; Schema: metric_helpers; Owner: postgres
--

GRANT SELECT ON TABLE metric_helpers.table_bloat TO admin;
GRANT SELECT ON TABLE metric_helpers.table_bloat TO robot_zmon;


--
-- Name: TABLE pg_stat_activity; Type: ACL; Schema: pg_catalog; Owner: postgres
--

GRANT SELECT ON TABLE pg_catalog.pg_stat_activity TO admin;


--
-- Name: TABLE postgres_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.postgres_log TO admin;


--
-- Name: TABLE postgres_log_0; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.postgres_log_0 TO admin;


--
-- Name: TABLE failed_authentication_0; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.failed_authentication_0 TO robot_zmon;


--
-- Name: TABLE postgres_log_1; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.postgres_log_1 TO admin;


--
-- Name: TABLE failed_authentication_1; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.failed_authentication_1 TO robot_zmon;


--
-- Name: TABLE postgres_log_2; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.postgres_log_2 TO admin;


--
-- Name: TABLE failed_authentication_2; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.failed_authentication_2 TO robot_zmon;


--
-- Name: TABLE postgres_log_3; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.postgres_log_3 TO admin;


--
-- Name: TABLE failed_authentication_3; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.failed_authentication_3 TO robot_zmon;


--
-- Name: TABLE postgres_log_4; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.postgres_log_4 TO admin;


--
-- Name: TABLE failed_authentication_4; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.failed_authentication_4 TO robot_zmon;


--
-- Name: TABLE postgres_log_5; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.postgres_log_5 TO admin;


--
-- Name: TABLE failed_authentication_5; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.failed_authentication_5 TO robot_zmon;


--
-- Name: TABLE postgres_log_6; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.postgres_log_6 TO admin;


--
-- Name: TABLE failed_authentication_6; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.failed_authentication_6 TO robot_zmon;


--
-- Name: TABLE postgres_log_7; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.postgres_log_7 TO admin;


--
-- Name: TABLE failed_authentication_7; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.failed_authentication_7 TO robot_zmon;


--
-- Name: TABLE pg_auth_mon; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.pg_auth_mon TO robot_zmon;


--
-- Name: TABLE last_status_active_cronjobs; Type: ACL; Schema: zmon_utils; Owner: postgres
--

GRANT SELECT ON TABLE zmon_utils.last_status_active_cronjobs TO robot_zmon;


--
-- PostgreSQL database dump complete
--

