/**
 * Leaf · Migration 006 — OnlineMusic 模块 schema
 *
 * OnlineMusicDataStore 用 6 张表（liked tracks / playlists / albums / artists / mvs + playHistory）。
 * 5-2 时漏了 schema，现在 5-6c 补齐。
 *
 * 表设计：
 * - om_liked_tracks(id, name, artists_json, album_json, duration, liked_at, deleted_at)
 * - om_liked_playlists(id, name, pic_url, cover_img_url, liked_at)
 * - om_liked_albums(id, name, pic_url, artist_json, artists_json, liked_at)
 * - om_liked_artists(id, name, pic_url, img1v1_url, liked_at)
 * - om_liked_mvs(id, name, artist_name, artist_id, cover, imgurl16v9, cover_url, duration, publish_time, liked_at)
 * - om_play_history(id, name, artists_json, album_json, duration, played_at)
 * - om_user_playlists(id, name, creator, description, cover_url, track_ids_json, sync_status, created_at, updated_at)
 *
 * artists / album 用 JSON 存（关系简单，原 store 也是嵌套 JSON）
 * user_playlists 简化（按原 store UserPlaylist 字段集）
 */

import type { Migration } from '.'

export const m006_online_music_schema: Migration = {
  version: 6,
  name: 'online_music_module_schema',
  up(db) {
    // 1) liked tracks
    db.exec(`
      CREATE TABLE IF NOT EXISTS om_liked_tracks (
        id          INTEGER PRIMARY KEY,
        name        TEXT    NOT NULL,
        artists     TEXT    NOT NULL DEFAULT '[]',
        album       TEXT    NOT NULL DEFAULT '{}',
        duration    INTEGER NOT NULL DEFAULT 0,
        liked_at    INTEGER NOT NULL,
        deleted_at  INTEGER
      )
    `)
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_om_liked_tracks_liked_at ON om_liked_tracks(liked_at DESC)`
    )

    // 2) liked playlists
    db.exec(`
      CREATE TABLE IF NOT EXISTS om_liked_playlists (
        id          INTEGER PRIMARY KEY,
        name        TEXT    NOT NULL,
        pic_url     TEXT,
        cover_img_url TEXT,
        liked_at    INTEGER NOT NULL,
        deleted_at  INTEGER
      )
    `)

    // 3) liked albums
    db.exec(`
      CREATE TABLE IF NOT EXISTS om_liked_albums (
        id          INTEGER PRIMARY KEY,
        name        TEXT    NOT NULL,
        pic_url     TEXT,
        artist      TEXT,
        artists     TEXT,
        liked_at    INTEGER NOT NULL,
        deleted_at  INTEGER
      )
    `)

    // 4) liked artists
    db.exec(`
      CREATE TABLE IF NOT EXISTS om_liked_artists (
        id          INTEGER PRIMARY KEY,
        name        TEXT    NOT NULL,
        pic_url     TEXT,
        img1v1_url  TEXT,
        liked_at    INTEGER NOT NULL,
        deleted_at  INTEGER
      )
    `)

    // 5) liked mvs
    db.exec(`
      CREATE TABLE IF NOT EXISTS om_liked_mvs (
        id          INTEGER PRIMARY KEY,
        name        TEXT    NOT NULL,
        artist_name TEXT,
        artist_id   INTEGER,
        cover       TEXT,
        imgurl16v9  TEXT,
        cover_url   TEXT,
        duration    INTEGER,
        publish_time TEXT,
        liked_at    INTEGER NOT NULL,
        deleted_at  INTEGER
      )
    `)

    // 6) play history
    db.exec(`
      CREATE TABLE IF NOT EXISTS om_play_history (
        id          INTEGER PRIMARY KEY,
        name        TEXT    NOT NULL,
        artists     TEXT    NOT NULL DEFAULT '[]',
        album       TEXT    NOT NULL DEFAULT '{}',
        duration    INTEGER NOT NULL DEFAULT 0,
        played_at   INTEGER NOT NULL
      )
    `)
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_om_play_history_played_at ON om_play_history(played_at DESC)`
    )

    // 7) user playlists（tracks 用 JSON 数组；每条带 orderIndex）
    db.exec(`
      CREATE TABLE IF NOT EXISTS om_user_playlists (
        id          TEXT    PRIMARY KEY,
        name        TEXT    NOT NULL,
        creator     TEXT,
        description TEXT,
        cover_url   TEXT,
        pic_url     TEXT,
        cover_img_url TEXT,
        tracks      TEXT    NOT NULL DEFAULT '[]',
        sync_status TEXT    NOT NULL DEFAULT 'local',
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL,
        deleted_at  INTEGER
      )
    `)
  }
}
