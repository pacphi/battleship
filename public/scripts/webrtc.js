const RTC_CONFIG = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
};

const SIGNALING_URL = (() => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/signaling`;
})();

export class WebRTCManager {
  constructor() {
    this.pc = null;
    this.dc = null;
    this.role = null;
    this.code = null;
    this.onMessage = null;
    this.onStateChange = null;
    this.ws = null;
  }

  async createGame() {
    this.role = 'host';
    await this._connectSignaling();
  }

  async joinGame(code) {
    this.role = 'guest';
    this.code = code.toLowerCase().trim();
    await this._connectSignaling();
  }

  _connectSignaling() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(SIGNALING_URL);
      this.ws.onopen = () => {
        resolve();
        if (this.role === 'host') {
          this.ws.send(JSON.stringify({ type: 'create-game' }));
        } else {
          this.ws.send(JSON.stringify({ type: 'join-game', code: this.code }));
        }
      };

      this.ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        this._handleSignalingMessage(msg);
      };

      this.ws.onclose = () => {
        this.onStateChange?.('disconnected');
      };

      this.ws.onerror = () => reject(new Error('Signaling connection failed'));
    });
  }

  _handleSignalingMessage(msg) {
    switch (msg.type) {
      case 'game-created':
        this.code = msg.code;
        this.onStateChange?.('waiting', msg.code);
        this._initPeer(true);
        break;

      case 'game-joined':
        this.code = msg.code;
        this.onStateChange?.('signaling');
        this._initPeer(false);
        break;

      case 'game-expired':
        this.onMessage?.({ type: 'game-expired', code: msg.code });
        this._cleanupSignaling();
        break;

      case 'join-failed':
        this.onMessage?.({ type: 'join-failed', reason: msg.reason });
        this._cleanupSignaling();
        break;

      case 'guest-joined':
        // The guest is now present on the server, so its relay target exists.
        // Only now is it safe for the host to send the offer.
        this._makeOffer();
        break;

      case 'opponent-disconnected':
        this.onMessage?.({ type: 'opponent-disconnected' });
        this._cleanupAll();
        break;

      case 'relay': {
        const data = JSON.parse(msg.data);
        this._handleRTCMessage(data);
        break;
      }

      default:
        break;
    }
  }

  _initPeer(isHost) {
    this._connected = false;
    this.pc = new RTCPeerConnection(RTC_CONFIG);

    this.pc.onicecandidate = (e) => {
      if (e.candidate && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: 'relay',
            code: this.code,
            data: JSON.stringify({ type: 'ice', candidate: e.candidate }),
            to: isHost ? 'guest' : 'host',
          })
        );
      }
    };

    // Note: 'connected' is fired from the data channel's 'open' event, not
    // here — the peer connection can report 'connected' before the channel is
    // open, and send() silently drops messages on a not-yet-open channel (which
    // would lose the opening fleet-ready exchange).
    this.pc.onconnectionstatechange = () => {
      const state = this.pc.connectionState;
      if (state === 'disconnected' || state === 'failed') {
        this.onStateChange?.('p2p-lost');
      }
    };

    if (isHost) {
      // The data channel must exist before the offer is created, but the offer
      // itself is deferred until the guest joins (see 'guest-joined' →
      // _makeOffer). Sending it now would relay to a non-existent guest.
      this.dc = this.pc.createDataChannel('game');
      this._setupDataChannel();
    }

    this.pc.ondatachannel = (e) => {
      this.dc = e.channel;
      this._setupDataChannel();
    };
  }

  async _makeOffer() {
    if (!this.pc) return;
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'relay',
          code: this.code,
          data: JSON.stringify({ type: 'sdp', sdp: this.pc.localDescription }),
          to: 'guest',
        })
      );
    }
  }

  async _handleRTCMessage(data) {
    switch (data.type) {
      case 'sdp':
        await this.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        if (!this.pc.localDescription) {
          const answer = await this.pc.createAnswer();
          await this.pc.setLocalDescription(answer);
          this.ws.send(
            JSON.stringify({
              type: 'relay',
              code: this.code,
              data: JSON.stringify({ type: 'sdp', sdp: this.pc.localDescription }),
              to: 'host',
            })
          );
        }
        break;

      case 'ice':
        if (data.candidate) {
          await this.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
        break;

      default:
        if (this.onMessage) {
          this.onMessage(data);
        }
        break;
    }
  }

  _setupDataChannel() {
    this.dc.onopen = () => {
      this._fireConnected();
    };
    this.dc.onclose = () => {
      this.onStateChange?.('p2p-lost');
    };
    this.dc.onmessage = (e) => {
      const data = JSON.parse(e.data);
      this.onMessage?.(data);
    };
    // The channel may already be open by the time we attach handlers.
    if (this.dc.readyState === 'open') {
      this._fireConnected();
    }
  }

  _fireConnected() {
    if (this._connected) return;
    this._connected = true;
    this.onStateChange?.('connected');
  }

  send(data) {
    if (this.dc && this.dc.readyState === 'open') {
      this.dc.send(JSON.stringify(data));
    }
  }

  get isOpen() {
    return this.dc?.readyState === 'open';
  }

  _cleanupSignaling() {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  _cleanupAll() {
    this._cleanupSignaling();
    if (this.pc) {
      this.pc.onicecandidate = null;
      this.pc.onconnectionstatechange = null;
      this.pc.ondatachannel = null;
      this.pc.close();
      this.pc = null;
    }
    this.dc = null;
    this.code = null;
  }

  destroy() {
    this._cleanupAll();
  }
}
