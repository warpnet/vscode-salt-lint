# salt-lint extension for Visual Studio Code

[![Version](https://vsmarketplacebadge.apphb.com/version-short/warpnet.salt-lint.svg?style=flat-square&color=11beac&label=marketplace)](https://marketplace.visualstudio.com/items?itemName=warpnet.salt-lint)
[![Install Count](https://vsmarketplacebadge.apphb.com/installs-short/warpnet.salt-lint.svg?style=flat-square&color=11beac)](https://marketplace.visualstudio.com/items?itemName=warpnet.salt-lint)
[![Rating](https://vsmarketplacebadge.apphb.com/rating-short/warpnet.salt-lint.svg?style=flat-square&color=11beac)](https://marketplace.visualstudio.com/items?itemName=warpnet.salt-lint)

This extension integrates [salt-lint](https://github.com/warpnet/salt-lint/) into VScode

## Requirements

1. Ensure [salt-lint](https://github.com/warpnet/salt-lint/) is installed (`v0.1.0` or newer).
2. Run [`Install Extension`](https://code.visualstudio.com/docs/editor/extension-gallery#_install-an-extension) command from [Command Palette](https://code.visualstudio.com/Docs/editor/codebasics#_command-palette).
3. Search and choose `salt-lint`.

## Options

There are various options that can be configured by making changes to your user or workspace preferences.

Default options are:

```json
{
    "salt-lint.enable": true,
    "salt-lint.run": "onType",
    "salt-lint.executablePath": "salt-lint"
}
```

### Lint onType or onSave

By default the linter will lint as you type. Alternatively, set `salt-lint.run` to `onSave` if you want to lint only when the file is saved (works best if auto-save is on).

```javascript
{
    "salt-lint.run": "onType" // also: "onSave"
}
```

## Acknowledgements

This extension is based on [timonwong's ShellCheck Linter](https://github.com/timonwong/vscode-shellcheck).
