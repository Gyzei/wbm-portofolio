# Interactive video draft and preview

The admin's Video Interaktif menu lists the existing shared scenario; opening it launches the full-canvas [[docs/features/story-flow-editor]]. The graph has a title, start scene, scene positions, optional media IDs, and labeled choices with target IDs and optional timers. It supports up to 100 scenes and eight choices per scene. Timers are entered as `MM:SS` and stored as seconds; a blank timer exposes a choice at video end.

Preview takes a draft snapshot, plays available scene videos, and exposes timed choices during playback or remaining choices at the end. Missing/unplayable media has a choice fallback. JSON download is a backup; there is no import feature. One shared draft is stored with revision locking; the API checks session, CSRF token, request size, graph validity, and media IDs. Source videos come from [[docs/features/media-library]], including new uploads and legacy assets.

**Limitations:** multiple independent scenarios and a public interactive-video player are not implemented. Timer duration bounds rely on browser video metadata; server validation checks the numeric range, not video duration. Undo history is in-memory only. See [[docs/decisions/DECISIONS]] and [[docs/technical/TESTING-AND-SETUP]] for verification and constraints.
