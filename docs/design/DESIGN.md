# Product and Editor Design

## Interactive editor
The sidebar entry opens `admin.php?page=interactive`, a scenario selection page (`dashboard/interactive-menu.php`). The existing shared scenario opens at `admin.php?page=interactive&scenario=1` in a full-canvas workspace without dashboard navigation; a back link returns to selection. This changes navigation only, not the single-draft persistence model.

The filled “Unduh salinan draft” button sits beside “+ Scene” in the canvas toolbar and exports the existing JSON backup.

`dashboard/interactive.php` supplies the editor shell and serializes graph/media/revision/session-token data into `#iv-data`. `dashboard/interactive.js` owns graph state, inspector controls, canvas interactions, autosave-state indication, and preview. `dashboard/interactive.css` styles the workspace.

Each scene has an ID, title, optional media ID, canvas coordinates, and an ordered list of choices. Each choice has a label, destination scene ID, and optional `timeSec`. The SVG edge layer draws connectors between output and input ports. The canvas supports pan/zoom/fit/focus and grows as content approaches its boundaries.

Canvas and Media Library video thumbnails defer metadata loading until they approach the visible viewport; the selected scene inspector still loads metadata for timer bounds, and preview loads the active scene for playback. This reduces unnecessary thumbnail requests without transcoding or modifying original media.

The inspector edits choice label, destination, and timer. Preview uses the selected draft snapshot: timed choices are revealed once `currentTime` reaches their threshold without pausing playback; all choices are exposed on `ended`. Untimed choices therefore remain hidden until the video ends. Missing or unplayable media uses the editor's fallback flow.

Inspector video and destination controls use custom searchable listboxes with keyboard navigation; their selected values continue to update the same scene media IDs and choice target IDs.

The scene inspector floats over the canvas and starts closed; the toolbar button is disabled until a scene is selected. It opens on selection, can be closed and reopened from the toolbar, and closes if no selected scene remains. On narrow screens it becomes a fixed bottom sheet.

Graph edits support toolbar buttons and `Ctrl+Z` undo / `Ctrl+Shift+Z` redo with a bounded 100-step in-memory history. Consecutive text input is coalesced into one undo step; buttons disable when their history stack is empty, and history does not persist across reloads.

## Persistence flow
1. The authenticated dashboard loads the single graph, valid media entries, revision, and session token.
2. The browser posts a graph snapshot, revision, and token to `dashboard/interactive-api.php`.
3. The endpoint checks session, method, request size, and token, then calls `saveInteractiveDraft`.
4. The store locks the draft row, compares revision, revalidates graph and media, and updates JSON plus revision in a transaction.

Media deletion shares the store module: it locks the draft, protects referenced media (including canonical path aliases), commits the row deletion before unlinking an unused file.

See [[docs/architecture/ARCHITECTURE]] for the complete application boundaries and [[docs/decisions/DECISIONS]] for established constraints.
