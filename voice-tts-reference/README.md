# Reference audio for Chatterbox voice cloning

Drop a `.wav` or `.mp3` here (10-30s of clean, single-speaker audio) and set
`CHATTERBOX_REFERENCE_FILE` in `.env.demo` to its filename -- the `tts`
service mounts this whole folder to its `/app/reference_audio` directory, so
no manual upload through Chatterbox's own Web UI is needed.

Default expected filename: `reference.wav`.

Nothing in this folder is committed except this README and `.gitkeep` --
see `.gitignore`.
