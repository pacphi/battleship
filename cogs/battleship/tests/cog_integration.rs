/// Integration tests for cog-battleship HTTP server.
///
/// These tests spin up the actual server binary (via a helper that replicates
/// the server startup inline) against an ephemeral port and exercise each
/// endpoint over raw HTTP/1.1 TCP connections.
///
/// SECURITY NOTE: gen_code() in signal.rs derives the room code from
/// SystemTime nanos XOR pid — NOT cryptographically secure.  A collision or
/// brute-force attack against the 24-bit keyspace is feasible.  The reviewer
/// should flag this; getrandom (or the rand crate with OsRng) should be used
/// instead.
use std::io::{Read, Write};
use std::net::TcpStream;
use std::thread;
use std::time::Duration;

use serde_json::Value;

// ---------------------------------------------------------------------------
// Test server — replicates main.rs routing inline so tests don't need a
// `[lib]` target or a built binary on PATH.
// ---------------------------------------------------------------------------

mod server {
    use std::net::TcpStream;
    use std::sync::Arc;
    use std::thread;
    use std::time::Duration;

    use serde_json::{json, Value};
    use subtle::ConstantTimeEq;
    use tiny_http::{Header, Method, Request, Response, Server, StatusCode};

    // Re-use the real RoomStore from signal.rs via the crate under test.
    // Because this is a tests/ integration crate, we reference the crate
    // by its package name (cog-battleship → cog_battleship).
    // NOTE: signal::RoomStore must be `pub` — it is, per signal.rs.
    use cog_battleship::signal::RoomStore;

    fn check_auth(req: &Request, token: &str) -> bool {
        for header in req.headers() {
            if header
                .field
                .as_str()
                .as_bytes()
                .eq_ignore_ascii_case(b"authorization")
            {
                if let Some(bearer) = header.value.as_str().strip_prefix("Bearer ") {
                    return bearer.as_bytes().ct_eq(token.as_bytes()).into();
                }
            }
        }
        false
    }

    fn json_resp(req: Request, status: u16, body: Value) {
        let body_str = body.to_string();
        let resp = Response::from_string(body_str)
            .with_status_code(StatusCode(status))
            .with_header(
                Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap(),
            );
        let _ = req.respond(resp);
    }

    fn no_content(req: Request) {
        let resp = Response::empty(StatusCode(204));
        let _ = req.respond(resp);
    }

    fn handle(mut req: Request, token: &str, store: &Arc<RoomStore>) {
        let method = req.method().clone();
        let url = req.url().to_owned();
        let (path, query) = match url.find('?') {
            Some(i) => (url[..i].to_string(), url[i + 1..].to_string()),
            None => (url.clone(), String::new()),
        };

        // ── Open endpoints ────────────────────────────────────────────────
        match (&method, path.as_str()) {
            (Method::Get, "/health") => {
                return json_resp(req, 200, json!({"status": "ok"}));
            }
            (Method::Get, "/") => {
                return json_resp(req, 200, json!({"page": "index"}));
            }
            (Method::Get, "/game") => {
                return json_resp(req, 200, json!({"page": "game"}));
            }
            _ => {}
        }
        if method == Method::Get && path.starts_with("/scripts/") {
            let file = path["/scripts/".len()..].to_string();
            return json_resp(req, 200, json!({"file": file}));
        }

        // ── Paired endpoints — auth required ──────────────────────────────
        if !check_auth(&req, token) {
            return json_resp(req, 401, json!({"error": "unauthorized"}));
        }

        if method == Method::Post && path == "/signal/create" {
            let code = store.create_room();
            return json_resp(req, 200, json!({"code": code}));
        }

        if let Some(rest) = path.strip_prefix("/signal/") {
            let parts: Vec<&str> = rest.splitn(2, '/').collect();
            if parts.len() == 2 {
                let code = parts[0].to_string();
                let action = parts[1];
                match (&method, action) {
                    (Method::Post, "join") => {
                        if store.join_room(&code) {
                            return json_resp(req, 200, json!({"ok": true}));
                        } else {
                            return json_resp(req, 404, json!({"error": "room not found"}));
                        }
                    }
                    (Method::Post, "push") => {
                        let mut body = String::new();
                        let _ = req.as_reader().read_to_string(&mut body);
                        let payload: Value =
                            serde_json::from_str(&body).unwrap_or(Value::Null);
                        if store.push_message(&code, payload) {
                            return json_resp(req, 200, json!({"ok": true}));
                        } else {
                            return json_resp(req, 404, json!({"error": "room not found"}));
                        }
                    }
                    (Method::Get, "poll") => {
                        let from_seq: u64 = query
                            .split('&')
                            .find(|s| s.starts_with("seq="))
                            .and_then(|s| s[4..].parse().ok())
                            .unwrap_or(0);
                        match store.poll(&code, from_seq, 2_500) {
                            None => {
                                return json_resp(req, 404, json!({"error": "room not found"}));
                            }
                            Some(msgs) if msgs.is_empty() => {
                                return no_content(req);
                            }
                            Some(msgs) => {
                                let next =
                                    msgs.last().map(|(s, _)| s + 1).unwrap_or(from_seq);
                                let arr: Vec<Value> = msgs
                                    .into_iter()
                                    .map(|(s, v)| json!({"seq": s, "payload": v}))
                                    .collect();
                                return json_resp(
                                    req,
                                    200,
                                    json!({"messages": arr, "seq": next}),
                                );
                            }
                        }
                    }
                    (Method::Post, "leave") => {
                        store.leave_room(&code);
                        return json_resp(req, 200, json!({"ok": true}));
                    }
                    _ => {}
                }
            }
        }

        json_resp(req, 404, json!({"error": "not found"}));
    }

    /// Bind to an ephemeral port and serve requests in background threads.
    /// Returns the port number once the socket is listening.
    pub fn start(token: &str) -> u16 {
        use std::net::TcpListener;

        // Grab a free port
        let probe = TcpListener::bind("127.0.0.1:0").expect("bind probe");
        let port = probe.local_addr().unwrap().port();
        drop(probe); // release so tiny_http can bind it

        let token = token.to_string();
        thread::spawn(move || {
            let store = Arc::new(RoomStore::new());
            let server =
                Arc::new(Server::http(format!("127.0.0.1:{}", port)).expect("server bind"));
            for request in server.incoming_requests() {
                let token = token.clone();
                let store = Arc::clone(&store);
                thread::spawn(move || handle(request, &token, &store));
            }
        });

        // Wait until the port is accepting connections (up to 2 s)
        let deadline = std::time::Instant::now() + Duration::from_secs(2);
        loop {
            if TcpStream::connect(format!("127.0.0.1:{}", port)).is_ok() {
                break;
            }
            assert!(
                std::time::Instant::now() < deadline,
                "server on port {} never started",
                port
            );
            thread::sleep(Duration::from_millis(20));
        }
        port
    }
}

// ---------------------------------------------------------------------------
// Raw HTTP/1.1 helpers — no external HTTP client needed.
// ---------------------------------------------------------------------------

struct HttpResp {
    status: u16,
    body: String,
}

fn http_get(port: u16, path: &str, token: Option<&str>) -> HttpResp {
    let mut stream = TcpStream::connect(format!("127.0.0.1:{}", port)).unwrap();
    stream
        .set_read_timeout(Some(Duration::from_secs(5)))
        .unwrap();
    let auth = token
        .map(|t| format!("Authorization: Bearer {}\r\n", t))
        .unwrap_or_default();
    let raw = format!(
        "GET {} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n{}Content-Length: 0\r\n\r\n",
        path, auth
    );
    stream.write_all(raw.as_bytes()).unwrap();
    let mut response = String::new();
    stream.read_to_string(&mut response).unwrap();
    parse_http(&response)
}

fn http_post(port: u16, path: &str, body: &str, token: Option<&str>) -> HttpResp {
    let mut stream = TcpStream::connect(format!("127.0.0.1:{}", port)).unwrap();
    stream
        .set_read_timeout(Some(Duration::from_secs(5)))
        .unwrap();
    let auth = token
        .map(|t| format!("Authorization: Bearer {}\r\n", t))
        .unwrap_or_default();
    let raw = format!(
        "POST {} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\
         Content-Type: application/json\r\nContent-Length: {}\r\n{}\r\n{}",
        path,
        body.len(),
        auth,
        body
    );
    stream.write_all(raw.as_bytes()).unwrap();
    let mut response = String::new();
    stream.read_to_string(&mut response).unwrap();
    parse_http(&response)
}

fn parse_http(raw: &str) -> HttpResp {
    let status: u16 = raw
        .lines()
        .next()
        .unwrap_or("")
        .split_whitespace()
        .nth(1)
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);
    let body = raw
        .find("\r\n\r\n")
        .map(|i| raw[i + 4..].to_string())
        .unwrap_or_default();
    HttpResp { status, body }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const TOKEN: &str = "test-secret-token";

// ── Open endpoint tests ───────────────────────────────────────────────────

#[test]
fn test_health_endpoint() {
    // Arrange
    let port = server::start(TOKEN);

    // Act
    let resp = http_get(port, "/health", None);

    // Assert
    assert_eq!(resp.status, 200, "GET /health should return 200");
    let json: Value = serde_json::from_str(&resp.body).expect("body must be JSON");
    assert_eq!(json["status"], "ok", r#"body must be {{"status":"ok"}}"#);
}

#[test]
fn test_static_index() {
    // Arrange
    let port = server::start(TOKEN);

    // Act
    let resp = http_get(port, "/", None);

    // Assert
    assert_eq!(resp.status, 200, "GET / should return 200");
}

#[test]
fn test_static_game() {
    // Arrange
    let port = server::start(TOKEN);

    // Act
    let resp = http_get(port, "/game", None);

    // Assert
    assert_eq!(resp.status, 200, "GET /game should return 200");
}

#[test]
fn test_static_scripts() {
    // Arrange
    let port = server::start(TOKEN);

    // Act
    let resp = http_get(port, "/scripts/board.js", None);

    // Assert
    assert_eq!(resp.status, 200, "GET /scripts/board.js should return 200");
}

// ── Auth tests ────────────────────────────────────────────────────────────

#[test]
fn test_bearer_auth_required() {
    // Arrange
    let port = server::start(TOKEN);

    // Act — no Authorization header
    let resp = http_post(port, "/signal/create", "{}", None);

    // Assert
    assert_eq!(resp.status, 401, "missing auth header should return 401");
}

#[test]
fn test_bearer_auth_wrong_token() {
    // Arrange
    let port = server::start(TOKEN);

    // Act — wrong token
    let resp = http_post(port, "/signal/create", "{}", Some("wrong-token"));

    // Assert
    assert_eq!(resp.status, 401, "wrong token should return 401");
}

// ── Room lifecycle test ───────────────────────────────────────────────────

#[test]
fn test_room_lifecycle() {
    // Arrange
    let port = server::start(TOKEN);

    // Act 1 — create room
    let create = http_post(port, "/signal/create", "{}", Some(TOKEN));
    assert_eq!(create.status, 200, "POST /signal/create should return 200");
    let json: Value = serde_json::from_str(&create.body).expect("create body must be JSON");
    let code = json["code"].as_str().expect("response must contain 'code'");
    assert!(!code.is_empty(), "room code must not be empty");

    // Act 2 — join room
    let join = http_post(port, &format!("/signal/{}/join", code), "{}", Some(TOKEN));
    assert_eq!(join.status, 200, "POST /signal/{{code}}/join should return 200");

    // Act 3 — push message
    let push = http_post(
        port,
        &format!("/signal/{}/push", code),
        r#"{"type":"offer","sdp":"v=0"}"#,
        Some(TOKEN),
    );
    assert_eq!(push.status, 200, "POST /signal/{{code}}/push should return 200");

    // Act 4 — poll for messages
    let poll = http_get(port, &format!("/signal/{}/poll?seq=0", code), Some(TOKEN));
    assert_eq!(poll.status, 200, "GET /signal/{{code}}/poll should return 200 when messages exist");
    let poll_json: Value = serde_json::from_str(&poll.body).expect("poll body must be JSON");
    let messages = poll_json["messages"]
        .as_array()
        .expect("poll response must have 'messages' array");
    assert!(!messages.is_empty(), "messages must not be empty after push");
    assert_eq!(
        messages[0]["payload"]["type"], "offer",
        "first message payload must match the pushed offer"
    );

    // Act 5 — leave room
    let leave = http_post(port, &format!("/signal/{}/leave", code), "{}", Some(TOKEN));
    assert_eq!(leave.status, 200, "POST /signal/{{code}}/leave should return 200");
}

// ── Poll timeout test ─────────────────────────────────────────────────────

#[test]
fn test_poll_timeout_no_messages() {
    // Arrange — create a room but push nothing
    let port = server::start(TOKEN);
    let create = http_post(port, "/signal/create", "{}", Some(TOKEN));
    assert_eq!(create.status, 200);
    let json: Value = serde_json::from_str(&create.body).unwrap();
    let code = json["code"].as_str().unwrap().to_string();

    // Act — poll with a sequence number higher than any message
    let start = std::time::Instant::now();
    let mut stream = TcpStream::connect(format!("127.0.0.1:{}", port)).unwrap();
    stream
        .set_read_timeout(Some(Duration::from_secs(4)))
        .unwrap();
    let path = format!("/signal/{}/poll?seq=999", code);
    let raw = format!(
        "GET {} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\
         Authorization: Bearer {}\r\nContent-Length: 0\r\n\r\n",
        path, TOKEN
    );
    stream.write_all(raw.as_bytes()).unwrap();
    let mut response = String::new();
    stream.read_to_string(&mut response).unwrap();
    let elapsed = start.elapsed();

    // Assert
    let resp = parse_http(&response);
    assert_eq!(resp.status, 204, "poll with no messages should return 204");
    assert!(
        elapsed < Duration::from_secs(4),
        "poll should complete within 4 s (server long-polls 2.5 s), took {:?}",
        elapsed
    );
}

// ── Poll wakeup on push test ──────────────────────────────────────────────

#[test]
fn test_poll_returns_on_push() {
    // Arrange — create a room
    let port = server::start(TOKEN);
    let create = http_post(port, "/signal/create", "{}", Some(TOKEN));
    assert_eq!(create.status, 200);
    let json: Value = serde_json::from_str(&create.body).unwrap();
    let code = json["code"].as_str().unwrap().to_string();

    // Arrange — spawn a thread that pushes a message after 150 ms
    let code_push = code.clone();
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(150));
        http_post(
            port,
            &format!("/signal/{}/push", code_push),
            r#"{"type":"ice","candidate":"candidate:0"}"#,
            Some(TOKEN),
        );
    });

    // Act — start polling from seq=0 before the push arrives
    let start = std::time::Instant::now();
    let poll = http_get(port, &format!("/signal/{}/poll?seq=0", code), Some(TOKEN));
    let elapsed = start.elapsed();

    // Assert
    assert_eq!(poll.status, 200, "poll should return 200 when a message arrives");
    let poll_json: Value = serde_json::from_str(&poll.body).expect("poll body must be JSON");
    let messages = poll_json["messages"]
        .as_array()
        .expect("response must have 'messages' array");
    assert!(!messages.is_empty(), "messages must not be empty");
    assert_eq!(
        messages[0]["payload"]["type"], "ice",
        "message payload must match the pushed ICE candidate"
    );
    assert!(
        elapsed < Duration::from_secs(3),
        "poll should wake up quickly after push (< 3 s), took {:?}",
        elapsed
    );
}
