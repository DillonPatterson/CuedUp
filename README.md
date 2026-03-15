# CuedUp

Small project I am messing with.

Still setting things up and testing stuff.

## Run

```bash
npm install
npm run dev
```

## Open the project quickly

From the repo root on Windows:

```powershell
.\open-cuedup.ps1
```

Double-clickable wrapper:

```text
open-cuedup.cmd
```

`open-cuedup.cmd` now acts as the one-click app launcher:
- starts `npm run dev`
- opens the replay app in your browser
- does not open VS Code or the local launcher page

Useful options:

```powershell
.\open-cuedup.ps1 -StartDev
.\open-cuedup.ps1 -PrintOnly
```

## Notes

- The interview page opens in sparse live mode by default.
- Replay/debug mode is available on the page for validation.
- Live transcript ingestion is not connected yet.
