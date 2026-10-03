# Performance notes

Measured on Windows with 22 logical CPU cores, using all time zones and then hiding the panel for 65 seconds. Figures cover all persistent app processes.

| Metric | Before | v1.1.0 |
| --- | ---: | ---: |
| Median private committed memory | 232 MB | 130 MB |
| Average CPU, normalized to the whole machine | 0.269% | 0.049% |
| Clock updates while hidden | 65 | 0 |
| Uncompressed app folder | 406 MB | 320 MB |
| Median warm panel reopen, five attempts | 16 ms | 26 ms |

Hidden panels stop clock updates and time-zone polling. City clocks update once per minute, concurrent system queries are combined, and successful switches are verified with a fresh read. The text interface uses software rendering. The release omits bundled frontend dependencies and unused Electron locales.

Private committed memory differs from Task Manager's private working set. CPU sampling adds some overhead; transient system-query processes are excluded. These are local measurements, not guarantees for other PCs. No hours-long memory-leak test was performed.

Search, tray behavior, placement, fade-out, language persistence, Windows startup registration, and cache correctness were checked. Tests preserve the current system time zone.
