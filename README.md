# Neutral State Router

This URL router is inspired by the AngularJS ui-router. It uses application states that are not
necessarily connected to URLs. The router is meant to be used for client-side web applications
and it's supposed to be framework neutral.

## Installation

```
npm install neutral-state-router --save
```

## Basic Concepts

The two basic tasks of the router are:

1. Listen to URL changes and activate a configured state that matches the new URL.

2. Change the URL to match a configured state in response to a programmatic activation of a
configured state.

### States

The router states are arranged in a tree structure of states and sub states.

States are named when they are added to the router configuration. A specific route can
be referenced by a dot separated path of names. Therefore state names must not contain any
dot characters.

Each state has an optional URL path that will be prepended to any URL path of its sub states.
If the URL of a state starts with a ^ character then URLs from parent states will not be
prepended. Instead the URL is used as is without the ^ character.

Naturally only states with an URL can be activated as the result of an URL change. States with
and without URLs can be activated programmatically by using a dot separated path of names so
long as the state is not flagged as `unrouted`. A state flagged as `unrouted` can never become
the active state even if it has an URL. A state with an URL and flagged as `reloadable` but
**not** `unrouted` can trigger a full page reload when it's activated. The page reload has to
be requested before activation by a call to the `requestReload` method on the router.

The URL will be processed with the path-to-regexp module to handle any path parameters. Any valid
syntax for URLs from the documentation of path-to-regexp should work
(see https://www.npmjs.com/package/path-to-regexp).

When an URL change is detected or a programmatic activation is requested the router will traverse
the tree of configured states to find a state that match a given URL or path of names. This will
result in a list of states from the root of the tree down to the last matched state. If a sub
state can't be found for a state and that state has a `routeExtensionCallback` the callback will
be used to provide an object that will be merged into `configs` of the state. The callback will
only be called once and it has to return a promise or promise like object.

When matching to an URL the list of matched states might be only a prefix match of the full URL.
In that case the router will search backwards in the list for a state with an `errorPath` value.
The activated state will then become the state identified by the dot separated path from `errorPath`
but the URL will remain unchanged.

Once a list of matched states have been found the router will iterate through the list from first
to last matched state. The data object from each state will be merged into a single data object
such that properties from later states will override properties from earlier states. Three
callbacks on the states can modify the data that's merged into the final data object. To determine
which callbacks to use the router looks at the current state compared to the new state:

- Any states that are the same will have the `refreshCallback` called the update the data object.
- Any states that are only in the new state will have the `setupCallback` called to create the
data object for it.
- Any states that are only in the current state will have the `teardownCallback` called on the
data object to allow for any sort of clean up of the data object.

For any keys in the data object that begins with a plus (+) the values are accumulated into an
array from any matched states that have the key in its data object (after `refreshCallback` or
`setupCallback` was called). If the value to accumulate into the array is an array it's
concatenated at the end of the accumulated array otherwise the value is simply pushed. When
all matched states have been processed the accumulated arrays are added to the final data object
with their respective keys without the initial plus (+) character.

### History

To detect changed URLs and to update the current URL on programmtic state activation the router
uses a history object. The standard history object is the `RouterBrowserHistroy` which will
use the history API and/or hash change events to detect URL changes. There is also a feature to
use an iframe to manage the browser history on IE 9 and IE 8.

With `RouterBrowserHistory` each history entry in the browser is assigned a `historyTrackId`.
This ID will come from a counter stored in the `sessionStorage` of the browser. Using the
`historyTrackId` an application can use `sessionStorage` to store data associated with a
browser history entry that can be restored when a previous state is revisited by the user.

## Interface

The router module is written in TypeScript and the normal way to use the router is to use the
singleton instance of the router that is the default export of the module. The router interface
has the following methods:

### Add Config

```javascript
addConfig(configPath: string, config: RouterConfig)
```
- **configPath** A dot separated path of state names to the state that will be configured.

- **config** The configuration of a state and optionally a number of sub states.

Use this method to configure the possible states of the router. This method can be called
multiple times to incrementally build up the configuration. Any states named by `configPath`
that doesn't exist will be created as empty states.

```javascript
interface RouterConfig<UP, QP, SD> {
	url?: string;
	unrouted?: boolean;
	reloadable?: boolean;
	errorPath?: string;
	data?: RouterStateData & SD;
	configs?: RouterConfigMap<UP, QP, SD>;
	routeExtensionCallback?: RouteExtensionCallback<UP, QP, SD>;
	setupCallback?: SetupCallback<UP, QP, SD>;
	refreshCallback?: RefreshCallback<UP, QP, SD>;
	teardownCallback?: TeardownCallback<SD>;
}

interface RouteExtensionCallback<UP, QP, SD> {
	(configPath: string, config: RouterConfig<UP, QP, SD>): Promise<RouterConfigMap<UP, QP, SD>>;
}

interface SetupCallback<UP, QP, SD> {
	(routerState: RouterState<UP, QP, SD>, parentStateData: RouterStateData & SD, currentStateData: RouterStateData & SD): RouterStateData & SD;
}

interface RefreshCallback<UP, QP, SD> {
	(routerState: RouterState<UP, QP, SD>, parentStateData: RouterStateData & SD, currentStateData: RouterStateData & SD): RouterStateData & SD;
}

interface TeardownCallback<SD> {
	(stateData: RouterStateData & SD): void;
}

```
- **url** A part of an URL for this state. The URL needed to reach a state will actually be a concatenation of all
URLs in parent state along with this URL. Path parameters can be captured by including a `/:parameterName` in the
URL. URLs are processed with the path-to-regexp npm module so all of its ways to specified path parameters are
valid here too.

- **unrouted** If set to true, this state can't be reached by an URL or by programmatic navigation. The state will
only be usable as a parent state to add data values.

- **reloadable** If set to true the router can do a full page reload when activating this state. The reload will
only occur if the `requestReload` method has been called before and the state is not unrouted and has an URL.

- **errorPath** A path to a state to activate when a sub state of this state can't be located. This will only
happen as the result of an URL change.

- **data** A map of named values that will be merged into a single map when this state or one of its sub states are
activated. The `data` map is the main way of passing state specific information to the application when a state
change is reported by the router.

- **configs** A map of named sub route configurations. Each key in the map is a name of a state and each value is a
`RouterConfig`.

- **routeExtensionCallback** A callback function that returns a promise object that resolves to a map like the one
used by `configs`. The callback will be called only when the router tries to find a sub state of this state. The
resolved map will then be merged into `configs` and the search for a sub state will continue. This makes lazy
loading modules containing sub states possible.

- **setupCallback** A callback function that will be called to create the state data for a new active state. The
returned state data will be merged into the final state data returned in a state change.

- **refreshCallback** A callback function that will be called to refresh the state data of a state that is already
active.

- **teardownCallback** A callback function that will be called to dispose of the state data for a state that is no
longer active.

### Start
 
```javascript
start<UP, QP, SD>(history: RouterHistory,
	routeFoundCallback: RouteFoundCallback<UP, QP, SD>,
	routeNotFoundCallback?: RouteNotFoundCallback<UP, QP, SD>,
	urlMissingRouteCallback?: UrlMissingRouteCallback,
	transitionBegin?: TransitionBeginCallback,
	transitionCancel?: TransitionCancelCallback,
	transitionEnd?: TransitionEndCallback)
```
To start the router and begin tracking changes in URLs call this method. The history object passed to this method
will be asked to start tracking URL changes for this router. The callback functions will be called when the router
attempts to activate a new state.

```javascript	
interface RouteFoundCallback<UP, QP, SD> {
	(routerState: RouterState<UP, QP, SD>): void;
}

interface RouteNotFoundCallback<UP, QP, SD> {
	(configPath: string | undefined, fullUrl: string | undefined, matchedConfigs: RouterConfig<UP, QP, SD>[] | undefined, error: any): void;
}

interface UrlMissingRouteCallback {
	(): void;
}

interface TransitionBeginCallback {
	(transitionId: number): void;
}

interface TransitionCancelCallback {
	(transitionId: number): void;
}

interface TransitionEndCallback {
	(transitionId: number): void;
}
```

- **routeFoundCallback** This callback will be called when a new state is successfully activated.

- **routeNotFoundCallback** This callback will be called when a new state could not be activated. The `configPath`
and `fullUrl` arguments refer to the state and / or URL that was requested. The `matchedConfigs` argument
contain a prefix of states matched when a changed URL couldn't be fully matched. Finally the `error` argument
is an exception representing the failed state activation.

- **urlMissingRouteCallback** This callback will be called when there is no URL available to respond to. This
could be the case if a hash based history is used but no hash part is present in the URL.

- **transitionBegin** This callback will be called when the router starts the process of finding a new state to
activate.

- **transitionCancel** This callback will be called when the router cancels the current process to find a new state
to activate. The reason for cancelling can be either an error or that a new URL change or programmtic activation
occurred while finding a new state.

- **transitionEnd** This callback will be called when the router finished the activating a new state.

The most important callback is probably the `routeFoundCallback` and its argument `routerState`.

```javascript
interface RouterState<UP, QP, SD> {
	configPath: string;
	url: string;
	urlParams: RouterUrlParams & UP;
	queryParams: RouterQueryParams & QP;
	historyTrackId?: string;
	data: RouterStateData & SD;
}
```

- **configPath** This is the dot separated name of the state that is active. If a state from an `errorPath` is
active for an URL then this property will be the `errorPath`.

- **url** This is the URL from the browser.

- **urlParams** This is a map with the named URL parameters extracted from the active URL.

- **queryParams** This is a map with any query string values from the active URL.

- **historyTrackId** This is an identifier for the current history entry. It can be used to store data that is
to be restored when a user revisits a history entry.

- **data** This is the merged data object from the active state and all its parent states. The properties in this
object can be anything that will tell an application what to display for the active state.

### Stop

```javascript
stop()
```

Call this method to stop the router from reacting to any URL changes or programmatic activations.
 
### Get Current State

```javascript
getCurrentState<UP, QP, SD>(): RouterState<UP, QP, SD>
```

Call this method to get the currently active router state.

### Is Running

```javascript
isRunning(): boolean
```

Check if the router is running by calling this method.

### Request Reload

```javascript
requestReload(): boolean
```

### Navigate To

```javascript
navigateTo<UP, QP, SD>(configPath: string, urlParams: RouterUrlParams & UP,
	queryParams: RouterQueryParams & QP, extraStateData: RouterStateData & SD): Promise<RouterState<UP, QP, SD>>
```

- **configPath** A dot separated path of state names to the state that will be activated.

- **urlParams** A map of named URL parameters that will be used to build the URL of the
activated state.

- **queryParams** A map of named query string parameters that will be added to the URL of the
activated state.

- **extraStateData** A data object that will be merged into the state data of the activated state.
Note that the extra state data will only be available in the callbacks that are called from this
`navigateTo` call. If the state is reactivated by for example a URL change the extra state data
will not be available.

To programmatically activate a state call this method with the dot separated name of the state to
activate. If the URL of the state to activate has any parameters they will be filled in from the
`urlParams` argument. The final URL will have a query string added from the `queryParams` argument.

The method will return a promise object that will resolve with the new router state object if the
requested activation succeeds. Otherwise it will reject with a router exception. All the usual
callbacks will also be called as expected.

The data object of the activated state will have the `extraStateData` object merged into it in any
callbacks triggered by this method.

## Browser Compatibility

For browsers without native Promises a polyfill is needed. The es6-promise is one possible polyfill.

The router should be compatible with latest verions of Chrome, Firefox and Safari. IE8 should work
with ES5 polyfills like es5-shim and es5-sham. IE9 and later should work with only a Promise polyfill.

To get full history functionallity on IE8 and IE9 the `RouterBrowserHistory` must be configured with
a history iframe element.

## TODO

This is still a work in progress. Here are some of the things that needs to be done:

- More unit tests
- More documentation and examples

- - -

> I don't know if it's good, but it's definitely not evil, so I guess it's neutral.
