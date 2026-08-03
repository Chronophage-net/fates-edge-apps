/**
 * DEPRECATED — this file used to be a full ~1300-line combat tracker
 * implementation, nearly identical to js/features/encounters/combat.js.
 * The two had drifted out of sync (this one had a few extra exports —
 * getTrackerPositionByName/setTrackerPositionByName/worsenTrackerPositionByName/
 * improveTrackerPositionByName/logExternalAction — that every real caller across
 * the app already accessed defensively via optional chaining, e.g.
 * `combat?.worsenTrackerPositionByName?.(...)`, because in practice every real
 * caller (vtt-connected.js, combat-actions.js, gm-tools/index.js,
 * adventure-manager/index.js, whiteboard/modules/combat.js) already imports
 * from '../encounters/combat.js', not this file).
 *
 * js/features/encounters/combat.js is the single canonical combat tracker.
 * This file now just re-exports it, so the one remaining direct importer
 * (js/features/vtt/editor.js — since updated to import from
 * '../encounters/combat.js' directly) and anything else that still points here
 * keeps working without two divergent ~1300-line copies to maintain.
 */

export { openTracker, isTrackerOpen, getLiveCombatants, setTrackerRangeByName } from '../encounters/combat.js';
export { default } from '../encounters/combat.js';
