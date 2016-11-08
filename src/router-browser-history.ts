// Copyright (c) 2016 Göran Gustafsson. All rights reserved.  
// Licensed under the MIT License. See LICENSE file in the project root for full license information.

import { RouterHistory } from './router-history';

interface RouterHistoryEntry {
	configPath?: string;
	url: string;
	historyTrackId?: string;
}

interface RouterHistoryTrackingRoot {
	nextTrackId: number;
}

export interface RouterHistoryDisposeCallback {
	(historyTrackId: string): void;
}

export class RouterBrowserHistory implements RouterHistory {

	private updateUrlCallback: (() => void) | undefined;
	private urlPathPrefix: string;
	private useHashMode: boolean;
	private useHistoryAPI: boolean;
	private useIFrameState: boolean;
	private stateIFrameId: string | undefined;
	private disposeHistoryEntryCallback: RouterHistoryDisposeCallback | undefined;

	private currentHistoryEntry: RouterHistoryEntry | undefined;
	private historyBackEntries: RouterHistoryEntry[];
	private historyForwardEntries: RouterHistoryEntry[];

	private suppressUpdateUrl: boolean;

	constructor(
				urlPathPrefix: string,
				useHashMode: boolean,
				useIFrameState: boolean,
				stateIFrameId?: string,
				disposeHistoryEntryCallback?: RouterHistoryDisposeCallback) {
		this.urlPathPrefix = urlPathPrefix || '';
		this.useHistoryAPI = !!history.pushState && !!history.replaceState;
		this.useIFrameState = useIFrameState;
		this.useHashMode = useIFrameState || useHashMode || !this.useHistoryAPI;
		this.stateIFrameId = stateIFrameId;
		this.disposeHistoryEntryCallback = disposeHistoryEntryCallback;
		this.currentHistoryEntry = undefined;
		this.historyBackEntries = [];
		this.historyForwardEntries = [];
		this.suppressUpdateUrl = false;
		if(!this.useHashMode && this.urlPathPrefix && (this.urlPathPrefix.charAt(this.urlPathPrefix.length - 1) === '/')) {
			this.urlPathPrefix = this.urlPathPrefix.substring(0, this.urlPathPrefix.length - 1);
		}
	}

	public startHistoryUpdates(updateUrlCallback: () => void): void {
		this.updateUrlCallback = updateUrlCallback;
		if(!this.updateUrlCallback) {
			throw 'Unable to start history updates with null callback';
		}
		const stateIFrame = this.getStateIFrameElement();
		if(this.useIFrameState && !stateIFrame) {
			this.useIFrameState = false;
		}
		if(this.useIFrameState && stateIFrame) {
			this.installEventListener(stateIFrame, 'load', this.updateUrlFromIFrameLoad);
		} else if(this.useHistoryAPI) {
			this.installEventListener(window, 'popstate', this.updateUrlFromPopState);
		}
		this.installEventListener(window, 'hashchange', this.updateUrlFromHashChange);
	}

	public stopHistoryUpdates(): void {
		this.uninstallEventListener(window, 'hashchange', this.updateUrlFromHashChange);
		const stateIFrame = this.getStateIFrameElement();
		if(this.useIFrameState && stateIFrame) {
			this.uninstallEventListener(stateIFrame, 'load', this.updateUrlFromIFrameLoad);
		} else if(this.useHistoryAPI) {
			this.uninstallEventListener(window, 'popstate', this.updateUrlFromPopState);
		}
		this.updateUrlCallback = undefined;
	}

	public init(): void {
		if(this.useIFrameState) {
			this.updateUrlFromIFrameLoad();
		} else if(this.useHistoryAPI) {
			this.updateUrlFromPopState();
		} else {
			this.updateUrlFromHashChange();
		}
	}

	public reloadAtUrl(url: string): void {
		if(this.useHashMode) {
			location.hash = this.buildFullHashUrl(url);
			location.reload(true);
		} else {
			location.pathname = this.urlPathPrefix + url;
			location.reload(true);
		}
	}

	public navigateTo(configPath: string, url: string): void {
		const entry = this.createHistoryState(configPath, url);
		if(this.useIFrameState) {
			this.writeStateIFrame(entry);
			location.replace(this.buildFullHashUrl(entry.url));
		} else if(this.useHistoryAPI) {
			this.writePopState(entry);
			this.updateHistoryEntries(entry);
		} else {
			this.currentHistoryEntry = entry;
			location.hash = '#' + entry.url;
		}
	}

	public getUrl(): string | undefined {
		if(this.useHashMode) {
			if((this.urlPathPrefix && (location.pathname !== this.urlPathPrefix)) || !location.hash || (location.hash.length < 2)) {
				return undefined;
			}
			return location.hash.substring(1);
		} else {
			if(this.urlPathPrefix && (location.pathname.substring(0, this.urlPathPrefix.length + 1) !== this.urlPathPrefix + '/')) {
				return undefined;
			}
			return location.pathname.substring(this.urlPathPrefix ? this.urlPathPrefix.length : 0);
		}
	}

	private getUrlFromOtherMode(): string | undefined {
		if(this.useHashMode) {
			let prefix = this.urlPathPrefix;
			if(prefix && (prefix.charAt(prefix.length - 1) === '/')) {
				prefix = prefix.substring(0, prefix.length - 1);
			}
			if(prefix && (location.pathname.substring(0, prefix.length + 1) !== prefix + '/')) {
				return undefined;
			}
			return location.pathname.substring(prefix ? prefix.length : 0);
		} else {
			if((this.urlPathPrefix
					&& (location.pathname !== this.urlPathPrefix)
					&& (location.pathname !== this.urlPathPrefix + '/')) || !location.hash || (location.hash.length < 2)) {
				return undefined;
			}
			return location.hash.substring(1);
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

	private updateUrlFromHashChange = (): void => {
		if(this.useIFrameState) {
			let entry: RouterHistoryEntry | undefined = this.readStateIFrame();
			if(entry) {
				const url = this.getUrl();
				if(url && (url !== entry.url)) {
					entry = this.createHistoryState(undefined, url);
					this.writeStateIFrame(entry);
				}
			} else {
				let url = this.getUrl();
				if(!url) {
					url = this.getUrlFromOtherMode();
				}
				if(url) {
					entry = this.createHistoryState(undefined, url);
					this.writeStateIFrame(entry);
				}
			}
		} else if(this.useHistoryAPI) {
			this.updateUrlFromPopState();
		} else {
			let url = this.getUrl();
			if(url) {
				if(!this.currentHistoryEntry || (this.currentHistoryEntry.url !== url)) {
					this.currentHistoryEntry = undefined;
					if(this.updateUrlCallback) {
						this.updateUrlCallback();
					}
				}
			} else {
				url = this.getUrlFromOtherMode();
				if(url) {
					location.replace(this.buildFullHashUrl(url));
				}
			}
		}
	};

	private updateUrlFromPopState = (): void => {
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
			this.updateUrlCallback();
		}
	};

	private updateUrlFromIFrameLoad = (): void => {
		let entry = this.readStateIFrame();
		if(entry) {
			location.replace(this.buildFullHashUrl(entry.url));
			this.updateHistoryEntries(entry);
			if(!this.suppressUpdateUrl && this.updateUrlCallback) {
				this.updateUrlCallback();
			}
		} else {
			let url = this.getUrl();
			if(!url) {
				url = this.getUrlFromOtherMode();
			}
			if(url) {
				entry = this.createHistoryState(undefined, url);
				this.writeStateIFrame(entry);
			} else if(this.updateUrlCallback) {
				this.updateUrlCallback();
			}
		}
	};

	private updateHistoryEntries(newEntry: RouterHistoryEntry): void {
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
		if(this.historyBackEntries.length > 50) {
			const oldEntry = this.historyBackEntries.shift();
			if(this.disposeHistoryEntryCallback && oldEntry && oldEntry.historyTrackId) {
				this.disposeHistoryEntryCallback(oldEntry.historyTrackId);
			}
		}
		for(let n = 0; n < this.historyForwardEntries.length; n++) {
			const oldEntry = this.historyForwardEntries[n];
			if(this.disposeHistoryEntryCallback && oldEntry && oldEntry.historyTrackId) {
				this.disposeHistoryEntryCallback(oldEntry.historyTrackId);
			}
		}
		this.historyForwardEntries = [];
	}

	private readPopState(): RouterHistoryEntry | undefined {
		if(history.state) {
			return history.state;
		}
		return undefined;
	}

	private writePopState(entry: RouterHistoryEntry): void {
		let url = entry.url;
		if(this.useHashMode) {
			url = this.buildFullHashUrl(url);
		} else {
			url = this.urlPathPrefix + url;
		}
		history.pushState(entry, '', url);
	}

	private rewritePopState(entry: RouterHistoryEntry): RouterHistoryEntry {
		let url = entry.url;
		if(this.useHashMode) {
			url = this.buildFullHashUrl(url);
		} else {
			url = this.urlPathPrefix + url;
		}
		history.replaceState(entry, '', url);
		return history.state;
	}

	private getStateIFrameElement(): HTMLElement | null {
		if(this.stateIFrameId) {
			return document.getElementById(this.stateIFrameId);
		} else {
			return null;
		}
	}

	private readStateIFrame(): RouterHistoryEntry | undefined {
		const ifrm: HTMLElement | null = this.getStateIFrameElement();
		if(ifrm) {
			const frameDoc: Document = (<any>ifrm).contentDocument ? (<any>ifrm).contentDocument : (<any>ifrm).contentWindow.document;
			if(frameDoc) {
				const entryElem = frameDoc.getElementById('historyEntry');
				if(entryElem) {
					const text = entryElem.textContent ? entryElem.textContent : entryElem.innerText;
					return JSON.parse(text);
				}
			}
		}
		return undefined;
	}

	private writeStateIFrame(entry: RouterHistoryEntry): void {
		const ifrm: HTMLElement | null = this.getStateIFrameElement();
		if(ifrm) {
			const frameDoc: Document = (<any>ifrm).contentDocument ? (<any>ifrm).contentDocument : (<any>ifrm).contentWindow.document;
			if(frameDoc) {
				this.suppressUpdateUrl = true;
				try {
					frameDoc.open();
					frameDoc.write('<html><body id="historyEntry">' + JSON.stringify(entry) + '</body></html>');
					frameDoc.close();
				} finally {
					this.suppressUpdateUrl = false;
				}
			}
		}
	}

	private installEventListener(elem: EventTarget, type: string, listener: (event: any) => void): void {
		if(elem.addEventListener) {
			elem.addEventListener(type, listener, false);
		} else if((<any>elem).attachEvent) {
			(<any>elem).attachEvent('on' + type, listener);
		}
	}

	private uninstallEventListener(elem: EventTarget, type: string, listener: (event: any) => void): void {
		if(elem.removeEventListener) {
			elem.removeEventListener(type, listener, false);
		} else if((<any>elem).detachEvent) {
			(<any>elem).detachEvent('on' + type, listener);
		}
	}

	private createHistoryState(configPath: string | undefined, url: string): RouterHistoryEntry {
		const entry: RouterHistoryEntry = {
			configPath: configPath,
			url: url,
			historyTrackId: this.generateHistoryTrackId()
		};
		return entry;
	}

	private generateHistoryTrackId(): string | undefined {
		if(!sessionStorage || (!this.useHistoryAPI && !this.useIFrameState)) {
			return undefined;
		}
		let trackRoot: RouterHistoryTrackingRoot | undefined = undefined;
		const json = sessionStorage.getItem('routerHistoryTrackRoot');
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
		sessionStorage.setItem('routerHistoryTrackRoot', JSON.stringify(trackRoot));

		return 'routerHistoryTrack' + trackId;
	}

	private buildFullHashUrl(url: string): string {
		return (this.urlPathPrefix ? this.urlPathPrefix : '/') + '#' + url;
	}

}