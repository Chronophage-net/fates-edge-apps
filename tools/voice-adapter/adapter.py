#!/usr/bin/env python3
"""
voice-adapter -- the single sidecar the AI GM bot's TTS_URL/RVC_URL point
at. Translates the bot's fixed contract (see fates-edge-ai-gm-bot's
README "Voice Narration"/"Voice Cloning" sections and DESIGN.md 6.1/6.2)
into whatever the underlying Chatterbox TTS server and rvc-python API
server actually speak, so neither of those upstream projects needs to
be patched or forked.

Routes:
    POST /synthesize  -- bot's TTS_URL.  {text, voice, format} -> raw audio
    POST /convert      -- bot's RVC_URL. {audio, format, voice} -> raw audio
                          (or {audio: base64} JSON -- the bot's tts-client.js
                          accepts either)
    GET  /healthz      -- for the sidecar's own Docker healthcheck

Env vars (all optional, defaults match docker-compose.voice.yml):
    CHATTERBOX_URL            http://tts:8004
    CHATTERBOX_REFERENCE_FILE reference.wav  -- must exist under Chatterbox's
                               /app/reference_audio (see the reference_audio
                               volume mount in docker-compose.voice.yml --
                               drop a .wav there and set this to its filename)
    RVC_PYTHON_URL             http://rvc:5050  -- only used if the bot's
                               RVC_ENABLED=true; if unset/unreachable,
                               /convert fails soft with a 502 the bot's own
                               convertVoice() already treats as "no RVC this
                               time" (see DESIGN.md 6.2's fail-soft note)
    ADAPTER_PORT               8095
"""
import base64
import os

import requests
from flask import Flask, Response, jsonify, request

app = Flask(__name__)

CHATTERBOX_URL = os.environ.get("CHATTERBOX_URL", "http://tts:8004")
CHATTERBOX_REFERENCE_FILE = os.environ.get("CHATTERBOX_REFERENCE_FILE", "reference.wav")
RVC_PYTHON_URL = os.environ.get("RVC_PYTHON_URL", "http://rvc:5050")
ADAPTER_PORT = int(os.environ.get("ADAPTER_PORT", "8095"))


@app.route("/healthz", methods=["GET"])
def healthz():
    return jsonify({"ok": True}), 200


@app.route("/synthesize", methods=["POST"])
def synthesize():
    body = request.get_json(force=True, silent=True) or {}
    text = body.get("text", "")
    fmt = body.get("format", "wav")

    if not text:
        return jsonify({"error": "missing 'text'"}), 400

    payload = {
        "text": text,
        "voice_mode": "clone",
        "reference_audio_filename": CHATTERBOX_REFERENCE_FILE,
        "language": "en",
        "stream": False,
    }

    try:
        resp = requests.post(f"{CHATTERBOX_URL}/tts", json=payload, timeout=120)
        resp.raise_for_status()
    except requests.RequestException as e:
        # Fails soft on purpose -- the bot's own synthesize() already
        # treats any non-2xx/timeout as "no TTS this turn," never a
        # blocked reply. See DESIGN.md 6.1's fail-soft note.
        return jsonify({"error": f"chatterbox request failed: {e}"}), 502

    return Response(resp.content, mimetype=f"audio/{fmt}")


@app.route("/convert", methods=["POST"])
def convert():
    body = request.get_json(force=True, silent=True) or {}
    audio_b64 = body.get("audio")
    fmt = body.get("format", "wav")

    if not audio_b64:
        return jsonify({"error": "missing 'audio'"}), 400

    try:
        resp = requests.post(
            f"{RVC_PYTHON_URL}/convert",
            json={"audio_data": audio_b64},
            timeout=60,
        )
        resp.raise_for_status()
    except requests.RequestException as e:
        # Fails soft here too -- the bot's convertVoice() falls back to
        # the un-cloned TTS audio rather than losing narration entirely.
        return jsonify({"error": f"rvc request failed: {e}"}), 502

    return Response(resp.content, mimetype=f"audio/{fmt}")


if __name__ == "__main__":
    print(f"voice-adapter listening on :{ADAPTER_PORT}")
    print(f"  /synthesize -> {CHATTERBOX_URL}/tts (reference file: {CHATTERBOX_REFERENCE_FILE})")
    print(f"  /convert    -> {RVC_PYTHON_URL}/convert")
    app.run(host="0.0.0.0", port=ADAPTER_PORT)
