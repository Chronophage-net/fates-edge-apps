# Mobile player view

Open the web client on a phone (700 CSS pixels wide or less) to start in player view. Share `/?view=player#player` to open it on any screen. Choose **Full toolkit** to return to the regular layout; the sidebar’s **Player view** button switches back. An explicit link takes precedence over the saved view preference.

The player home offers a remembered character selection, an attribute/Fatigue/Boon summary, and a shortcut into the existing editable character sheet. The bottom bar keeps Play, Sheets, Dice, Table, and Rules within reach. Connection setup and language selection are available from Play. The X-Card stays available above the bottom bar, including during play.

This is a mobile presentation of the same application: it uses the existing saved characters, roll rules, room connections, authentication, and feature permissions. Choosing a character is a local shortcut, not an ownership claim. Player view does not assign a server role or grant access to GM tools. It is not an installable app or a promise that the whole client works without internet access. The Table and sheet editors use the existing client features with larger touch targets and phone layout adjustments.

New text is included in English, American English, British English, and Spanish. No separate deployment is required: the standard build includes player view.

Validation: preference tests cover phone defaults and explicit/saved overrides; the full web test suite and production build pass. Browser checks cover the player landing page and dice navigation at a 390-pixel phone width. Physical-device testing and a live multiplayer session remain useful follow-up checks.
