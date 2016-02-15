// Copyright (c) 2016 Göran Gustafsson. All rights reserved.  
// Licensed under the MIT License. See LICENSE file in the project root for full license information.

import { RouterHistory } from './router-history';

export class RouterMemoryHistory implements RouterHistory {

	startHistoryUpdates(updateUrlCallback: () => void) {
		
	}
	
	stopHistoryUpdates() {
		
	}
	
	init() {
		
	}
	
	navigateTo(configPath: string, url: string) {
		
	}
	
	getUrl(): string {
		return '';
	}
	
	getConfigPath(): string {
		return null;
	}

	getHistoryTrackId(): string {
		return null;
	}
	
}