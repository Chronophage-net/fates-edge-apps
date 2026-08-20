# voice-rvc -- runs daswer123/rvc-python's own API server
# (https://github.com/daswer123/rvc-python) so the demo doesn't need a
# hand-built RVC image. Needs a trained voice model you supply yourself
# (a .pth, optionally with a matching .index) -- RVC training is out of
# scope for this demo; see fates-edge-ai-gm-bot's
# docs/local-voice-cloning/VOICE-CLONING-LOCAL-SETUP.md for where to get
# or train one. Mount your model folder over /app/rvc_models (see
# docker-compose.voice.yml's `rvc` service volumes).
FROM python:3.11-slim

# ffmpeg + libsndfile1: rvc-python's audio I/O stack needs both.
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN pip install --no-cache-dir rvc-python

# rvc-python looks for models under ./rvc_models relative to its cwd by
# default -- create it so the bind-mounted volume in docker-compose.voice.yml
# has somewhere to land even before the user's first `docker compose up`.
RUN mkdir -p /app/rvc_models

EXPOSE 5050

# -l allows connections from outside the container (not just 127.0.0.1).
CMD ["python", "-m", "rvc_python", "api", "-p", "5050", "-l"]
