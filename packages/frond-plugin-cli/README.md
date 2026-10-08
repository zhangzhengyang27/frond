# frond-plugin · Build and publish Frond plugins

A zero-dependency CLI that takes you from an empty folder to an installable
plugin in Frond's plugin market — **without reading Frond's source code**.

```
pnpm plugin init "My Tool"          # scaffold ./my-tool
pnpm plugin pack  ./my-tool         # zip + sha256 + market entry
pnpm plugin publish ./my-tool --index ./my-index.json --download https://.../my-tool.zip
```

(On this repo `pnpm plugin …` is an alias for
`node packages/frond-plugin-cli/cli.mjs …`. From anywhere else, run the CLI
directly with Node ≥ 20.)

## The 0→1 flow

### 1. Scaffold

```bash
pnpm plugin init "My Tool" --author yourname
# → ./my-tool/plugin.json + index.html + README.md
```

`plugin.json` is the manifest: id (`com.yourname.my-tool`), name, version,
commands, optional preferences and permission declarations. Start with the
generated declarative list — it is the smallest thing the host can render.

### 2. Develop with hot reload

Open Frond → **插件中心 / 设置 → 开发插件 → 导入目录** and pick the scaffolded
folder. Every save re-imports the plugin and reloads its views automatically
(the host watches the directory; no dev server needed).

Prefer serving the UI from your own toolchain? Add
`"devServer": "http://localhost:5173"` to `plugin.json` and the launcher will
load that URL instead of the packaged page (plain http is allowed for
localhost only).

The full host API (`window.launcherApi`: renderList, actions, preferences,
HUD, storage, proxied fetch…) is documented in
[PLUGIN_DEV.md](../../PLUGIN_DEV.md) (Chinese) and
[docs/PLUGIN_DEVELOPMENT.md](../../docs/PLUGIN_DEVELOPMENT.md).
Runnable exemplars covering the three common shapes (network+list, minimal
one-command, preferences+network) live in
[examples/](../../examples/) — each with unit-tested core logic.

### 3. Pack

```bash
pnpm plugin pack ./my-tool
# → ./my-tool-release/com.yourname.my-tool-v0.1.0.zip (+ sha256, index-entry.json)
```

The zip root is the folder containing `plugin.json` — exactly the layout the
host's installer expects (20 MB limit, sha256 verified before extraction).

### 4. Host the zip

Upload the zip somewhere with a stable **https** direct link — a GitHub
Release asset works well. Note the URL.

### 5. Publish to your index

A "market" in Frond is just a JSON file:

```json
{ "version": 1, "plugins": [ …entries… ] }
```

`publish` packs, computes sha256, and upserts your entry into that file:

```bash
pnpm plugin publish ./my-tool \
  --index ./my-index.json \
  --download https://github.com/you/releases/download/v0.1.0/com.yourname.my-tool-v0.1.0.zip
```

Host `my-index.json` at an **https** URL (raw.githubusercontent / GitHub Pages
both work). Ship v2 later by bumping `version` in `plugin.json` and re-running
the same command — the entry is replaced in place.

### 6. Users install

In Frond: **插件市场 → 远程索引** → paste your index URL → install. Installed
plugins update automatically within 24h when you publish a higher version —
unless the new version declares **new permissions**, in which case the update
pauses and the user confirms it manually.

## Rules the host enforces (the CLI tells you, not silently drops)

- `id`: word characters, no `..`, must not start with `sys.`
- remote index entries: `download` must be an **https** link
- `sha256`: 64 hex chars, verified before unzip
- permissions are declaration-based: undeclared sensitive APIs
  (clipboard read/write, fs, net, schedule) are refused at runtime

## Windows note

`pack`/`publish` use PowerShell `Compress-Archive` on Windows and `zip`
elsewhere. The publish flow itself is platform-independent.
