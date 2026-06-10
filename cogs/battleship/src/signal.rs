use std::collections::HashMap;
use std::sync::{Arc, Condvar, Mutex};
use std::time::Duration;

use serde_json::Value;

pub struct SignalMessage {
    pub seq: u64,
    pub payload: Value,
}

pub struct RoomInner {
    pub messages: Vec<SignalMessage>,
    pub next_seq: u64,
    pub closed: bool,
}

pub struct Room {
    pub inner: Arc<(Mutex<RoomInner>, Condvar)>,
}

pub struct RoomStore {
    pub rooms: Mutex<HashMap<String, Arc<Room>>>,
}

impl RoomStore {
    pub fn new() -> Self {
        RoomStore {
            rooms: Mutex::new(HashMap::new()),
        }
    }

    /// Create a new room and return its 6-char hex code.
    pub fn create_room(&self) -> String {
        let code = Self::gen_code();
        let room = Arc::new(Room {
            inner: Arc::new((
                Mutex::new(RoomInner {
                    messages: Vec::new(),
                    next_seq: 0,
                    closed: false,
                }),
                Condvar::new(),
            )),
        });
        self.rooms.lock().unwrap().insert(code.clone(), room);
        code
    }

    /// Return true if the room exists (and is not closed).
    pub fn join_room(&self, code: &str) -> bool {
        let rooms = self.rooms.lock().unwrap();
        if let Some(room) = rooms.get(code) {
            let (lock, _) = &*room.inner;
            !lock.lock().unwrap().closed
        } else {
            false
        }
    }

    /// Push a message into the room. Returns false if room does not exist.
    pub fn push_message(&self, code: &str, payload: Value) -> bool {
        let rooms = self.rooms.lock().unwrap();
        if let Some(room) = rooms.get(code) {
            let (lock, cvar) = &*room.inner;
            let mut inner = lock.lock().unwrap();
            if inner.closed {
                return false;
            }
            let seq = inner.next_seq;
            inner.messages.push(SignalMessage { seq, payload });
            inner.next_seq += 1;
            cvar.notify_all();
            true
        } else {
            false
        }
    }

    /// Long-poll: wait up to `timeout_ms` for messages with seq >= `from_seq`.
    /// Returns None if the room does not exist.
    pub fn poll(&self, code: &str, from_seq: u64, timeout_ms: u64) -> Option<Vec<(u64, Value)>> {
        let room = {
            let rooms = self.rooms.lock().unwrap();
            rooms.get(code).cloned()
        };

        let room = room?;
        let (lock, cvar) = &*room.inner;

        let deadline = Duration::from_millis(timeout_ms);
        let inner = lock.lock().unwrap();

        // Wait until there is at least one message >= from_seq, or timeout
        let (mut inner, _timed_out) = cvar
            .wait_timeout_while(inner, deadline, |s| {
                !s.closed && s.messages.iter().all(|m| m.seq < from_seq)
            })
            .unwrap();

        let result: Vec<(u64, Value)> = inner
            .messages
            .iter()
            .filter(|m| m.seq >= from_seq)
            .map(|m| (m.seq, m.payload.clone()))
            .collect();

        // Trim messages that have been delivered to keep memory bounded.
        // Keep only messages with seq >= from_seq so a slow second poller
        // does not lose messages, but drop anything strictly before from_seq.
        inner.messages.retain(|m| m.seq >= from_seq);

        Some(result)
    }

    /// Mark a room as closed and remove it from the store.
    pub fn leave_room(&self, code: &str) {
        let mut rooms = self.rooms.lock().unwrap();
        if let Some(room) = rooms.remove(code) {
            let (lock, cvar) = &*room.inner;
            let mut inner = lock.lock().unwrap();
            inner.closed = true;
            cvar.notify_all();
        }
    }

    // --- helpers ---

    fn gen_code() -> String {
        let mut buf = [0u8; 3];
        getrandom::fill(&mut buf).expect("getrandom failed");
        format!("{:02x}{:02x}{:02x}", buf[0], buf[1], buf[2])
    }
}
