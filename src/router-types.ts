// Copyright (c) 2016 Göran Gustafsson. All rights reserved.  
// Licensed under the MIT License. See LICENSE file in the project root for full license information.

export interface RouterStateData {
	[name: string]: any;
}

export interface RouterUrlParams {
	[name: string]: string | null | undefined;
}

export interface RouterQueryParams {
	[name: string]: string | string[] | null | undefined;
}

export interface RouterState<UP, QP, SD> {
	configPath: string;
	url: string;
	urlParams: RouterUrlParams & UP;
	queryParams: RouterQueryParams & QP;
	historyTrackId?: string;
	transitionId: number;
	data: RouterStateData & SD;
}

export interface RouterConfigMap<UP, QP, SD> {
	[name: string]: RouterConfig<UP, QP, SD>;
}

export interface RouteExtensionCallback<UP, QP, SD> {
	(configPath: string, config: RouterConfig<UP, QP, SD>): Promise<RouterConfigMap<UP, QP, SD>>;
}

export interface SetupCallback<UP, QP, SD> {
	(routerState: RouterState<UP, QP, SD>, parentStateData: RouterStateData & SD, currentStateData: RouterStateData & SD): RouterStateData & SD;
}

export interface RefreshCallback<UP, QP, SD> {
	(routerState: RouterState<UP, QP, SD>, parentStateData: RouterStateData & SD, currentStateData: RouterStateData & SD): RouterStateData & SD;
}

export interface TeardownCallback<SD> {
	(stateData: RouterStateData & SD): void;
}

export interface RouterConfig<UP, QP, SD> {
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

export interface RouteFoundCallback<UP, QP, SD> {
	(routerState: RouterState<UP, QP, SD>): void;
}

export interface RouteNotFoundCallback<UP, QP, SD> {
	(configPath: string | undefined, fullUrl: string | undefined, matchedConfigs: RouterConfig<UP, QP, SD>[] | undefined, error: any, transitionId: number): void;
}

export interface UrlMissingRouteCallback {
	(transitionId: number): void;
}

export interface TransitionBeginCallback<UP, QP, SD> {
	(transitionId: number, configPath?: string, urlParams?: RouterUrlParams & UP, queryParams?: RouterQueryParams & QP, extraStateData?: RouterStateData & SD): void;
}

export interface TransitionCancelCallback<UP, QP, SD> {
	(transitionId: number, configPath?: string, urlParams?: RouterUrlParams & UP, queryParams?: RouterQueryParams & QP, extraStateData?: RouterStateData & SD): void;
}

export interface TransitionEndCallback<UP, QP, SD> {
	(transitionId: number, configPath?: string, urlParams?: RouterUrlParams & UP, queryParams?: RouterQueryParams & QP, extraStateData?: RouterStateData & SD): void;
}
