// Copyright (c) 2016 Göran Gustafsson. All rights reserved.  
// Licensed under the MIT License. See LICENSE file in the project root for full license information.

import { Promise } from 'es6-promise';

export interface RouterStateData {
	[name: string]: any;
}

export interface RouterUrlParams {
	[name: string]: string;
}

export interface RouterQueryParams {
	[name: string]: string;
}

export interface RouterState {
	configPath: string;
	url: string;
	urlParams: RouterUrlParams;
	queryParams: RouterQueryParams;
	historyTrackId: string;
	data: RouterStateData;
}

export interface RouterConfigMap {
	[name: string]: RouterConfig;
}

export interface RouteExtensionCallback {
	(): Thenable<RouterConfigMap>;
}

export interface SetupCallback {
	(routerState: RouterState, parentStateData: RouterStateData, currentStateData: RouterStateData): RouterStateData;
}

export interface RefreshCallback {
	(routerState: RouterState, parentStateData: RouterStateData, currentStateData: RouterStateData): RouterStateData
}

export interface TeardownCallback {
	(stateData: RouterStateData): void;
}

export interface RouterConfig {
	url?: string;
	unrouted?: boolean;
	reloadable?: boolean;
	errorPath?: string;
	data?: RouterStateData;
	configs?: RouterConfigMap;

	routeExtensionCallback?: RouteExtensionCallback;
	setupCallback?: SetupCallback;
	refreshCallback?: RefreshCallback;
	teardownCallback?: TeardownCallback;
}

export interface RouteFoundCallback {
	(routerState: RouterState): void;
}

export interface RouteNotFoundCallback {
	(configPath: string, fullUrl: string, matchedConfigs: RouterConfig[], error: any): void;
}

export interface UrlMissingRouteCallback {
	(): void;
}

export interface TransitionBeginCallback {
	(transitionId: number): void;
}

export interface TransitionCancelCallback {
	(transitionId: number): void;
}

export interface TransitionEndCallback {
	(transitionId: number): void;
}
