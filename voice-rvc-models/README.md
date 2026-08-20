# RVC voice models

Put a trained model's `.pth` (required) and `.index` (optional, improves
quality) here, in a subfolder per voice, e.g.:

```
voice-rvc-models/
└── my-voice/
    ├── model.pth
    └── model.index
```

This folder mounts to the `rvc` service's `/app/rvc_models` directory (see
`docker-compose.voice.yml`). Training a model is out of scope for this demo
-- see `fates-edge-ai-gm-bot/docs/local-voice-cloning/VOICE-CLONING-LOCAL-SETUP.md`
Option B, or the [RVC project's own docs](https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI).

Nothing in this folder is committed except this README and `.gitkeep` --
see `.gitignore`.
