# Story flow editor

The full-canvas editor lets an administrator arrange scenes, connect choices, select media, and preview the shared draft. Scene selection opens the floating inspector; toolbar controls add scenes, arrange the canvas, and download a JSON backup.

The canvas toolbar and scene nodes use larger controls, clearer selection and keyboard focus styling. Node dimensions and graph data format remain unchanged. See [[docs/design/DESIGN]] for editor behavior and [[docs/decisions/DECISIONS]] for persistence constraints.

The toolbar toggle hides or shows the Media/Scene library without changing the draft; on desktop the canvas expands into its space. The toggle exposes its expanded state to assistive technology.

Rapikan arranges scenes in list order, four per row, using the tallest rendered scene in each row to determine spacing. It frames the result in the canvas; scene order and connections are unchanged, and the position change can be undone.

## Verification
The authenticated browser regression passed 112 checks, including desktop-width library toggle expansion/restoration and panning. The panning assertion permits 1.5 pixels of browser subpixel rounding. A real-browser narrow-screen check also confirmed hide/reopen and expanded state. Saves in the test are mocked; persistence is not tested. See [[docs/technical/TESTING-AND-SETUP]].

Arrange regression checks were added for row spacing, framing, the 100-scene position limit, connections, and undo. They remain unverified: the current browser session was not logged in. JavaScript syntax checks and the 22-check graph validation test passed.
