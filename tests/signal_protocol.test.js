/**
 * Unit tests for src/scripts/webrtc-cog.js
 *
 * All network calls are intercepted via a global fetch mock so no real server
 * is required.  Each test follows Arrange → Act → Assert.
 */

import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import {
  createRoom,
  joinRoom,
  pushMessage,
  pollMessages,
  leaveRoom,
  CogSignalingManager,
} from '../src/scripts/webrtc-cog.js';

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

/** Build a minimal Response-like object that satisfies the module's usage. */
function mockOkResponse(jsonBody) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(jsonBody),
  };
}

function mockErrorResponse(status) {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error: 'error' }),
  };
}

// Stub window.COG_TOKEN so authHeaders() resolves to a known value without
// touching the real DOM.
const TEST_TOKEN = 'test-bearer-token';

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Provide a predictable token for all tests
  globalThis.window = globalThis.window ?? {};
  globalThis.window.COG_TOKEN = TEST_TOKEN;

  // Reset the fetch mock before each test
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.window?.COG_TOKEN;
});

// ---------------------------------------------------------------------------
// createRoom
// ---------------------------------------------------------------------------

describe('createRoom', () => {
  it('should call POST /signal/create and return the room code', async () => {
    // Arrange
    const expectedCode = 'abc123';
    globalThis.fetch.mockResolvedValueOnce(mockOkResponse({ code: expectedCode }));

    // Act
    const code = await createRoom();

    // Assert
    expect(fetch).toHaveBeenCalledOnce();
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('/signal/create');
    expect(options.method).toBe('POST');
    expect(code).toBe(expectedCode);
  });

  it('should throw when the server returns a non-ok status', async () => {
    // Arrange
    globalThis.fetch.mockResolvedValueOnce(mockErrorResponse(401));

    // Act & Assert
    await expect(createRoom()).rejects.toThrow('createRoom failed: 401');
  });
});

// ---------------------------------------------------------------------------
// joinRoom
// ---------------------------------------------------------------------------

describe('joinRoom', () => {
  it('should call POST /signal/{code}/join with the correct URL', async () => {
    // Arrange
    const code = 'abc123';
    globalThis.fetch.mockResolvedValueOnce(mockOkResponse({ ok: true }));

    // Act
    await joinRoom(code);

    // Assert
    expect(fetch).toHaveBeenCalledOnce();
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe(`/signal/${code}/join`);
    expect(options.method).toBe('POST');
  });

  it('should throw when the server returns a non-ok status', async () => {
    // Arrange
    globalThis.fetch.mockResolvedValueOnce(mockErrorResponse(404));

    // Act & Assert
    await expect(joinRoom('badcode')).rejects.toThrow('joinRoom failed: 404');
  });
});

// ---------------------------------------------------------------------------
// pushMessage
// ---------------------------------------------------------------------------

describe('pushMessage', () => {
  it('should call POST /signal/{code}/push with the serialised message body', async () => {
    // Arrange
    const code = 'abc123';
    const msg = { type: 'offer', sdp: 'v=0' };
    globalThis.fetch.mockResolvedValueOnce(mockOkResponse({ ok: true }));

    // Act
    await pushMessage(code, msg);

    // Assert
    expect(fetch).toHaveBeenCalledOnce();
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe(`/signal/${code}/push`);
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual(msg);
  });

  it('should throw when the server returns a non-ok status', async () => {
    // Arrange
    globalThis.fetch.mockResolvedValueOnce(mockErrorResponse(500));

    // Act & Assert
    await expect(pushMessage('abc123', {})).rejects.toThrow('pushMessage failed: 500');
  });
});

// ---------------------------------------------------------------------------
// pollMessages
// ---------------------------------------------------------------------------

describe('pollMessages', () => {
  it('should call GET /signal/{code}/poll?seq={seq} and return messages', async () => {
    // Arrange
    const code = 'abc123';
    const seq = 3;
    const responseData = {
      messages: [{ seq: 3, payload: { type: 'ice' } }],
      seq: 4,
    };
    globalThis.fetch.mockResolvedValueOnce(mockOkResponse(responseData));

    // Act
    const result = await pollMessages(code, seq);

    // Assert
    expect(fetch).toHaveBeenCalledOnce();
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe(`/signal/${code}/poll?seq=${seq}`);
    expect(options.method).toBe('GET');
    expect(result).toEqual(responseData);
  });

  it('should throw when the server returns a non-ok status', async () => {
    // Arrange
    globalThis.fetch.mockResolvedValueOnce(mockErrorResponse(404));

    // Act & Assert
    await expect(pollMessages('abc123', 0)).rejects.toThrow('pollMessages failed: 404');
  });
});

// ---------------------------------------------------------------------------
// leaveRoom
// ---------------------------------------------------------------------------

describe('leaveRoom', () => {
  it('should call POST /signal/{code}/leave with the correct URL', async () => {
    // Arrange
    const code = 'abc123';
    globalThis.fetch.mockResolvedValueOnce(mockOkResponse({ ok: true }));

    // Act
    await leaveRoom(code);

    // Assert
    expect(fetch).toHaveBeenCalledOnce();
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe(`/signal/${code}/leave`);
    expect(options.method).toBe('POST');
  });

  it('should throw when the server returns a non-ok status', async () => {
    // Arrange
    globalThis.fetch.mockResolvedValueOnce(mockErrorResponse(404));

    // Act & Assert
    await expect(leaveRoom('badcode')).rejects.toThrow('leaveRoom failed: 404');
  });
});

// ---------------------------------------------------------------------------
// Bearer token header is included on every call
// ---------------------------------------------------------------------------

describe('test_bearer_token_included', () => {
  it('should include Authorization Bearer header on createRoom', async () => {
    // Arrange
    globalThis.fetch.mockResolvedValueOnce(mockOkResponse({ code: 'abc123' }));

    // Act
    await createRoom();

    // Assert
    const [, options] = fetch.mock.calls[0];
    expect(options.headers['Authorization']).toBe(`Bearer ${TEST_TOKEN}`);
  });

  it('should include Authorization Bearer header on joinRoom', async () => {
    // Arrange
    globalThis.fetch.mockResolvedValueOnce(mockOkResponse({ ok: true }));

    // Act
    await joinRoom('abc123');

    // Assert
    const [, options] = fetch.mock.calls[0];
    expect(options.headers['Authorization']).toBe(`Bearer ${TEST_TOKEN}`);
  });

  it('should include Authorization Bearer header on pushMessage', async () => {
    // Arrange
    globalThis.fetch.mockResolvedValueOnce(mockOkResponse({ ok: true }));

    // Act
    await pushMessage('abc123', { type: 'offer' });

    // Assert
    const [, options] = fetch.mock.calls[0];
    expect(options.headers['Authorization']).toBe(`Bearer ${TEST_TOKEN}`);
  });

  it('should include Authorization Bearer header on pollMessages', async () => {
    // Arrange
    globalThis.fetch.mockResolvedValueOnce(
      mockOkResponse({ messages: [], seq: 0 }),
    );

    // Act
    await pollMessages('abc123', 0);

    // Assert
    const [, options] = fetch.mock.calls[0];
    expect(options.headers['Authorization']).toBe(`Bearer ${TEST_TOKEN}`);
  });

  it('should include Authorization Bearer header on leaveRoom', async () => {
    // Arrange
    globalThis.fetch.mockResolvedValueOnce(mockOkResponse({ ok: true }));

    // Act
    await leaveRoom('abc123');

    // Assert
    const [, options] = fetch.mock.calls[0];
    expect(options.headers['Authorization']).toBe(`Bearer ${TEST_TOKEN}`);
  });
});

// ---------------------------------------------------------------------------
// CogSignalingManager — poll loop processes offer / answer / ICE in sequence
// ---------------------------------------------------------------------------

describe('test_poll_loop', () => {
  // Use fake timers so _sleep(1000) inside the error-retry path never actually
  // waits, and so the loop does not spin indefinitely burning heap memory.
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should deliver offer, answer, and ICE messages to onMessage in sequence', async () => {
    // Arrange
    const code = 'abc123';

    // createRoom
    globalThis.fetch.mockResolvedValueOnce(mockOkResponse({ code }));

    // Poll 1: offer + answer in one batch
    globalThis.fetch.mockResolvedValueOnce(
      mockOkResponse({
        messages: [
          { seq: 0, payload: { type: 'offer', sdp: 'v=0 offer' } },
          { seq: 1, payload: { type: 'answer', sdp: 'v=0 answer' } },
        ],
        seq: 2,
      }),
    );

    // Poll 2: ICE candidate
    globalThis.fetch.mockResolvedValueOnce(
      mockOkResponse({
        messages: [{ seq: 2, payload: { type: 'ice', candidate: 'candidate:0' } }],
        seq: 3,
      }),
    );

    // Poll 3+: return a rejected promise so the loop hits its catch → _sleep →
    // then stop.  destroy() sets _polling=false so the loop exits on next tick.
    globalThis.fetch.mockRejectedValue(new Error('stop'));

    const received = [];
    const mgr = new CogSignalingManager();
    mgr.onMessage = (payload) => received.push(payload);

    // Act — createGame starts the poll loop; let microtasks drain
    await mgr.createGame();

    // Drain two successful poll cycles
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Trigger the fake timer that _sleep(1000) installed so the loop can exit
    mgr.destroy();
    await vi.runAllTimersAsync();

    // Assert
    expect(received).toHaveLength(3);
    expect(received[0]).toEqual({ type: 'offer', sdp: 'v=0 offer' });
    expect(received[1]).toEqual({ type: 'answer', sdp: 'v=0 answer' });
    expect(received[2]).toEqual({ type: 'ice', candidate: 'candidate:0' });
  });

  it('should advance the sequence number between polls', async () => {
    // Arrange
    const code = 'def456';

    // createRoom
    globalThis.fetch.mockResolvedValueOnce(mockOkResponse({ code }));

    // Poll 1: one message, next seq advances to 2
    globalThis.fetch.mockResolvedValueOnce(
      mockOkResponse({
        messages: [{ seq: 0, payload: { type: 'offer' } }],
        seq: 2,
      }),
    );

    // Poll 2: captured for URL inspection, then stop
    globalThis.fetch.mockResolvedValueOnce(
      mockOkResponse({ messages: [], seq: 2 }),
    );

    globalThis.fetch.mockRejectedValue(new Error('stop'));

    const mgr = new CogSignalingManager();
    mgr.onMessage = () => {};
    await mgr.createGame();

    // Drain microtasks for polls 1 and 2
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    mgr.destroy();
    await vi.runAllTimersAsync();

    // Assert — poll 2 URL must include seq=2, not seq=0
    // fetch calls: [0]=createRoom, [1]=poll1, [2]=poll2
    const secondPollUrl = fetch.mock.calls[2][0];
    expect(secondPollUrl).toContain('seq=2');
  });
});
