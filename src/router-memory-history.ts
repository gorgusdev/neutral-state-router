// Copyright (c) 2016 Göran Gustafsson. All rights reserved.  
// Licensed under the MIT License. See LICENSE file in the project root for full license information.

import { RouterHistory } from './router-history';

export class RouterMemoryHistory implements RouterHistory {

	public startHistoryUpdates(updateUrlCallback: () => void) {
		// Do nothing
	}

	public stopHistoryUpdates() {
		// Do nothing
	}

	public init() {
		// Do nothing
	}

	public reloadAtUrl(url: string) {
		// Do nothing
	}

	public navigateTo(configPath: string, url: string) {
		// Do nothing
	}

	public getUrl(): string | undefined {
		return '';
	}

	public getFullUrl(configUrl: string): string {
		return '';
	}

	public getConfigPath(): string | undefined {
		return undefined;
	}

	public getHistoryTrackId(): string | undefined {
		return undefined;
	}

}
