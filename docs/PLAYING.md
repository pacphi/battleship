# Playing the Game

**For:** anyone who just wants to play. No account, no installing anything — just a browser.

> Someone needs to **host** the game and share a link with you. If that's you too, see
> **[Hosting a game](HOSTING.md)** first, then come back here to actually play.

## What you need

- A modern browser: Chrome, Firefox, Edge, or Safari.
- The **game link** (a web address someone shared with you). If you're playing on a
  Cognitum One Seed device, the link comes from the Seed dashboard — it looks different
  from a tunnel link, but works the same way.
- The **6-character code** from whoever you're playing against.

That's everything. There's nothing to download and no sign-up.

## Start a game (you go first)

1. Open the game link in your browser.
2. Pick a **game mode** (the three choices are explained below):
   - **Round-Based** — fast, 3 seconds per round.
   - **Queue-Based** — relaxed, fire whenever you like.
   - **Hybrid** — a mix of both.
3. Click **Create Game**. You'll get a **6-character code**.
4. Send that code to your opponent (text, chat, DM — however you like).
5. Wait for them to join, and the battle begins.

> ⏳ The code is good for **30 seconds**. If nobody joins in time, just click **Create
> Game** again for a fresh one.

## Join a game (a friend invited you)

1. Open the **same game link** your friend used.
2. Pick the **same game mode** they did.
3. Type in the **6-character code** they sent you.
4. Click **Join Game**.

## How to play

- The **left board** is _your fleet_ — your ships, which only you can see.
- The **right board** is _enemy waters_ — click any square to fire at your opponent.
- **Both players fire at the same time**, every round.
- First player to **sink all 6 enemy ships wins**.
- A sunk ship is revealed on the board. Submarines stay hidden until they're hit.

## The fleet

| Ship          | Size      | What's special about it                                                  |
| ------------- | --------- | ------------------------------------------------------------------------ |
| Carrier       | 5 squares | The big one.                                                             |
| Battleship    | 4 squares | Heavy hitter.                                                            |
| Heavy Cruiser | 3 squares | Standard.                                                                |
| Light Cruiser | 3 squares | Standard.                                                                |
| Submarine     | 2 squares | **Invisible until you hit it** — then it shows. Vanishes when sunk.      |
| Torpedo Boat  | 2 squares | **Sneaky** — slides to a nearby square whenever your opponent misses it. |

## The three game modes

**Round-Based** — A 3-second timer each round. Both players pick a target before time runs
out. If you don't act in time, the game fires your first un-shot square for you. The
fastest way to play.

**Queue-Based** — No timer. Fire whenever you're ready; the round resolves once both
players have fired. (If you go idle for 15 seconds, the game picks a target for you.) The
most relaxed way to play.

**Hybrid** — A 3-second round timer, but if only one player has fired when it runs out, the
other gets a 5-second grace period to catch up. A fair middle ground.

> Both players should choose the **same mode**.

## If something goes wrong

| What you see                  | What to do                                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------------- |
| **"Connection failed"**       | Make sure your browser allows WebRTC; some strict firewalls/VPNs block it. Try a different network. |
| **Game says code is invalid** | The code expires after 30 seconds — ask your opponent to create a new one.                          |
| **"Opponent disconnected"**   | They closed the tab or lost connection. Start a new game.                                           |
| **Connection drops mid-game** | Often it keeps going on its own. If not, refresh the page and rejoin with the same code.            |

## A note on privacy

After the first handshake, the game connects the two browsers **directly to each other**.
Your moves travel straight between you and your opponent — they don't pass through any game
server. (Curious how? The [Hosting guide](HOSTING.md#how-it-works-under-the-hood) has a
diagram.)
