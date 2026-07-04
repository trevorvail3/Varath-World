# World shared leaderboard — Supabase setup (one-time, ~2 minutes)

World reuses your **existing Supabase project** (the same one the idle game uses
for sign-in). Players sign into World with the **same email + password**, and
their scores attach to their real account. You only need to create one table.

The project URL and publishable key are already baked into the game
(`src/client/supabase.ts`) — they're public by design; security is the
Row-Level-Security (RLS) rules below.

## Create the table + security rules

1. Open your Supabase dashboard → **SQL Editor** → **New query**.
2. Paste **all** of this and click **Run**:

```sql
-- One row per signed-in user: their best World character's stats.
create table if not exists public.world_hiscores (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  name          text not null,
  total_level   integer not null default 0,
  combat        integer not null default 0,
  play_ms       bigint  not null default 0,
  diaries       integer not null default 0,
  monsters_slain integer not null default 0,
  gold_earned   bigint  not null default 0,
  skills        jsonb   not null default '{}'::jsonb,
  updated_at    timestamptz not null default now()
);

-- If the table already exists from an earlier version, add the skills column.
alter table public.world_hiscores
  add column if not exists skills jsonb not null default '{}'::jsonb;

-- Turn on Row-Level Security and define who can do what.
alter table public.world_hiscores enable row level security;

-- Anyone (even signed-out) can READ the board.
drop policy if exists "world_hiscores_read" on public.world_hiscores;
create policy "world_hiscores_read"
  on public.world_hiscores for select
  using (true);

-- You can INSERT only your own row.
drop policy if exists "world_hiscores_insert_own" on public.world_hiscores;
create policy "world_hiscores_insert_own"
  on public.world_hiscores for insert
  with check (auth.uid() = user_id);

-- You can UPDATE only your own row (the upsert path).
drop policy if exists "world_hiscores_update_own" on public.world_hiscores;
create policy "world_hiscores_update_own"
  on public.world_hiscores for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

That's it. Open the game → **World** tab → **Hiscores** → **Sign in** with your
idle-game account. Your stats upload each time you open the board, and the
rankings are shared with everyone who plays World.

## Cloud saves — second table (run this too)

So a character follows your account to any device, add the saves table. Same SQL
editor, paste and **Run**:

```sql
-- One row per signed-in user: their character's full save blob.
create table if not exists public.world_saves (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.world_saves enable row level security;

-- Saves are PRIVATE: you can only read your own.
drop policy if exists "world_saves_read_own" on public.world_saves;
create policy "world_saves_read_own"
  on public.world_saves for select
  using (auth.uid() = user_id);

-- And only write/replace/delete your own.
drop policy if exists "world_saves_insert_own" on public.world_saves;
create policy "world_saves_insert_own"
  on public.world_saves for insert
  with check (auth.uid() = user_id);

drop policy if exists "world_saves_update_own" on public.world_saves;
create policy "world_saves_update_own"
  on public.world_saves for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "world_saves_delete_own" on public.world_saves;
create policy "world_saves_delete_own"
  on public.world_saves for delete
  using (auth.uid() = user_id);
```

Now your character loads from the cloud at sign-in and uploads as you play. Sign
in on another device and the same character is there. (Unlike the hiscores
board, saves are private — the RLS rules above let you read only your own.)

## Ghosts — third table (run this too)

So you can see other signed-in players moving around the world as translucent
"ghosts". Each player publishes a lightweight presence (position + look + zone);
everyone reads the recent ones for their area. Same SQL editor, paste and **Run**:

```sql
-- One row per signed-in user: where they are right now.
create table if not exists public.world_presence (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text,
  x          double precision not null default 0,
  y          double precision not null default 0,
  zone       text not null default 'overworld',
  look       jsonb,
  updated_at timestamptz not null default now()
);

alter table public.world_presence enable row level security;

-- Anyone signed in can SEE everyone's presence (that's the point of ghosts).
drop policy if exists "world_presence_read" on public.world_presence;
create policy "world_presence_read"
  on public.world_presence for select
  using (true);

-- But you can only write/replace your own position.
drop policy if exists "world_presence_insert_own" on public.world_presence;
create policy "world_presence_insert_own"
  on public.world_presence for insert
  with check (auth.uid() = user_id);

drop policy if exists "world_presence_update_own" on public.world_presence;
create policy "world_presence_update_own"
  on public.world_presence for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

Now when two signed-in players are in the same area, they'll see each other as
faint figures with name labels. (Players inside their own house don't show to
others — interiors are private instances.)

## Unique character names (run this block too)

Every character name is globally unique: the `world_names` table holds one row
per taken name (lower-cased as the primary key, so "Rook" and "rook" collide),
tied to the account that owns it. The client checks availability as you type and
does an atomic claim when you press **Enter Varath** — the primary key is what
actually enforces uniqueness, so two people racing for the same name can't both
win. Until you run this block the game still works; names just aren't enforced
unique yet. Same SQL editor, paste and **Run**:

```sql
-- One row per taken character name. `name` is lower-cased; the primary key is
-- the uniqueness guarantee. `display` keeps the original casing for show.
create table if not exists public.world_names (
  name       text primary key,
  display    text,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.world_names enable row level security;

-- Anyone (even signed out) can check whether a name is free.
drop policy if exists "world_names_read" on public.world_names;
create policy "world_names_read"
  on public.world_names for select
  using (true);

-- You may only claim a name for your own account.
drop policy if exists "world_names_insert_own" on public.world_names;
create policy "world_names_insert_own"
  on public.world_names for insert
  with check (auth.uid() = user_id);

-- And only release one you own (for a future rename feature).
drop policy if exists "world_names_delete_own" on public.world_names;
create policy "world_names_delete_own"
  on public.world_names for delete
  using (auth.uid() = user_id);
```

Because the row references `auth.users` with `on delete cascade`, deleting an
account automatically frees its name for someone else.

## Grand Exchange — the marketplace (run this block too)

A player-driven order book with a server-held escrow: gold/items you list move
into Exchange tables, and trades settle atomically in the database so there are
no dupes or half-trades, even when both players are offline. Paste and **Run**
the whole block:

```sql
-- ===== Tables =====
create table if not exists public.ge_wallet (
  user_id uuid primary key references auth.users (id) on delete cascade,
  gold    bigint not null default 0
);
create table if not exists public.ge_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  item    text not null,
  qty     bigint not null,
  primary key (user_id, item)
);
create table if not exists public.ge_orders (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  side       text not null check (side in ('buy','sell')),
  item       text not null,
  qty        bigint not null check (qty > 0),
  filled     bigint not null default 0,
  price      bigint not null check (price > 0),
  status     text not null default 'open' check (status in ('open','filled','cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists ge_orders_book on public.ge_orders (item, side, status, price);
create table if not exists public.ge_trades (
  id     bigint generated always as identity primary key,
  item   text not null,
  qty    bigint not null,
  price  bigint not null,
  buyer  uuid,
  seller uuid,
  at     timestamptz not null default now()
);
create index if not exists ge_trades_item on public.ge_trades (item, at desc);

-- ===== RLS: read the public book / your own balances; write only via functions =====
alter table public.ge_wallet enable row level security;
alter table public.ge_items  enable row level security;
alter table public.ge_orders enable row level security;
alter table public.ge_trades enable row level security;

drop policy if exists ge_wallet_read on public.ge_wallet;
create policy ge_wallet_read on public.ge_wallet for select using (auth.uid() = user_id);
drop policy if exists ge_items_read on public.ge_items;
create policy ge_items_read on public.ge_items for select using (auth.uid() = user_id);
drop policy if exists ge_orders_read on public.ge_orders;
create policy ge_orders_read on public.ge_orders for select using (true);
drop policy if exists ge_trades_read on public.ge_trades;
create policy ge_trades_read on public.ge_trades for select using (true);
-- (No insert/update/delete policies: all writes go through the functions below,
--  which run as the table owner and validate the caller.)

-- ===== Deposit / withdraw (the trust boundary: client moves it locally too) =====
create or replace function public.ge_deposit_gold(amount bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if amount <= 0 then raise exception 'bad amount'; end if;
  insert into ge_wallet(user_id, gold) values (auth.uid(), amount)
    on conflict (user_id) do update set gold = ge_wallet.gold + excluded.gold;
end $$;

create or replace function public.ge_withdraw_gold(amount bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare cur bigint;
begin
  if amount <= 0 then raise exception 'bad amount'; end if;
  select gold into cur from ge_wallet where user_id = auth.uid() for update;
  if cur is null or cur < amount then raise exception 'insufficient gold'; end if;
  update ge_wallet set gold = gold - amount where user_id = auth.uid();
  return cur - amount;
end $$;

create or replace function public.ge_deposit_item(p_item text, p_qty bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_qty <= 0 then raise exception 'bad qty'; end if;
  insert into ge_items(user_id, item, qty) values (auth.uid(), p_item, p_qty)
    on conflict (user_id, item) do update set qty = ge_items.qty + excluded.qty;
end $$;

create or replace function public.ge_withdraw_item(p_item text, p_qty bigint)
returns void language plpgsql security definer set search_path = public as $$
declare cur bigint;
begin
  if p_qty <= 0 then raise exception 'bad qty'; end if;
  select qty into cur from ge_items where user_id = auth.uid() and item = p_item for update;
  if cur is null or cur < p_qty then raise exception 'insufficient items'; end if;
  if cur = p_qty then delete from ge_items where user_id = auth.uid() and item = p_item;
  else update ge_items set qty = qty - p_qty where user_id = auth.uid() and item = p_item;
  end if;
end $$;

-- ===== Place an order: reserve, then match atomically against the book =====
create or replace function public.ge_place_order(p_side text, p_item text, p_qty bigint, p_price bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  remaining bigint := p_qty;
  oid bigint;
  r record;
  tq bigint;
  tp bigint;
  w bigint;
  inv bigint;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_qty <= 0 or p_price <= 0 then raise exception 'bad args'; end if;
  if p_side not in ('buy','sell') then raise exception 'bad side'; end if;

  -- Reserve the cost up front so it can't be double-spent while resting.
  if p_side = 'buy' then
    select gold into w from ge_wallet where user_id = uid for update;
    if w is null or w < p_qty * p_price then raise exception 'insufficient gold'; end if;
    update ge_wallet set gold = gold - p_qty * p_price where user_id = uid;
  else
    select qty into inv from ge_items where user_id = uid and item = p_item for update;
    if inv is null or inv < p_qty then raise exception 'insufficient items'; end if;
    if inv = p_qty then delete from ge_items where user_id = uid and item = p_item;
    else update ge_items set qty = qty - p_qty where user_id = uid and item = p_item;
    end if;
  end if;

  insert into ge_orders(user_id, side, item, qty, price, filled, status)
    values (uid, p_side, p_item, p_qty, p_price, 0, 'open') returning id into oid;

  if p_side = 'buy' then
    for r in
      select * from ge_orders
       where item = p_item and side = 'sell' and status = 'open'
         and price <= p_price and user_id <> uid
       order by price asc, created_at asc for update
    loop
      exit when remaining <= 0;
      tq := least(remaining, r.qty - r.filled);
      tp := r.price; -- trade at the resting order's price
      insert into ge_items(user_id, item, qty) values (uid, p_item, tq)
        on conflict (user_id, item) do update set qty = ge_items.qty + excluded.qty;
      insert into ge_wallet(user_id, gold) values (r.user_id, tq * tp)
        on conflict (user_id) do update set gold = ge_wallet.gold + excluded.gold;
      if p_price > tp then -- refund the buyer the spread they over-reserved
        update ge_wallet set gold = gold + tq * (p_price - tp) where user_id = uid;
      end if;
      update ge_orders set filled = filled + tq,
        status = case when filled + tq >= qty then 'filled' else 'open' end where id = r.id;
      insert into ge_trades(item, qty, price, buyer, seller) values (p_item, tq, tp, uid, r.user_id);
      remaining := remaining - tq;
    end loop;
  else
    for r in
      select * from ge_orders
       where item = p_item and side = 'buy' and status = 'open'
         and price >= p_price and user_id <> uid
       order by price desc, created_at asc for update
    loop
      exit when remaining <= 0;
      tq := least(remaining, r.qty - r.filled);
      tp := r.price; -- buyer's bid (>= our ask) — seller gets the better price
      insert into ge_wallet(user_id, gold) values (uid, tq * tp)
        on conflict (user_id) do update set gold = ge_wallet.gold + excluded.gold;
      insert into ge_items(user_id, item, qty) values (r.user_id, p_item, tq)
        on conflict (user_id, item) do update set qty = ge_items.qty + excluded.qty;
      update ge_orders set filled = filled + tq,
        status = case when filled + tq >= qty then 'filled' else 'open' end where id = r.id;
      insert into ge_trades(item, qty, price, buyer, seller) values (p_item, tq, tp, r.user_id, uid);
      remaining := remaining - tq;
    end loop;
  end if;

  update ge_orders set filled = p_qty - remaining,
    status = case when remaining <= 0 then 'filled' else 'open' end where id = oid;
  return oid;
end $$;

-- ===== Cancel an open order: refund whatever's still reserved =====
create or replace function public.ge_cancel_order(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare o ge_orders%rowtype; rem bigint;
begin
  select * into o from ge_orders where id = p_id and user_id = auth.uid() for update;
  if not found then raise exception 'no such order'; end if;
  if o.status <> 'open' then raise exception 'order not open'; end if;
  rem := o.qty - o.filled;
  update ge_orders set status = 'cancelled' where id = p_id;
  if rem > 0 then
    if o.side = 'buy' then
      update ge_wallet set gold = gold + rem * o.price where user_id = auth.uid();
    else
      insert into ge_items(user_id, item, qty) values (auth.uid(), o.item, rem)
        on conflict (user_id, item) do update set qty = ge_items.qty + excluded.qty;
    end if;
  end if;
end $$;
```

That's the marketplace. In the game: **World → Grand Exchange**. Deposit gold/items
into your Exchange account, place buy/sell offers, and trades settle automatically
against everyone else's offers — including super-rare items at whatever price the
market will bear.

## How it works
- **Read** is public: anyone can see the rankings, even before signing in.
- **Write** is locked to the owner: the RLS rules mean a signed-in user can only
  create/update *their own* row — no one can overwrite someone else's score.
- One row per user (`user_id` primary key), upserted on each board open, so the
  board always reflects each player's latest character.

## Notes
- Uses the project's **publishable** key (`sb_publishable_…`), which is safe in
  the browser. The secret `service_role` key is never used by the game.
- If sign-up says "check your email", your project has email confirmation on
  (Supabase default). Existing idle-game accounts just **sign in** — no
  confirmation needed.

## Friends (run this for the Players panel)

Lets players add each other as friends and see who's online. Names resolve via
the presence table, so no extra profile table is needed. Paste and **Run**:

```sql
create table if not exists public.friendships (
  id         bigint generated always as identity primary key,
  requester  uuid not null references auth.users (id) on delete cascade,
  addressee  uuid not null references auth.users (id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  unique (requester, addressee)
);
create index if not exists friendships_addressee on public.friendships (addressee);

alter table public.friendships enable row level security;

-- You can see any friendship you're part of.
drop policy if exists friendships_read on public.friendships;
create policy friendships_read on public.friendships for select
  using (auth.uid() = requester or auth.uid() = addressee);

-- You can send a request (as yourself, to someone else).
drop policy if exists friendships_insert on public.friendships;
create policy friendships_insert on public.friendships for insert
  with check (auth.uid() = requester and requester <> addressee);

-- The addressee can accept (update status).
drop policy if exists friendships_update on public.friendships;
create policy friendships_update on public.friendships for update
  using (auth.uid() = addressee) with check (auth.uid() = addressee);

-- Either side can remove/cancel the friendship.
drop policy if exists friendships_delete on public.friendships;
create policy friendships_delete on public.friendships for delete
  using (auth.uid() = requester or auth.uid() = addressee);
```

## World chat (run this for the chat box)

A single shared channel. Paste and **Run**:

```sql
create table if not exists public.world_chat (
  id      bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name    text,
  body    text not null check (char_length(body) between 1 and 200),
  at      timestamptz not null default now()
);
create index if not exists world_chat_at on public.world_chat (at desc);

alter table public.world_chat enable row level security;

-- Anyone signed in can read the channel.
drop policy if exists world_chat_read on public.world_chat;
create policy world_chat_read on public.world_chat for select using (true);

-- You can post only as yourself, within the length limit.
drop policy if exists world_chat_insert on public.world_chat;
create policy world_chat_insert on public.world_chat for insert
  with check (auth.uid() = user_id and char_length(body) between 1 and 200);
```

(Optional housekeeping: in the dashboard you can later add a scheduled job to
delete chat older than a few days — not required to play.)

## Player trading (run this for the live trade window)

Lets two players trade face-to-face: items + gold each way, gifts allowed, no
fee. The row is just the meeting point — goods live in each player's own save
(same trust model as the Exchange), so when both sides accept, each client
applies its own half of the swap. All changes go through the functions below so
each player can only touch their own side, and an accept can't sneak through
after the offer changed (the `rev` guard). Paste and **Run**:

```sql
create table if not exists public.trades (
  id         bigint generated always as identity primary key,
  a_user     uuid not null references auth.users (id) on delete cascade,
  b_user     uuid not null references auth.users (id) on delete cascade,
  a_name     text,
  b_name     text,
  a_items    jsonb not null default '[]',
  b_items    jsonb not null default '[]',
  a_gold     bigint not null default 0,
  b_gold     bigint not null default 0,
  a_ok       boolean not null default false,
  b_ok       boolean not null default false,
  a_done     boolean not null default false,
  b_done     boolean not null default false,
  rev        bigint not null default 0,
  status     text not null default 'offered'
             check (status in ('offered','active','settled','cancelled')),
  updated_at timestamptz not null default now()
);
create index if not exists trades_parties on public.trades (a_user, b_user, status);

alter table public.trades enable row level security;

-- You can read any trade you're part of.
drop policy if exists trades_read on public.trades;
create policy trades_read on public.trades for select
  using (auth.uid() = a_user or auth.uid() = b_user);

-- Ask someone to trade. Refuses if either of you is already mid-trade.
create or replace function public.trade_request(p_to uuid, p_my_name text, p_their_name text)
returns bigint language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); nid bigint;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_to = uid then raise exception 'cannot trade yourself'; end if;
  if exists (select 1 from trades where status in ('offered','active')
             and (a_user in (uid, p_to) or b_user in (uid, p_to))) then
    raise exception 'already trading';
  end if;
  insert into trades(a_user, b_user, a_name, b_name)
    values (uid, p_to, p_my_name, p_their_name) returning id into nid;
  return nid;
end $$;

-- The asked player accepts (opens the window) or declines.
create or replace function public.trade_respond(p_id bigint, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  update trades set status = case when p_accept then 'active' else 'cancelled' end,
                    updated_at = now()
   where id = p_id and b_user = uid and status = 'offered';
end $$;

-- Replace my side's offer. Bumps the revision and clears BOTH accepts.
create or replace function public.trade_offer(p_id bigint, p_items jsonb, p_gold bigint)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t trades;
begin
  select * into t from trades where id = p_id for update;
  if t is null or t.status <> 'active' then raise exception 'not active'; end if;
  if uid = t.a_user then
    update trades set a_items = p_items, a_gold = greatest(0, p_gold),
                      a_ok = false, b_ok = false, rev = rev + 1, updated_at = now()
     where id = p_id;
  elsif uid = t.b_user then
    update trades set b_items = p_items, b_gold = greatest(0, p_gold),
                      a_ok = false, b_ok = false, rev = rev + 1, updated_at = now()
     where id = p_id;
  else raise exception 'not your trade'; end if;
end $$;

-- Accept — but only against the revision I'm looking at. Settles when both agree.
create or replace function public.trade_confirm(p_id bigint, p_rev bigint)
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t trades;
begin
  select * into t from trades where id = p_id for update;
  if t is null or t.status <> 'active' then raise exception 'not active'; end if;
  if p_rev <> t.rev then raise exception 'offer changed'; end if;
  if uid = t.a_user then update trades set a_ok = true, updated_at = now() where id = p_id;
  elsif uid = t.b_user then update trades set b_ok = true, updated_at = now() where id = p_id;
  else raise exception 'not your trade'; end if;
  select * into t from trades where id = p_id for update;
  if t.a_ok and t.b_ok then
    update trades set status = 'settled', updated_at = now() where id = p_id;
    return 'settled';
  end if;
  return 'active';
end $$;

-- Back out (either side, any time before it settles).
create or replace function public.trade_cancel(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  update trades set status = 'cancelled', updated_at = now()
   where id = p_id and status in ('offered','active') and (a_user = uid or b_user = uid);
end $$;

-- I've applied my half of a settled swap. When both have, retire the row.
create or replace function public.trade_ack(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t trades;
begin
  select * into t from trades where id = p_id for update;
  if t is null then return; end if;
  if uid = t.a_user then update trades set a_done = true where id = p_id;
  elsif uid = t.b_user then update trades set b_done = true where id = p_id;
  end if;
  delete from trades where id = p_id and a_done and b_done;
end $$;
```

## The Duel Ring — opt-in staked PvP (run this for the duel window)

Unlike trading, duels don't need per-side RPCs. The whole safety model lives in
the game core, not the server: stakes are escrowed out of each player's own save
the moment both accept (the `DUEL_STAKE` intent), the fight is a **deterministic
lockstep simulation** both clients run from a shared seed (so neither can fake a
hit or a win — a divergence is caught by periodic state-hash checks and voids the
duel, returning both stakes), and the result is applied to each save by that
client's own idempotent `DUEL_RESOLVE`. Closing the game mid-duel forfeits the
stake (enforced on next boot). Quitting is never a way to keep it.

So the server only needs a **dumb message bus**: a single append-only table the
two clients insert tiny JSON packets into (hello / challenge / offer / confirm /
per-tick intents + state hashes) and poll. No trust lives here, so there are no
functions — just insert + read, guarded by RLS so only signed-in players can use
it. Paste and **Run**:

```sql
create table if not exists public.duel_msgs (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  payload jsonb not null
);
create index if not exists duel_msgs_id on public.duel_msgs (id);

alter table public.duel_msgs enable row level security;

-- Any signed-in player may post a duel packet…
drop policy if exists duel_msgs_insert on public.duel_msgs;
create policy duel_msgs_insert on public.duel_msgs for insert
  to authenticated with check (true);

-- …and read the recent stream (clients filter to their own duel by payload).
drop policy if exists duel_msgs_read on public.duel_msgs;
create policy duel_msgs_read on public.duel_msgs for select
  to authenticated using (true);
```

**Housekeeping (optional).** The bus is chatty — a duel is dozens of tiny rows —
so prune old packets on a schedule instead of letting the table grow forever.
If you have `pg_cron`, this clears anything older than an hour every 15 minutes:

```sql
-- select cron.schedule('prune-duel-msgs', '*/15 * * * *',
--   $$delete from public.duel_msgs where at < now() - interval '1 hour'$$);
```

Otherwise just run `delete from public.duel_msgs where at < now() - interval '1 day';`
by hand now and then. Nothing durable lives here — losing the whole table only
cancels any duel mid-handshake (which the clients treat as a void), so it is safe
to truncate at any time.

> **Note for testing.** `BusDuelTransport` (the signed-in path) can't be exercised
> from a sandbox — it needs this SQL applied against a live project and two
> authenticated sessions. The offline/local path (`LocalDuelTransport`, a
> `BroadcastChannel`) needs no backend at all and is what the automated two-tab
> browser test drives, so the duel flow is verifiable without touching prod.
