# Hosting a Game

**For:** the person who wants to **start** a game so friends can join from their own
computers — at a LAN party, across the house, or across the world.

You'll use a terminal a little, but the **guided setup walks you through every step**, so
you don't need to know what any of it means.

> **Have a Cognitum One Seed device?** It can host the game natively — no tunnel, no
> laptop required. See **[Hosting on a Seed](SEED.md)** instead.

---

## First, the big picture

The game runs on **your** computer. For a friend on another computer to reach it, you open a
**tunnel** — a temporary public web link that points to your machine. You share that one
link; your friend opens it; you both play.

```
Your computer  ──►  tunnel  ──►  one public link  ──►  your friend's browser
```

The tunnel is provided by a free service. You have two choices:

| Service   | Best when…                                                     | Installs…                       |
| --------- | -------------------------------------------------------------- | ------------------------------- |
| **zrok**  | You want the simplest, self-contained option (**recommended**) | just into this project's folder |
| **ngrok** | You already use ngrok, or prefer a widely-used tool            | onto your whole computer        |

Both need a **free account** and a one-time **token** (a sign-in key). The guided setup
helps you get one.

> **Just testing on your own machine?** You don't need a tunnel at all. See
> [Play locally first](#play-locally-first-no-tunnel-no-account) at the bottom.

---

## The easy way: guided setup

From the project folder, run:

```bash
pnpm tunnel:setup
```

It asks you a few plain questions and handles the rest:

1. **Which tunnel?** zrok (recommended) or ngrok.
2. **Install it?** If it's not installed yet, it offers to install it for you.
3. **Sign in.** It shows you exactly where to get your free token, then takes it and saves it.
4. **Build the game** if it hasn't been built yet.
5. **Health check** so you can see everything is ready (this is `pnpm tunnel:doctor`).
6. **Start hosting** — it opens your public link, ready to share.

When it finishes starting, you'll see a public URL in the terminal. **That's the link you
share.** Your friend opens it, you swap a 6-character code (see
**[Playing](PLAYING.md)**), and you're off.

> **Windows:** run the helper directly:
>
> ```powershell
> .\scripts\tunnel-setup.pwsh setup
> ```

That's genuinely all most people need. The rest of this page is reference — read it only if
you want the details or hit a snag.

---

## Where do I get a token?

A token is a free one-time sign-in key. You get it once, the setup saves it, and you never
need it again on this computer.

### zrok

1. Sign up (free) at **<https://zrok.io>**.
2. The web console shows your **token** and the exact command to enable it.
3. The guided setup will ask you to paste that token — or you can run it yourself:

   ```bash
   .tools/bin/zrok2 enable <your-token>
   ```

### ngrok

1. Sign up (free) at **<https://dashboard.ngrok.com/signup>**.
2. Copy your authtoken from **<https://dashboard.ngrok.com/get-started/your-authtoken>**.
3. The guided setup will ask you to paste it — or run it yourself:

   ```bash
   ngrok config add-authtoken <your-token>
   ```

> **What happens if I skip the token?** The tunnel won't start. The tools require sign-in.
> The health check (`pnpm tunnel:doctor`) will tell you if a token is still missing, and
> hosting will stop early with a clear message instead of failing halfway.

---

## Check your setup anytime

```bash
pnpm tunnel:doctor
```

This prints a quick, friendly status report — Node and pnpm, whether the game is built,
whether your port is free, and for **each** tunnel: installed? signed in? ready to host? It
tells you the exact next command for anything that isn't ready.

---

## The manual commands (if you skip the wizard)

You don't need these if you used `pnpm tunnel:setup`. They're here for reference.

### zrok (recommended — installs only into this project)

```bash
# Install a verified, project-local copy of zrok
pnpm tunnel:install:zrok

# Sign in once with your token (see "Where do I get a token?")
.tools/bin/zrok2 enable <your-token>

# Build, start the local server, and open your public link
pnpm tunnel:zrok

# Remove the project-local zrok when you're done
pnpm tunnel:uninstall:zrok
```

**Windows:**

```powershell
.\scripts\tunnel-setup.pwsh install zrok -Scope project
.\.tools\bin\zrok2.cmd enable <your-token>
.\scripts\tunnel-setup.pwsh run zrok
.\scripts\tunnel-setup.pwsh uninstall zrok -Scope project
```

> On Windows ARM64, the installer uses zrok's Windows x64 build under compatibility, because
> zrok doesn't publish a Windows ARM64 build yet.

### ngrok (installs on your whole computer)

ngrok installs **system-wide** through your operating system's package manager, not into
this project. (zrok publishes verified checksums so we can safely manage a project-local
copy; ngrok doesn't, so we hand off to its official installer instead.)

```bash
# Install ngrok via Homebrew / apt / snap (may ask for your password)
pnpm tunnel:install:ngrok

# Sign in once with your authtoken
ngrok config add-authtoken <your-token>

# Build, start the local server, and open your public link
pnpm tunnel:ngrok

# Remove ngrok
pnpm tunnel:uninstall:ngrok
```

**Windows:**

```powershell
.\scripts\tunnel-setup.pwsh install ngrok -Scope user
ngrok config add-authtoken <your-token>
.\scripts\tunnel-setup.pwsh run ngrok
.\scripts\tunnel-setup.pwsh uninstall ngrok -Scope user
```

### Which platforms work?

zrok (managed, checksum-verified) is supported on:

- macOS ARM64
- Linux x64, ARM64, ARMv7 (Debian, Ubuntu, Fedora, Alpine, SUSE, Arch, and other distros
  that can run the upstream binary)
- Windows x64 (and Windows ARM64 via x64 compatibility)

ngrok installs through official native installers where available — Homebrew (macOS),
ngrok's apt repo or snap (Linux), winget or Scoop (Windows). On other Linux distros, install
ngrok from <https://ngrok.com/download>, then run `pnpm tunnel:ngrok`.

---

## Play locally first (no tunnel, no account)

Before inviting anyone, you can play against yourself in two browser tabs to confirm it all
works:

```bash
pnpm install     # one time
pnpm build
pnpm server      # serves the game on http://localhost:4321
```

Open **two tabs** at `http://localhost:4321`. Create a game in one, join with the code in
the other. If that works, hosting over a tunnel will work the same way — just with a public
link instead of `localhost`.

---

## How it works under the hood

```
Browser (Player A) ──┐
                     ├──► public tunnel link
Browser (Player B) ──┘            │
                              zrok / ngrok
                                  │
                       http://localhost:4321
                  (your machine: game files + signaling)
                                  │
                  direct browser-to-browser connection ──► all game moves
```

The tunnel is only used for the **introduction** between the two browsers. Once they've
shaken hands, the browsers talk **directly to each other**, and the game data stops going
through the tunnel entirely. If your tunnel drops mid-game, the game keeps going — you only
need the tunnel again to let **new** players join.

This is also why your moves are private: the tunnel and the local server never see them.

---

## If something goes wrong

| Problem                                            | What to do                                                                                         |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `pnpm tunnel:setup` says a tool isn't installed    | Let it install it, or run `pnpm tunnel:install:zrok` / `pnpm tunnel:install:ngrok`.                |
| Hosting stops with "not enabled" / "authtoken"     | You haven't signed in. See [Where do I get a token?](#where-do-i-get-a-token).                     |
| **"Signaling connection failed"** (in the browser) | The tunnel must point at your local server on port 4321. Restart `pnpm tunnel:zrok`.               |
| **Port 4321 is busy**                              | Another program is using it. Close it, or run with a different port: `PORT=5000 pnpm tunnel:zrok`. |
| **WebRTC handshake hangs**                         | Some networks block the discovery servers (`stun.l.google.com:19302`). Try another network.        |
| **Tunnel drops mid-game**                          | The game continues. To let new players join, restart the tunnel and refresh with the same code.    |
| **zrok2 not found**                                | Run `pnpm tunnel:install:zrok`, or add `.tools/bin` to your PATH.                                  |

Still stuck? Run `pnpm tunnel:doctor` — it usually points straight at the problem.
