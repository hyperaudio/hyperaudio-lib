# hyperaudio-lib

Contains modules that will be useful as part of a hyperaudio-lib.js library, used by developers to create applications.

## Utilities

### Address

The Address Utility is a URL parameter manager,
that works with the History API to update the URL.

To enable the feature, you must initiate it:

```js
// Init the Address utility
HA.Address.init();
```

Use the Address utility:

```js
HA.Address.setParam(name, value);
HA.Address.getParam(name);
```

Examples:

```js
HA.Address.setParam('id', '123456');
var id = HA.Address.getParam('id');
```

See also: HA.getURLParameter(name)

## Build and Deploy

0. find a clean area
1. clone hyperaudio-lib.git (enter directory)
2. npm install
3. grunt build
4. clone hyperaudio-pad.git (enter directory)
5. npm install
6. grunt build
7. deploy webapps/htdocs/pad/dist/hyperaudio-pad.min.js
