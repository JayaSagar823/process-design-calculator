# ProcessCalc

**[Open the live calculator](https://calculator.startraven.com/)** · [Deployment history](https://github.com/JayaSagar823/process-design-calculator/actions)

Mobile-friendly Steam Properties, Ammonia Saturation Condition, and CO₂ Emissions, based on the version 17 app. Includes calculation history, result exports, install controls, and offline use after the first complete online visit.

## Publish new changes

1. Open this repository in Codex, or edit its files on GitHub.
2. Ask for the changes you want. The editable app lives in `dist/`.
3. Run `npm test` and `npm run build` (Node.js 22 or later; no dependency install is needed).
4. Commit and push to a branch, open a pull request, and review the changes.
5. Merge into `main`. **Test and publish site** runs the tests and deploys the app to GitHub Pages automatically.
6. Open the published URL from the successful deployment in the repository's **Actions** tab or **Settings → Pages**.

You can also publish by committing directly to `main`. Failed checks stop deployment; the previously published site stays live. To undo a release, revert its commit and push the revert to `main`.

The build gives the service worker a new cache version whenever an app file changes. Open the site online to receive an update, then close and reopen it. History is stored in each browser and is not shared across devices or domains.

## One-time GitHub setup

- Repository name: `process-design-calculator`.
- In **Settings → Pages → Build and deployment**, choose **GitHub Actions**.
- After the first push, open **Actions → Test and publish site** to follow deployment.
- Invite collaborators through **Settings → Collaborators → Add people**. An invited collaborator must accept the invitation before they can push changes.

A public repository can use GitHub Pages on GitHub Free. Private repository availability depends on the account plan. See [GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Local preview

Run `npm run build`, then `python3 -m http.server 8080 --directory _site`. Open `http://localhost:8080/`. The app also works under a repository subdirectory, so its navigation and PWA routes work with GitHub project Pages.

## Files

- `dist/index.html`: tool chooser.
- `dist/steam/index.html`, `dist/app.js`: steam calculator interface.
- `dist/ammonia/`: ammonia interface, table, and interpolation logic.
- `dist/co2/`: CO₂ emissions interface, original calculation model, history, and reports.
- `dist/style.css`, `dist/shell.js`: shared design, navigation, and installation controls.
- `dist/engine/`: existing CoolProp WebAssembly and calculation engine.
- `dist/sw.js`, `dist/manifest.webmanifest`: offline use and app installation.
- `scripts/build.mjs`: builds `_site/` and versions the offline cache automatically.
- `.github/workflows/pages.yml`: tests and deployment.

The original calculator engines and data are preserved. CoolProp's bundled license is in `dist/engine/LICENSE-CoolProp.txt`.

## CO₂ emissions model

The CO₂ model and editable default factors are preserved from the supplied [CO₂ Emissions Calculator](https://co2-emissions-js-1115.sagar610340.chatgpt.site/) (source version 5, commit `2b778806715a057d860fcbd3ad61f3e201f5c7b0`). It reports turbine CO₂, specific ammonia-plant energy, and specific plant CO₂. Steam export subtracts an allocation credit; import adds a burden. The model uses 4.187 kJ/kcal and does not deduct recovered or stored CO₂. Default emission factors remain editable assumptions, not a claim of current regulatory compliance.

`co2.test.mjs` checks the original example, import/export, units, factor edits, invalid readings, history validation, and report output. Calculation history stays on the current browser and is limited to the latest 10 entries.
