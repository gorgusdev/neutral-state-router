// Copyright (c) 2018 Göran Gustafsson. All rights reserved.
// Licensed under the MIT License. See LICENSE file in the project root for full license information.

import { RouterHistoryDisposeCallback } from './router-types';
import { RouterException } from './router-exception';

interface RouterHistoryEntry {
    configPath?: string;
    url: string;
    historyTrackId?: string;
}

interface RouterHistoryTrackingRoot {
    nextTrackId: number;
}

export class RouterHistoryManager {

    protected updateUrlCallback: (() => Promise<any>) | undefined;
    protected urlPathPrefix: string;
    protected useHashMode: boolean;
    protected browserLocation: Location;
    protected browserHistory: History;
    protected browserStorage: Storage;
    protected maxHistoryEntries: number;
    protected disposeHistoryEntryCallback: RouterHistoryDisposeCallback | undefined;

    protected currentHistoryEntry: RouterHistoryEntry | undefined;
    protected historyBackEntries: RouterHistoryEntry[];
    protected historyForwardEntries: RouterHistoryEntry[];

    constructor(
        urlPathPrefix: string,
        useHashMode: boolean,
        browserLocation: Location = location,
        browserHistory: History = history,
        browserStorage: Storage = sessionStorage,
        maxHistoryEntries: number = 50,
        disposeHistoryEntryCallback?: RouterHistoryDisposeCallback
    ) {
        this.urlPathPrefix = urlPathPrefix || '';
        this.useHashMode = useHashMode;
        this.browserLocation = browserLocation;
        this.browserHistory = browserHistory;
        this.browserStorage = browserStorage;
        this.maxHistoryEntries = maxHistoryEntries;
        this.disposeHistoryEntryCallback = disposeHistoryEntryCallback;
        this.currentHistoryEntry = undefined;
        this.historyBackEntries = [];
        this.historyForwardEntries = [];
        if(!this.useHashMode && this.urlPathPrefix && (this.urlPathPrefix.charAt(this.urlPathPrefix.length - 1) === '/')) {
            this.urlPathPrefix = this.urlPathPrefix.substring(0, this.urlPathPrefix.length - 1);
        }
    }

    public startHistoryUpdates(updateUrlCallback: () => Promise<any>, eventTarget: EventTarget = window): void {
        this.updateUrlCallback = updateUrlCallback;
        if(!this.updateUrlCallback) {
            throw new RouterException('Unable to start history updates with null callback');
        }
        this.installEventListener(eventTarget, 'popstate', this.updateUrlFromPopState);
        this.installEventListener(eventTarget, 'hashchange', this.updateUrlFromHashChange);
    }

    public stopHistoryUpdates(eventTarget: EventTarget = window): void {
        this.uninstallEventListener(eventTarget, 'hashchange', this.updateUrlFromHashChange);
        this.uninstallEventListener(eventTarget, 'popstate', this.updateUrlFromPopState);
        this.updateUrlCallback = undefined;
    }

    public init(): void {
        this.updateUrlFromPopState();
    }

    public reloadAtUrl(url: string): void {
        if(this.useHashMode) {
            this.browserLocation.hash = this.buildFullHashUrl(url);
            this.browserLocation.reload();
        } else {
            this.browserLocation.href = this.urlPathPrefix + url;
        }
    }

    public navigateTo(configPath: string, url: string): void {
        const entry = this.createHistoryState(configPath, url);
        this.writePopState(entry);
        this.updateHistoryEntries(entry);
    }

    public redirectTo(configPath: string, url: string): void {
        const entry = this.createHistoryState(configPath, url);
        this.rewritePopState(entry);
        this.updateHistoryEntries(entry);
    }

    public getUrl(): string | undefined {
        if(this.useHashMode) {
            if(
                (this.urlPathPrefix && (this.browserLocation.pathname !== this.urlPathPrefix))
                || !this.browserLocation.hash
                || (this.browserLocation.hash.length < 2)
            ) {
                return undefined;
            }
            return this.browserLocation.hash.substring(1);
        } else {
            if(this.urlPathPrefix && (this.browserLocation.pathname.substring(0, this.urlPathPrefix.length + 1) !== this.urlPathPrefix + '/')) {
                return undefined;
            }
            return this.browserLocation.pathname.substring(this.urlPathPrefix ? this.urlPathPrefix.length : 0) + this.browserLocation.search;
        }
    }

    public getFullUrl(configUrl: string): string {
        if(this.useHashMode) {
            return this.buildFullHashUrl(configUrl);
        } else {
            return this.urlPathPrefix + configUrl;
        }
    }

    protected getUrlFromOtherMode(): string | undefined {
        if(this.useHashMode) {
            let prefix = this.urlPathPrefix;
            if(prefix && (prefix.charAt(prefix.length - 1) === '/')) {
                prefix = prefix.substring(0, prefix.length - 1);
            }
            if(prefix && (this.browserLocation.pathname.substring(0, prefix.length + 1) !== prefix + '/')) {
                return undefined;
            }
            return this.browserLocation.pathname.substring(prefix ? prefix.length : 0);
        } else {
            if((this.urlPathPrefix
                    && (this.browserLocation.pathname !== this.urlPathPrefix)
                    && (this.browserLocation.pathname !== this.urlPathPrefix + '/')) || !this.browserLocation.hash || (this.browserLocation.hash.length < 2)) {
                return undefined;
            }
            return this.browserLocation.hash.substring(1);
        }
    }

    public getConfigPath(): string | undefined {
        if(this.currentHistoryEntry) {
            return this.currentHistoryEntry.configPath;
        } else {
            return undefined;
        }
    }

    public getHistoryTrackId(): string | undefined {
        if(this.currentHistoryEntry) {
            return this.currentHistoryEntry.historyTrackId;
        } else {
            return undefined;
        }
    }

    protected updateUrlFromHashChange = (): void => {
        this.updateUrlFromPopState();
    }

    protected updateUrlFromPopState = (): void => {
        let entry = this.readPopState();
        if(!entry) {
            let url = this.getUrl();
            if(!url) {
                url = this.getUrlFromOtherMode();
            }
            if(url) {
                entry = this.createHistoryState(undefined, url);
                entry = this.rewritePopState(entry);
            }
        }
        const callUpdate = (this.currentHistoryEntry !== entry) || ((this.currentHistoryEntry === null) && (entry === null));
        if(entry) {
            this.updateHistoryEntries(entry);
        }
        if(callUpdate && this.updateUrlCallback) {
            this.updateUrlCallback().catch(() => {
                // Catch and ignore errors.
                // Error callback will have been called already.
            });
        }
    }

    protected updateHistoryEntries(newEntry: RouterHistoryEntry): void {
        this.currentHistoryEntry = newEntry;
        if(!newEntry || !newEntry.historyTrackId) {
            return;
        }
        for(let n = this.historyBackEntries.length - 1; n >= 0; n--) {
            const oldEntry = this.historyBackEntries[n];
            if(newEntry.historyTrackId === oldEntry.historyTrackId) {
                this.historyForwardEntries = this.historyBackEntries.slice(n + 1).concat(this.historyForwardEntries);
                this.historyBackEntries.splice(n + 1, this.historyBackEntries.length - n);
                return;
            }
        }
        for(let n = 0; n < this.historyForwardEntries.length; n++) {
            const oldEntry = this.historyForwardEntries[n];
            if(newEntry.historyTrackId === oldEntry.historyTrackId) {
                this.historyBackEntries = this.historyBackEntries.concat(this.historyForwardEntries.slice(0, n + 1));
                this.historyForwardEntries.splice(0, n + 1);
                return;
            }
        }
        this.currentHistoryEntry = newEntry;
        this.historyBackEntries.push(newEntry);
        if(this.historyBackEntries.length > this.maxHistoryEntries) {
            const oldEntry = this.historyBackEntries.shift();
            if(this.disposeHistoryEntryCallback && oldEntry && oldEntry.historyTrackId) {
                this.disposeHistoryEntryCallback(oldEntry.historyTrackId);
            }
        }
        for(const oldEntry of this.historyForwardEntries) {
            if(this.disposeHistoryEntryCallback && oldEntry && oldEntry.historyTrackId) {
                this.disposeHistoryEntryCallback(oldEntry.historyTrackId);
            }
        }
        this.historyForwardEntries = [];
    }

    protected readPopState(): RouterHistoryEntry | undefined {
        if(this.browserHistory.state) {
            return this.browserHistory.state;
        }
        return undefined;
    }

    protected writePopState(entry: RouterHistoryEntry): void {
        let url = entry.url;
        if(this.useHashMode) {
            url = this.buildFullHashUrl(url);
        } else {
            url = this.urlPathPrefix + url;
        }
        this.browserHistory.pushState(entry, '', url);
    }

    protected rewritePopState(entry: RouterHistoryEntry): RouterHistoryEntry {
        let url = entry.url;
        if(this.useHashMode) {
            url = this.buildFullHashUrl(url);
        } else {
            url = this.urlPathPrefix + url;
        }
        this.browserHistory.replaceState(entry, '', url);
        return this.browserHistory.state;
    }

    protected installEventListener(elem: EventTarget, type: string, listener: (event: any) => void): void {
        if(elem.addEventListener) {
            elem.addEventListener(type, listener, false);
        } else if((<any>elem).attachEvent) {
            (<any>elem).attachEvent('on' + type, listener);
        }
    }

    protected uninstallEventListener(eventTarget: EventTarget, type: string, listener: (event: any) => void): void {
        if(eventTarget.removeEventListener) {
            eventTarget.removeEventListener(type, listener, false);
        } else if((<any>eventTarget).detachEvent) {
            (<any>eventTarget).detachEvent('on' + type, listener);
        }
    }

    protected createHistoryState(configPath: string | undefined, url: string): RouterHistoryEntry {
        const entry: RouterHistoryEntry = {
            configPath: configPath,
            url: url,
            historyTrackId: this.generateHistoryTrackId()
        };
        return entry;
    }

    protected generateHistoryTrackId(): string | undefined {
        if(!this.browserStorage) {
            return undefined;
        }
        let trackRoot: RouterHistoryTrackingRoot | undefined;
        const json = this.browserStorage.getItem('routerHistoryTrackRoot');
        if(json) {
            trackRoot = JSON.parse(json);
        }
        if(!trackRoot) {
            trackRoot = {
                nextTrackId: 1
            };
        }
        const trackId = trackRoot.nextTrackId;
        trackRoot.nextTrackId = trackRoot.nextTrackId + 1;
        this.browserStorage.setItem('routerHistoryTrackRoot', JSON.stringify(trackRoot));

        return 'routerHistoryTrack' + trackId;
    }

    protected buildFullHashUrl(url: string): string {
        return (this.urlPathPrefix ? this.urlPathPrefix : '/') + '#' + url;
    }

}
