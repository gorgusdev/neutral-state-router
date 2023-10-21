// Copyright (c) 2018 Göran Gustafsson. All rights reserved.
// Licensed under the MIT License. See LICENSE file in the project root for full license information.

import queryString from 'query-string';
import urllite from 'urllite';
import { RouterUrlParams, RouterQueryParams, RouterStateData } from './router-types';
import { RouterConfig, RouterState } from './router-types';
import { RouteFoundCallback, RouteNotFoundCallback, UrlMissingRouteCallback, ContextFromEventCallback } from './router-types';
import { TransitionBeginCallback, TransitionCancelCallback, TransitionEndCallback } from './router-types';
import { RouterHistoryManager } from './router-history-manager';
import { RouterConfigManager, RouterPossibleConfigMatch, RouterPossibleConfigs } from './router-config-manager';
import { RouterStateManager } from './router-state-manager';
import { RouterException } from './router-exception';
import { RouterNotFoundException } from './router-not-found-exception';
import { RouterCancelledException } from './router-cancelled-exception';

export class Router<UP extends RouterUrlParams, QP extends RouterQueryParams, SD extends RouterStateData, CX> {

    private history: RouterHistoryManager;
    private config: RouterConfigManager<UP, QP, SD, CX>;
    private state: RouterStateManager<UP, QP, SD, CX>;

    private routeFoundCallback: RouteFoundCallback<UP, QP, SD, CX> | undefined;
    private routeNotFoundCallback: RouteNotFoundCallback<UP, QP, SD, CX> | undefined;
    private urlMissingRouteCallback: UrlMissingRouteCallback<CX> | undefined;
    private transitionBegin: TransitionBeginCallback<UP, QP, SD, CX> | undefined;
    private transitionCancel: TransitionCancelCallback<UP, QP, SD, CX> | undefined;
    private transitionEnd: TransitionEndCallback<UP, QP, SD, CX> | undefined;
    private contextFromEventCallback: ContextFromEventCallback<CX> | undefined;

    private pendingReload: boolean = false;

    private transitionId: number;
    private lastDoneTransitionId: number;

    private running: boolean = false;

    constructor(
        historyManager: RouterHistoryManager,
        configManager?: RouterConfigManager<UP, QP, SD, CX>,
        stateManager?: RouterStateManager<UP, QP, SD, CX>,
    ) {
        this.history = historyManager;
        this.config = configManager || new RouterConfigManager();
        this.state = stateManager || new RouterStateManager();
        this.transitionId = 0;
        this.lastDoneTransitionId = 0;
    }

    public getCurrentState(): RouterState<UP, QP, SD> {
        return this.state.getCurrentState();
    }

    public setAccumulatedStateDataPropNames(propNames: string[]): void {
        this.state.setAccumulatedStateDataPropNames(propNames);
    }

    public setNonInheritedStateDataPropNames(propNames: string[]): void {
        this.state.setNonInheritedStateDataPropNames(propNames);
    }

    public isRunning(): boolean {
        return this.running;
    }

    public requestReload(): void {
        this.pendingReload = true;
    }

    public addConfig(configPath: string, config: RouterConfig<UP, QP, SD, CX>): void {
        this.config.addConfig(configPath, config, this.isRunning());
    }

    public getConfigUrl(configPath: string, urlParams?: UP, queryParams?: QP): string | undefined {
        if(!this.isRunning()) {
            throw new RouterException('Router not running');
        }
        const configUrl = this.config.getConfigUrl(configPath, urlParams, queryParams);
        if(configUrl) {
            return this.history.getFullUrl(configUrl);
        } else {
            return configUrl;
        }
    }

    public start({
        routeFoundCallback,
        routeNotFoundCallback,
        urlMissingRouteCallback,
        transitionBegin,
        transitionCancel,
        transitionEnd,
        contextFromEventCallback
    }: {
        routeFoundCallback: RouteFoundCallback<UP, QP, SD, CX>,
        routeNotFoundCallback?: RouteNotFoundCallback<UP, QP, SD, CX>,
        urlMissingRouteCallback?: UrlMissingRouteCallback<CX>,
        transitionBegin?: TransitionBeginCallback<UP, QP, SD, CX>,
        transitionCancel?: TransitionCancelCallback<UP, QP, SD, CX>,
        transitionEnd?: TransitionEndCallback<UP, QP, SD, CX>,
        contextFromEventCallback?: ContextFromEventCallback<CX>
    }): void {
        if(this.isRunning()) {
            throw new RouterException('Router already running');
        }
        this.routeFoundCallback = routeFoundCallback;
        this.routeNotFoundCallback = routeNotFoundCallback;
        this.urlMissingRouteCallback = urlMissingRouteCallback;
        this.transitionBegin = transitionBegin;
        this.transitionCancel = transitionCancel;
        this.transitionEnd = transitionEnd;
        this.contextFromEventCallback = contextFromEventCallback;
        this.history.startHistoryUpdates(this.updateFromHistory);
        this.config.buildRouterConfigs();
        this.running = true;
        this.history.init();
    }

    public stop(): void {
        if(this.isRunning()) {
            this.history.stopHistoryUpdates();
        }
        this.running = false;
    }

    public navigateTo(
        configPath: string,
        urlParams?: UP,
        queryParams?: QP,
        extraStateData?: SD,
        context?: CX
    ): Promise<RouterState<UP, QP, SD>> {
        return this.changeState(configPath, urlParams, queryParams, extraStateData, context, false);
    }

    public redirectTo(
        configPath: string,
        urlParams?: UP,
        queryParams?: QP,
        extraStateData?: SD,
        context?: CX
    ): Promise<RouterState<UP, QP, SD>> {
        return this.changeState(configPath, urlParams, queryParams, extraStateData, context, true);
    }

    private changeState(
        configPath: string,
        urlParams: UP | undefined,
        queryParams: QP | undefined,
        extraStateData: SD | undefined,
        context: CX | undefined,
        replace: boolean
    ): Promise<RouterState<UP, QP, SD>> {
        if(!this.isRunning()) {
            throw new RouterException('Router is not running');
        }
        const transitionIdSnapshot = this.beginNewTransition(configPath, urlParams, queryParams, extraStateData);
        return new Promise<RouterState<UP, QP, SD>>((resolve, reject) => {
            const configPathParts: string[] = configPath.split('.');
            this.config.findRouterConfigByName(configPathParts, context).then((configs) => {
                if(this.isTransitionCancelled(transitionIdSnapshot)) {
                    reject(new RouterCancelledException());
                    return;
                }
                const newConfig: RouterConfig<UP, QP, SD, CX> = configs[configs.length - 1];
                if(newConfig.unrouted) {
                    throw new RouterNotFoundException('Unable to navigate to unrouted path: ' + configPath, configs);
                }
                const url = this.config.buildConfigStateUrl(configs, urlParams || {} as UP, queryParams || {} as QP);
                if(this.pendingReload && newConfig.url && newConfig.reloadable) {
                    this.history.reloadAtUrl(url);
                }
                if(replace) {
                    this.history.redirectTo(configPath, url);
                } else {
                    this.history.navigateTo(configPath, url);
                }
                const historyTrackId = this.history.getHistoryTrackId();
                const currentState = this.state.updateState(
                    configPath,
                    url,
                    urlParams || {} as UP,
                    queryParams || {} as QP,
                    historyTrackId,
                    transitionIdSnapshot,
                    configs,
                    extraStateData,
                    context
                );
                if(this.routeFoundCallback) {
                    this.routeFoundCallback(currentState, context);
                }
                this.endCurrentTransition(transitionIdSnapshot, configPath, urlParams, queryParams, extraStateData);
                resolve(currentState);
            }).catch((error: Error) => {
                this.fireRouteNotFoundCallback(error, configPath, undefined, transitionIdSnapshot, context);
                if(this.transitionCancel) {
                    this.transitionCancel(transitionIdSnapshot, configPath, urlParams, queryParams, extraStateData);
                }
                reject(error);
            });
        });
    }

    private beginNewTransition(configPath?: string, urlParams?: UP, queryParams?: QP, extraStateData?: SD, context?: CX): number {
        if(this.lastDoneTransitionId < this.transitionId) {
            if(this.transitionCancel) {
                this.transitionCancel(this.transitionId, configPath, urlParams, queryParams, extraStateData, context);
            }
            this.lastDoneTransitionId = this.transitionId;
        }
        this.transitionId = this.transitionId + 1;
        if(this.transitionBegin) {
            this.transitionBegin(this.transitionId, configPath, urlParams, queryParams, extraStateData, context);
        }
        return this.transitionId;
    }

    private isTransitionCancelled(transitionIdSnapshot: number): boolean {
        return transitionIdSnapshot !== this.transitionId;
    }

    private endCurrentTransition(transitionIdSnapshot: number, configPath?: string, urlParams?: UP, queryParams?: QP, extraStateData?: SD, context?: CX): void {
        if(transitionIdSnapshot === this.transitionId) {
            if(this.transitionEnd) {
                this.transitionEnd(this.transitionId, configPath, urlParams, queryParams, extraStateData, context);
            }
            this.lastDoneTransitionId = this.transitionId;
        }
    }

    private cancelCurrentTransition(transitionIdSnapshot: number, context: CX | undefined): void {
        if(this.lastDoneTransitionId < transitionIdSnapshot) {
            if(this.transitionCancel) {
                this.transitionCancel(transitionIdSnapshot, undefined, undefined, undefined, undefined, context);
            }
            this.lastDoneTransitionId = transitionIdSnapshot;
        }
    }

    protected updateFromHistory = (): Promise<RouterState<UP, QP, SD>> => {
        return new Promise((resolve, reject) => {
            if(!this.isRunning()) {
                reject(new RouterException('Router is not running'));
                return;
            }
            const url = this.history.getUrl();
            const configPath = this.history.getConfigPath();
            const context = this.contextFromEventCallback ? this.contextFromEventCallback() : undefined;
            const transitionIdSnapshot = this.beginNewTransition(undefined, undefined, undefined, undefined, context);
            if(!url) {
                if(this.urlMissingRouteCallback) {
                    this.urlMissingRouteCallback(transitionIdSnapshot, context);
                }
                reject(new RouterException('Router missing URL'));
                return;
            }
            const urlParts = urllite(url);
            const queryParams: QP = urlParts.search ? queryString.parse(urlParts.search) : {} as any;
            const historyTrackId = this.history.getHistoryTrackId();
            if(configPath) {
                const configPathParts: string[] = configPath.split('.');
                this.config.findRouterConfigByName(configPathParts, context).then((configs) => {
                    if(this.isTransitionCancelled(transitionIdSnapshot)) {
                        reject(new RouterCancelledException());
                        return;
                    }
                    const state = this.updateStateFromNamedConfig(
                        configPath,
                        url,
                        urlParts.pathname,
                        queryParams,
                        historyTrackId,
                        transitionIdSnapshot,
                        configs,
                        context
                    );
                    this.endCurrentTransition(transitionIdSnapshot);
                    resolve(state);
                }).catch((error: Error) => {
                    this.fireRouteNotFoundCallback(error, configPath, url, transitionIdSnapshot, context);
                    this.cancelCurrentTransition(transitionIdSnapshot, context);
                    reject(error);
                });
            } else {
                let errorPath: string | undefined;
                const findPromise = this.config.findRoutedConfigByUrl(urlParts.pathname, context);
                findPromise.then<RouterPossibleConfigs<UP, QP, SD, CX>>((configMatch: RouterPossibleConfigMatch<UP, QP, SD, CX>) => {
                    if(this.isTransitionCancelled(transitionIdSnapshot)) {
                        return undefined;
                    }
                    if(!configMatch) {
                        throw new RouterNotFoundException('Unable to find state for URL: ' + url, undefined);
                    } else if(configMatch.prefixMatch) {
                        errorPath = this.config.findErrorPathInMatch(configMatch);
                        if(errorPath) {
                            return this.config.findRouterConfigByName(errorPath.split('.'), context);
                        } else {
                            throw new RouterNotFoundException('Unable to find state for URL: ' + url, configMatch.configMatches);
                        }
                    }
                    const newConfig: RouterConfig<UP, QP, SD, CX> = configMatch.configMatches[configMatch.configMatches.length - 1];
                    if(this.pendingReload && newConfig.url && newConfig.reloadable) {
                        this.history.reloadAtUrl(url);
                    }
                    const urlParams: UP = this.config.buildUrlParams(newConfig, configMatch.pathMatches);
                    const currentState = this.state.updateState(
                        configMatch.configPath,
                        url,
                        urlParams,
                        queryParams,
                        historyTrackId,
                        transitionIdSnapshot,
                        configMatch.configMatches,
                        undefined,
                        context
                    );
                    if(this.routeFoundCallback) {
                        this.routeFoundCallback(currentState, context);
                    }
                    this.endCurrentTransition(transitionIdSnapshot);
                    return undefined;
                }).then((configs: RouterPossibleConfigs<UP, QP, SD, CX>) => {
                    if(!configs) {
                        resolve(this.state.getCurrentState());
                        return;
                    }
                    if(this.isTransitionCancelled(transitionIdSnapshot)) {
                        reject(new RouterCancelledException());
                        return;
                    }
                    const state = this.updateStateFromNamedConfig(
                        errorPath || '',
                        url,
                        urlParts.pathname,
                        queryParams,
                        historyTrackId,
                        transitionIdSnapshot,
                        configs,
                        context);
                    this.endCurrentTransition(transitionIdSnapshot);
                    resolve(state);
                }).catch((error: Error) => {
                    this.fireRouteNotFoundCallback(error, undefined, url, transitionIdSnapshot, context);
                    this.cancelCurrentTransition(transitionIdSnapshot, context);
                    reject(error);
                });
            }
        });
    }

    private updateStateFromNamedConfig(
        configPath: string,
        url: string,
        urlPath: string,
        queryParams: QP,
        historyTrackId: string | undefined,
        transitionId: number,
        configs: RouterConfig<UP, QP, SD, CX>[],
        context: CX | undefined
    ): RouterState<UP, QP, SD> {
        const newConfig: RouterConfig<UP, QP, SD, CX> = configs[configs.length - 1];
        if(newConfig.unrouted) {
            throw new RouterNotFoundException('Unable to change to unrouted path: ' + configPath, configs);
        }
        if(this.pendingReload && newConfig.url && newConfig.reloadable) {
            this.history.reloadAtUrl(url);
        }
        const urlParams: UP = this.config.findAndBuildUrlParams(urlPath, configs);
        const currentState = this.state.updateState(configPath, url, urlParams, queryParams, historyTrackId, transitionId, configs, undefined, context);
        if(this.routeFoundCallback) {
            this.routeFoundCallback(currentState, context);
        }
        return currentState;
    }

    private fireRouteNotFoundCallback(
        error: any,
        configPath: string | undefined,
        url: string | undefined,
        transitionId: number,
        context: CX | undefined
    ): void {
        if(this.routeNotFoundCallback) {
            let matchedConfigs: RouterConfig<UP, QP, SD, CX>[] | undefined;
            if(error instanceof RouterNotFoundException) {
                matchedConfigs = (<RouterNotFoundException<UP, QP, SD, CX>>error).matched;
            }
            this.routeNotFoundCallback(configPath, url, matchedConfigs, error, transitionId, context);
        } else {
            this.logError(error);
        }
    }

    private logError(error: any): void {
        /* tslint:disable-next-line */
        if(console && console.error) {
            /* tslint:disable-next-line */
            console.error(error);
        }
    }

}
