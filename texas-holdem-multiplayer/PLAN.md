# Texas Holdem Multiplayer MVP Plan (Implemented)

## Goal
- Build a local runnable 2–10 player Texas Hold'em H5 demo with virtual chips only.
- Support room create/join, ready/start, invite link (`?roomId=`), authoritative server sync, reconnect state sync.
- Add all-in and side-pot settlement, configurable starting chips before hand start, bust-out auto-spectate / manual leave.

## Chosen Route
- Route A: reuse `ptwu/distributed-texasholdem` repo as base, then replace core server/client with a leaner MVP implementation.
- Reused mature components:
  - `socket.io` for multiplayer transport/sync
  - `pokersolver` for showdown hand evaluation

## Scope Kept
- 2–10 players per room
- Ready + host start
- Preflop/Flop/Turn/River betting
- Actions: check/call/raise/fold/all-in
- Side pots at showdown
- Invite link copy button + `?roomId=` auto rejoin/join flow
- Disconnect/reconnect full state sync
- Bust auto-spectator + leave room

## Scope Deferred
- Rebuy / top-up chips
- Tournament/multi-table/AI
- WeChat JS-SDK share metadata/signature flow (copy link only)
- Rich animations / heavy UI assets

## Core Architecture
- `src/app.js`: Express + Socket.IO server, room registry, event routing
- `src/engine/holdemRoom.js`: authoritative room/game state machine
- `src/engine/payout.js`: side-pot construction and showdown settlement via `pokersolver`
- `src/client/*`: mobile-first vanilla H5 UI

## Validation Performed
- Unit tests for side-pot construction and settlement
- Manual 2-window multiplayer test:
  - create room
  - join by roomId
  - change starting chips before start
  - ready + start hand
  - all-in + call -> showdown
  - bust player auto-spectates
  - spectator leaves room

## Compliance
- Virtual chips only, no real-money transactions
- README and UI include visible educational/entertainment disclaimer
