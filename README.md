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

The `RouterConfigExtensionManager` class can be used to create the result of an extension callback.
Using the `RouterConfigExtensionManager` configured states with a specified base path of names can
be built up just like on the main router object.

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

As an alternative to keys with a plus (+) the `setAccumulatedStateDataPropNames` can be called
to set which state data keys to accumulate. Note that the property key names set by the method
will be accumulated in all state data configurations.

The method `setNonInheritedStateDataPropNames` can be used to set a list of property keys that
will exist in the merged state data object only if the keys exists in the state data object of
the last matched state with a value other than `undefined`. The result will be that the
properties set by `setNonInheritedStateDataPropNames` will not be inherited from parent
configured states.


### History

To detect changed URLs and to update the current URL on programmtic state activation the router
uses a history object. The standard history object is the `RouterHistroyManager` which will
use the history API and/or hash change events to detect URL changes.

With `RouterHistoryManager` each history entry in the browser is assigned a `historyTrackId`.
This ID will come from a counter stored in the `sessionStorage` of the browser. Using the
`historyTrackId` an application can use `sessionStorage` to store data associated with a
browser history entry that can be restored when a previous state is revisited by the user.

## Interface

The router class interface has the following methods:

### Constructor

```javascript
Router(
	historyManager: RouterHistoryManager,
	configManager?: RouterConfigManager<UP, QP, SD, CX>,
	stateManager?: RouterStateManager<UP, QP, SD, CX>
)
```

- **historyManager** This manager object is mandatory and will interface with the History API in
the browser. Normally an instance of the `RouterHistoryManager` should be used.

- **configManager** This is an optional manager object that will handle the configured states.

- **stateManager** This is an optional manager object that will handle the current active state
of the router.

The constructor expects a `historyManager` object and optionally a `configManager` and a `stateManager` as arguments.
If either `configManager` and/or `stateManager` is undefined a standard object will be used by the created router object.

### Add Config

```javascript
addConfig(configPath: string, config: RouterConfig<UP, QP, SD, CX>): void
```
- **configPath** A dot separated path of state names to the state that will be configured.

- **config** The configuration of a state and optionally a number of sub states.

Use this method to configure the possible states of the router. This method can be called
multiple times to incrementally build up the configuration. Any states named by `configPath`
that doesn't exist will be created as empty states.

```javascript
interface RouterConfig<UP extends RouterUrlParams, QP extends RouterQueryParams, SD extends RouterStateData, CX> {
	url?: string;
	unrouted?: boolean;
	reloadable?: boolean;
	errorPath?: string;
	data?: RouterStateData & SD;
    configs?: RouterConfigMap<UP, QP, SD, CX>;
    routeExtensionCallback?: RouteExtensionCallback<UP, QP, SD, CX>;
    setupCallback?: SetupCallback<UP, QP, SD, CX>;
    refreshCallback?: RefreshCallback<UP, QP, SD, CX>;
    teardownCallback?: TeardownCallback<SD, CX>;
}

interface RouterConfigMap<UP extends RouterUrlParams, QP extends RouterQueryParams, SD extends RouterStateData, CX> {
    `[`name: string`]`: RouterConfig<UP, QP, SD, CX>;
}

interface RouteExtensionCallback<UP extends RouterUrlParams, QP extends RouterQueryParams, SD extends RouterStateData, CX> {
    (configPath: string, config: RouterConfig<UP, QP, SD, CX>, context?: CX): Promise<RouterConfigMap<UP, QP, SD, CX>>;
}

interface SetupCallback<UP extends RouterUrlParams, QP extends RouterQueryParams, SD extends RouterStateData, CX> {
    (routerState: RouterState<UP, QP, SD>, parentStateData: SD, currentStateData: SD, context?: CX): SD;
}

interface RefreshCallback<UP extends RouterUrlParams, QP extends RouterQueryParams, SD extends RouterStateData, CX> {
    (routerState: RouterState<UP, QP, SD>, parentStateData: SD, currentStateData: SD, context?: CX): SD;
}

interface TeardownCallback<SD extends RouterStateData, CX> {
    (stateData: SD, context?: CX): void;
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
start(options: {
	historyManager: RouterHistoryManager,
	configManager?: RouterConfigManager<UP, QP, SD, CX>,
	stateManager?: RouterStateManager<UP, QP, SD, CX>,
	routeFoundCallback: RouteFoundCallback<UP, QP, SD, CX>,
	routeNotFoundCallback?: RouteNotFoundCallback<UP, QP, SD, CX>,
	urlMissingRouteCallback?: UrlMissingRouteCallback<CX>,
	transitionBegin?: TransitionBeginCallback<UP, QP, SD, CX>,
	transitionCancel?: TransitionCancelCallback<UP, QP, SD, CX>,
	transitionEnd?: TransitionEndCallback<UP, QP, SD, CX>,
	contextFromEventCallback?: ContextFromEventCallback<CX>
}): void
```

```javascript
interface RouterState<UP extends RouterUrlParams, QP extends RouterQueryParams, SD extends RouterStateData> {
    configPath: string;
    url: string;
    urlParams: UP;
    queryParams: QP;
    historyTrackId?: string;
    transitionId: number;
    data: SD;
}
```

- **configPath** This is the dot separated name of the state that is active. If a state from an `errorPath` is
active for an URL then this property will be the `errorPath`.

- **url** This is the URL from the browser.

- **urlParams** This is a map with the named URL parameters extracted from the active URL.

- **queryParams** This is a map with any query string values from the active URL.

- **historyTrackId** This is an identifier for the current history entry. It can be used to store data that is
to be restored when a user revisits a history entry.

- **transitionId** This is the id of the transition that resulted in this router state.

- **data** This is the merged data object from the active state and all its parent states. The properties in this
object can be anything that will tell an application what to display for the active state.

```javascript
interface RouteFoundCallback<UP extends RouterUrlParams, QP extends RouterQueryParams, SD extends RouterStateData, CX> {
    (routerState: RouterState<UP, QP, SD>, context?: CX): void;
}

interface RouteNotFoundCallback<UP extends RouterUrlParams, QP extends RouterQueryParams, SD extends RouterStateData, CX> {
    (
        configPath: string | undefined,
        fullUrl: string | undefined,
        matchedConfigs: RouterConfig<UP, QP, SD, CX>[] | undefined,
        error: any,
        transitionId: number,
        context?: CX
    ): void;
}

interface UrlMissingRouteCallback<CX> {
    (transitionId: number, context?: CX): void;
}

interface TransitionBeginCallback<UP extends RouterUrlParams, QP extends RouterQueryParams, SD extends RouterStateData, CX> {
    (transitionId: number, configPath?: string, urlParams?: UP, queryParams?: QP, extraStateData?: SD, context?: CX): void;
}

interface TransitionCancelCallback<UP extends RouterUrlParams, QP extends RouterQueryParams, SD extends RouterStateData, CX> {
    (transitionId: number, configPath?: string, urlParams?: UP, queryParams?: QP, extraStateData?: SD, context?: CX): void;
}

interface TransitionEndCallback<UP extends RouterUrlParams, QP extends RouterQueryParams, SD extends RouterStateData, CX> {
    (transitionId: number, configPath?: string, urlParams?: UP, queryParams?: QP, extraStateData?: SD, context?: CX): void;
}

interface ContextFromEventCallback<CX> {
    (): CX;
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
activate. If a call to method `navigateTo` triggered this transition the parameters `configPath`, `urlParams`,
`queryParams` and `extraStateData` from that call will be provided to this callback. Otherwise all parameters except
`transitionId` will be `undefined`.

- **transitionCancel** This callback will be called when the router cancels the current process to find a new state
to activate. The reason for cancelling can be either an error or that a new URL change or programmatic activation
occurred while finding a new state. If a call to method `navigateTo` caused the current transition to be cancelled
the parameters `configPath`, `urlParams`, `queryParams` and `extraStateData` from that call will be provided to
this callback. Otherwise all parameters except `transitionId` will be `undefined`.

- **transitionEnd** This callback will be called when the router finished the activating a new state. If a call to method
`navigateTo` triggered this transition the parameters `configPath`, `urlParams`, `queryParams` and `extraStateData` from
that call will be provided to this callback. Otherwise all parameters except `transitionId` will be `undefined`.

- **contextFromEventCallback** This callback will be called when a state change is trigger by a browser event. The
return value from this callback will be used as the context parameter to the other callbacks on the router.

To start the router and begin tracking changes in URLs call this method. The method expects a single object as argument.
Properties on the object are used to configure the router with different callback functions.

### Stop

```javascript
stop()
```

Call this method to stop the router from reacting to any URL changes or programmatic activations.
 
### Get Current State

```javascript
getCurrentState(): RouterState<UP, QP, SD>
```

Call this method to get the currently active router state.

### Get Config Url

```javascript
getConfigUrl(configPath: string, urlParams?: UP, queryParams?: QP): string | undefined
```
- **configPath** A dot separated path of state names to the state that will be activated.

- **urlParams** A map of named URL parameters that will be used to build the URL of the
activated state.

- **queryParams** A map of named query string parameters that will be added to the URL of the
activated state.

Call this method to get the path part of an URL to the router state referenced by `configPath`.
The path will include any URL path prefix setup in the history object.
If the URL of the state to activate has any parameters they will be filled in from the
`urlParams` argument. The final URL will have a query string added from the `queryParams` argument.

The returned URL path will be the closest URL to the router state referenced in `configPath` if the
router state itself doesn't have an URL.

No extension of router configs will happen as a result of calling this method.

**NOTE** The router must be started before this method is called.

### Set Accumulated State Data Prop names

```javascript
setAccumulatedStateDataPropNames(propNames: string[])
```
- **propNames** An array of property key names that will be accumulated.

Call this to set a list of property key names to be accumulated across all state data. The property
key names should not begin with a plus (+).

### Set Non-Inherited State Data Prop names

```javascript
setNonInheritedStateDataPropNames(propNames: string[])
```
- **propNames** An array of property key names that will not be inherited.

Call this to set a list of property key names that will exist in state data only if the last matched
state's state data has the property key with a value other than `undefined`. The check for the property
key will be done in the state data returned from the setup/refresh callback if it exists.

### Is Running

```javascript
isRunning(): boolean
```

Check if the router is running by calling this method.

### Request Reload

```javascript
requestReload(): boolean
```

### Navigate To / Redirect To

```javascript
navigateTo(configPath: string, urlParams?: UP, queryParams?: QP, extraStateData?: SD, context?: CX): Promise<RouterState<UP, QP, SD>>
redirectTo(configPath: string, urlParams?: UP, queryParams?: QP, extraStateData?: SD, context?: CX): Promise<RouterState<UP, QP, SD>>
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

- **context** A object that will be passed to any callbacks called as a result of this method.

To programmatically activate a state call these methods with the dot separated name of the state to
activate. The difference between the methods is that `navigateTo` will create a new browser history
entry while `redirectTo` will replace the current browser history entry.

If the URL of the state to activate has any parameters they will be filled in from the
`urlParams` argument. The final URL will have a query string added from the `queryParams` argument.

The method will return a promise object that will resolve with the new router state object if the
requested activation succeeds. Otherwise it will reject with a router exception. All the usual
callbacks will also be called as expected.

The data object of the activated state will have the `extraStateData` object merged into it in any
callbacks triggered by this method.

## Browser Compatibility

For browsers without native Promises a polyfill is needed. The es6-promise is one possible polyfill.

The router should be compatible with latest verions of Chrome, Firefox, Safari, Edge and IE11.

## TODO

This is still a work in progress. Here are some of the things that needs to be done:

- More unit tests
- More documentation and examples

- - -

> I don't know if it's good, but it's definitely not evil, so I guess it's neutral.
