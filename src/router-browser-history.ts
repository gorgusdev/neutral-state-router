// Copyright (c) 2016 Göran Gustafsson. All rights reserved.  
// Licensed under the MIT License. See LICENSE file in the project root for full license information.

import urllite = require('urllite');

import { RouterHistory } from './router-history';

interface RouterHistoryEntry {
	configPath: string;
	url?: string;
	sessionTrackId: string;
}

interface RouterHistoryTrackingRoot {
	nextTrackId: number;
}

export interface RouterHistoryDisposeCallback {
	(historyTrackId: string): void;
}

export class RouterBrowserHistory implements RouterHistory {

	private updateUrlCallback: () => void;
	private urlPathPrefix: string;
	private useHashMode: boolean;
	private useIFrameState: boolean;
	private stateIFrameId: string;
	private disposeHistoryEntryCallback: RouterHistoryDisposeCallback;
		
	private currentHistoryEntry: RouterHistoryEntry;
	private historyBackEntries: RouterHistoryEntry[];
	private historyForwardEntries: RouterHistoryEntry[];
	
	constructor(urlPathPrefix: string, useHashMode: boolean, useIFrameState: boolean, stateIFrameId?: string, disposeHistoryEntryCallback?: RouterHistoryDisposeCallback) {
		this.urlPathPrefix = urlPathPrefix;
		this.useHashMode = useHashMode;
		this.useIFrameState = useIFrameState;
		this.stateIFrameId = stateIFrameId;
		this.disposeHistoryEntryCallback = disposeHistoryEntryCallback;
		this.currentHistoryEntry = null;
		this.historyBackEntries = [];
		this.historyForwardEntries = [];
	}
	
	startHistoryUpdates(updateUrlCallback: () => void) {
		this.updateUrlCallback = updateUrlCallback;
		if(!this.updateUrlCallback) {
			throw "Unable to start history updates with null callback";
		}
		if(this.useIFrameState) {
			this.installEventListener(this.getStateIFrameElement(), 'load', this.updateUrlFromIFrameLoad);
		} else {
			this.installEventListener(window, 'popstate', this.updateUrlFromPopState);
		}
		this.installEventListener(window, 'hashchange', this.updateUrlFromHashChange);
	}	
	
	stopHistoryUpdates() {
		this.uninstallEventListener(window, 'hashchange', this.updateUrlFromHashChange);
		if(this.useIFrameState) {
			this.uninstallEventListener(this.getStateIFrameElement(), 'load', this.updateUrlFromIFrameLoad);
		} else {
			this.uninstallEventListener(window, 'popstate', this.updateUrlFromPopState);
		}
		this.updateUrlCallback = null;
	}
	
	init() {
		if(this.useIFrameState) {
			this.updateUrlFromIFrameLoad();
		} else {
			this.updateUrlFromPopState();
		}
	}
	
	navigateTo(configPath: string, url: string) {
		var entry = this.createHistoryState(configPath, url);
		if(this.useIFrameState) {
			this.writeStateIFrame(entry);
		} else {
			this.writePopState(entry);
		}
		this.updateHistoryEntries(entry);
	}
	
	getUrl(): string {
		if(this.useIFrameState || this.useHashMode) {
			if((this.urlPathPrefix && (location.pathname !== this.urlPathPrefix)) || !location.hash || (location.hash.length < 2)) {
				return null;
			}
			return location.hash.substring(1);
		} else {
			if(this.urlPathPrefix && (location.pathname.substring(0, this.urlPathPrefix.length) !== this.urlPathPrefix + '/')) {
				return null;
			}
			return location.pathname.substring(this.urlPathPrefix ? this.urlPathPrefix.length : 0);
		}
	}
	
	getConfigPath(): string {
		if(this.currentHistoryEntry) {
			return this.currentHistoryEntry.configPath;
		} else {
			return null;
		}
	}
	
	getHistoryTrackId(): string {
		if(this.currentHistoryEntry) {
			return this.currentHistoryEntry.sessionTrackId;
		} else {
			return null;
		}
	}
	
	private updateUrlFromHashChange = () => {
		if(this.currentHistoryEntry && (this.currentHistoryEntry.url === this.getUrl())) {
			return;
		}
		if(this.useIFrameState) {
			var url = this.getUrl();
			var entry: RouterHistoryEntry = null;
			if(url) {
				entry = this.createHistoryState(null, url);
				this.writeStateIFrame(entry);
			}
			this.updateHistoryEntries(entry);
			this.updateUrlCallback();
		} else {
			this.updateUrlFromPopState();
		}
	};
	
	private updateUrlFromPopState = () => {
		var entry = this.readPopState();
		if(!entry) {
			var url = this.getUrl();
			if(url) {
				entry = this.createHistoryState(null, url);
				this.rewritePopState(entry);
			}
		}
		this.updateHistoryEntries(entry);
		this.updateUrlCallback();
	};
	
	private updateUrlFromIFrameLoad = () => {
		var entry = this.readStateIFrame();
		if(entry) {
			location.replace('#' + entry.url);
		} else {
			var url = this.getUrl();
			if(url) {
				entry = this.createHistoryState(null, url);
				this.writeStateIFrame(entry);
			}
		}
		this.updateHistoryEntries(entry);
		this.updateUrlCallback();
	};
	
	private updateHistoryEntries(newEntry: RouterHistoryEntry) {
		this.currentHistoryEntry = newEntry;
		if(!newEntry) {
			return;
		}
		for(var n = this.historyBackEntries.length - 1; n >= 0; n--) {
			var oldEntry = this.historyBackEntries[n];
			if(newEntry.sessionTrackId === oldEntry.sessionTrackId) {
				this.historyForwardEntries = this.historyBackEntries.slice(n + 1).concat(this.historyForwardEntries);
				this.historyBackEntries.splice(n + 1, this.historyBackEntries.length - n);
				return;
			}
		}
		for(var n = 0; n < this.historyForwardEntries.length; n++) {
			var oldEntry = this.historyForwardEntries[n];
			if(newEntry.sessionTrackId === oldEntry.sessionTrackId) {
				this.historyBackEntries = this.historyBackEntries.concat(this.historyForwardEntries.slice(0, n + 1));
				this.historyForwardEntries.splice(0, n + 1);
				return;
			}
		}
		this.currentHistoryEntry = newEntry;
		this.historyBackEntries.push(newEntry);
		if(this.historyBackEntries.length > 50) {
			var oldEntry = this.historyBackEntries.shift();
			if(this.disposeHistoryEntryCallback) {
				this.disposeHistoryEntryCallback(oldEntry.sessionTrackId);
			}
		}
		for(var n = 0; n < this.historyForwardEntries.length; n++) {
			var oldEntry = this.historyForwardEntries[n];
			if(this.disposeHistoryEntryCallback) {
				this.disposeHistoryEntryCallback(oldEntry.sessionTrackId);
			}
		}
		this.historyForwardEntries = [];
	}
	
	private readPopState(): RouterHistoryEntry {
		if(history.state) {
			return history.state;
		}
		return null;
	}
	
	private writePopState(entry: RouterHistoryEntry) {
		var url = entry.url;
		if(this.useHashMode) {
			url = '#' + url;
		}
		history.pushState(entry, '', url);
	}
	
	private rewritePopState(entry: RouterHistoryEntry) {
		var url = entry.url;
		if(this.useHashMode) {
			url = '#' + url;
		}
		history.replaceState(entry, '', url);
	}
	
	private getStateIFrameElement(): HTMLElement {
		return document.getElementById(this.stateIFrameId);
	}

	private readStateIFrame(): RouterHistoryEntry {
		var ifrm: any = this.getStateIFrameElement();
		var frameDoc: Document = ifrm.contentDocument ? ifrm.contentDocument : ifrm.contentWindow.document;
		if(frameDoc) {
			var entryElem = frameDoc.getElementById('historyEntry');
			if(entryElem) {
				var text = entryElem.textContent ? entryElem.textContent : entryElem.innerText;
				return JSON.parse(text);
			}
		}
		return null;
	}
	
	private writeStateIFrame(entry: RouterHistoryEntry)	{
		var ifrm: any = this.getStateIFrameElement();
		var frameDoc: Document = ifrm.contentDocument ? ifrm.contentDocument : ifrm.contentWindow.document;
		if(frameDoc) {
			frameDoc.open();
			frameDoc.write('<html><body id="historyEntry">' + JSON.stringify(entry) + '</body></html>');
			frameDoc.close();
		}
		location.replace('#' + entry.url);
	}
	
	private installEventListener(elem: EventTarget, type: string, listener: (event: any) => void) {
		if(elem.addEventListener) {
			elem.addEventListener(type, listener, false);
		} else if((<any>elem).attachEvent) {
			(<any>elem).attachEvent('on' + type, listener);
		}
	}
	
	private uninstallEventListener(elem: EventTarget, type: string, listener: (event: any) => void) {
		if(elem.removeEventListener) {
			elem.removeEventListener(type, listener, false);
		} else if((<any>elem).detachEvent) {
			(<any>elem).detachEvent('on' + type, listener);
		}
	}
	
	private createHistoryState(configPath: string, url: string): RouterHistoryEntry {
		var entry: RouterHistoryEntry = {
			configPath: configPath,
			url: url,
			sessionTrackId: this.generateHistoryTrackId()
		}
		return entry;
	}
	
	private generateHistoryTrackId(): string {
		var trackRoot: RouterHistoryTrackingRoot = null;
		var json = sessionStorage.getItem('routerHistoryTrackRoot');
		if(json) {
			trackRoot = JSON.parse(json);
		}
		if(!trackRoot) {
			trackRoot = {
				nextTrackId: 1
			};
		}
		var trackId = trackRoot.nextTrackId;
		trackRoot.nextTrackId = trackRoot.nextTrackId + 1;
		sessionStorage.setItem('routerHistoryTrackRoot', JSON.stringify(trackRoot));
		
		return '' + trackId;
	}
	
}