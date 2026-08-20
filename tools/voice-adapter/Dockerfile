# voice-adapter -- lightweight sidecar, no ML deps. Just translates HTTP
# JSON shapes between the AI GM bot and the Chatterbox/rvc-python
# services (see adapter.py's own header comment for the why).
FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir flask==3.* requests==2.*

COPY adapter.py .

EXPOSE 8095

CMD ["python", "adapter.py"]
