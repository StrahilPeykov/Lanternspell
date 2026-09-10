# Known limitations and next evaluation

This is a bounded first playable, not a finished RPG. Human enjoyment and the 5–10 minute target have not been measured with a human player. The art is substantially simpler than the generated target, especially foliage, courtyard variation, paint detail and architecture interiors. Character motion uses a small retargeted set with simple runtime switching; coarse cloth intersections remain possible. The camera has orbit/zoom bounds but no full obstruction solver. There is no interior exploration, voice acting, ambient score, or full facial performance.

The free basic spell is viable, but basic-only guardian play loses in current diagnostic tuning. Conservative defense can prolong a solo fight to 18 rounds; setup and direct damage are close in some states. These policy results are diagnostics, not evidence of fun. Both players have their own prepared plan, resource and personal identity; the chapter currently gives both the same six-spell loadout and shared discovery, rather than offering a loadout editor or differentiated rewards.

Shared play is tested with two independent local browsers, actual WebSockets and a real SQLite Durable Object, including production preview and process reconstruction. Actual two-device internet play, real packet loss, deployed eviction and geographic latency remain unverified. No remote resources were created. Publishing still requires explicit authorization, verifying the actual Free account/configuration, and addressing public creation abuse and campaign retention. Localhost invitations are only usable on this machine.

Local solo saves are versioned and separate from shared seats. Shared seat rejoin credentials remain in the browser profile; there is no cross-device seat-transfer UI. Imported solo saves are user-owned and never merge into the shared authority. There is no offline install/PWA. After initial loading, local solo does not use a game server.

Evaluate three creative questions next: does the page-unfolding spell feel memorable from the normal camera; does solo setup produce a worthwhile choice versus direct damage; do two people enjoy discussing the visible queue? Then tune within this chapter before adding systems.

One repeated-browser-context test stalled during asset loading; a fresh-browser rerun passed. The retained startup-failure report documents this unresolved intermittent test-environment observation.
