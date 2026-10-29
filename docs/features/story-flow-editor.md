# Story flow editor

The full-canvas editor lets an administrator arrange scenes, connect choices, select media, and preview the selected scenario's draft. Scene selection opens the floating inspector; toolbar controls add scenes, arrange the canvas, and download a JSON backup.

The canvas toolbar and scene nodes use larger controls, clearer selection and keyboard focus styling. Node dimensions and graph data format remain unchanged. See [[docs/design/DESIGN]] for editor behavior and [[docs/decisions/DECISIONS]] for persistence constraints.

The toolbar toggle hides or shows the Media/Scene library without changing the draft; on desktop the canvas expands into its space. The toggle exposes its expanded state to assistive technology.

Save remains the primary action, while downloading a draft copy is secondary. Guidance and canvas controls use larger text, the canvas and project title have visible keyboard focus, and mobile toolbar and scene-order controls have larger touch targets.

Rapikan arranges scenes in list order, four per row, using the tallest rendered scene in each row to determine spacing. It frames the result in the canvas; scene order and connections are unchanged, and the position change can be undone.

Undo groups consecutive typing within 700 ms only for the same project title, scene title, choice label, or choice timer. Field identity includes the scene and choice, so switching fields or scenes starts a separate undo step. Other edits and undo/redo end the typing group.

## Verification
The authenticated browser regression passed 112 checks, including desktop-width library toggle expansion/restoration and panning. The panning assertion permits 1.5 pixels of browser subpixel rounding. A real-browser narrow-screen check also confirmed hide/reopen and expanded state. Saves in the test are mocked; persistence is not tested. See [[docs/technical/TESTING-AND-SETUP]].

Arrange regression checks were added for row spacing, framing, the 100-scene position limit, connections, and undo. They remain unverified: the current browser session was not logged in. JavaScript syntax checks and the 22-check graph validation test passed.

For the UI update, PHP and test JavaScript syntax checks and the 22-check graph validation test passed. The editor UI still needs authenticated browser verification at desktop and mobile widths. The design-taste source lint reports existing editor borders, canvas grid, and state shadows; its landing-page rules are not a complete fit for this interactive workspace.

The authenticated browser regression passed 122 checks after the undo fix, including grouping, separate fields, separate scenes, and redo. Saves were mocked and did not write to the server.

## Related project files
- [dashboard/interactive.js](../../dashboard/interactive.js) — editor interactions and history.
- [dashboard/interactive.php](../../dashboard/interactive.php) and [dashboard/interactive.css](../../dashboard/interactive.css) — editor markup and styling.
- [tests/interactive-editor-test.js](../../tests/interactive-editor-test.js) — browser regression checks.
