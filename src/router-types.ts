// Copyright (c) 2018 Göran Gustafsson. All rights reserved.
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

export interface RouterState<UP extends RouterUrlParams, QP extends RouterQueryParams, SD extends RouterStateData> {
    configPath: string;
    url: string;
    urlParams: UP;
    queryParams: QP;
    historyTrackId?: string;
    transitionId: number;
    data: SD;
}

export interface RouterConfigMap<UP extends RouterUrlParams, QP extends RouterQueryParams, SD extends RouterStateData, CX> {
    [name: string]: RouterConfig<UP, QP, SD, CX>;
}

export interface RouteExtensionCallback<UP extends RouterUrlParams, QP extends RouterQueryParams, SD extends RouterStateData, CX> {
    (configPath: string, config: RouterConfig<UP, QP, SD, CX>, context?: CX): Promise<RouterConfigMap<UP, QP, SD, CX>>;
}

export interface SetupCallback<UP extends RouterUrlParams, QP extends RouterQueryParams, SD extends RouterStateData, CX> {
    (routerState: RouterState<UP, QP, SD>, parentStateData: SD, currentStateData: SD, context?: CX): SD;
}

export interface RefreshCallback<UP extends RouterUrlParams, QP extends RouterQueryParams, SD extends RouterStateData, CX> {
    (routerState: RouterState<UP, QP, SD>, parentStateData: SD, currentStateData: SD, context?: CX): SD;
}

export interface TeardownCallback<SD extends RouterStateData, CX> {
    (stateData: SD, context?: CX): void;
}

export interface RouterConfig<UP extends RouterUrlParams, QP extends RouterQueryParams, SD extends RouterStateData, CX> {
    url?: string;
    unrouted?: boolean;
    reloadable?: boolean;
    errorPath?: string;
    data?: SD;
    configs?: RouterConfigMap<UP, QP, SD, CX>;

    routeExtensionCallback?: RouteExtensionCallback<UP, QP, SD, CX>;
    setupCallback?: SetupCallback<UP, QP, SD, CX>;
    refreshCallback?: RefreshCallback<UP, QP, SD, CX>;
    teardownCallback?: TeardownCallback<SD, CX>;
}

export interface RouteFoundCallback<UP extends RouterUrlParams, QP extends RouterQueryParams, SD extends RouterStateData, CX> {
    (routerState: RouterState<UP, QP, SD>, context?: CX): void;
}

export interface RouteNotFoundCallback<UP extends RouterUrlParams, QP extends RouterQueryParams, SD extends RouterStateData, CX> {
    (
        configPath: string | undefined,
        fullUrl: string | undefined,
        matchedConfigs: RouterConfig<UP, QP, SD, CX>[] | undefined,
        error: any,
        transitionId: number,
        context?: CX
    ): void;
}

export interface UrlMissingRouteCallback<CX> {
    (transitionId: number, context?: CX): void;
}

export interface TransitionBeginCallback<UP extends RouterUrlParams, QP extends RouterQueryParams, SD extends RouterStateData, CX> {
    (transitionId: number, configPath?: string, urlParams?: UP, queryParams?: QP, extraStateData?: SD, context?: CX): void;
}

export interface TransitionCancelCallback<UP extends RouterUrlParams, QP extends RouterQueryParams, SD extends RouterStateData, CX> {
    (transitionId: number, configPath?: string, urlParams?: UP, queryParams?: QP, extraStateData?: SD, context?: CX): void;
}

export interface TransitionEndCallback<UP extends RouterUrlParams, QP extends RouterQueryParams, SD extends RouterStateData, CX> {
    (transitionId: number, configPath?: string, urlParams?: UP, queryParams?: QP, extraStateData?: SD, context?: CX): void;
}

export interface ContextFromEventCallback<CX> {
    (): CX;
}

export interface RouterHistoryDisposeCallback {
    (historyTrackId: string): void;
}
