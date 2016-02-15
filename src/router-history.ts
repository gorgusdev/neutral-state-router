// Copyright (c) 2016 Göran Gustafsson. All rights reserved.  
// Licensed under the MIT License. See LICENSE file in the project root for full license information.

export interface RouterHistory {
	
	startHistoryUpdates(updateUrlCallback: () => void): void;
	stopHistoryUpdates(): void;
	
	init(): void;
	
	navigateTo(configPath: string, url: string): void;
	
	getUrl(): string;
	getConfigPath(): string;
	getHistoryTrackId(): string;
	
}