// <reference path="../typings/defs.d.ts"/>

jest.dontMock('../src/router');
jest.dontMock('extend');
jest.dontMock('path-to-regexp');

import { Router } from '../src/router';
import { RouterMemoryHistory } from '../src/router-memory-history';

describe('Router', function() {
	var router: Router;
	
	beforeEach(function() {
		router = new Router();
	});
	
	describe('addConfig', function() {
		it('adds a root config', function() {
			router.addConfig('app', {
				url: '/'
			});
			expect(router.rootConfig.configs).toEqual({ 'app': { url: '/', configs: {} }});
		});
	});
	
	it('start and installs an url update callback', function() {
		var memHistLoc = new RouterMemoryHistory();
		router.start(memHistLoc, () => {});
		expect((<any>memHistLoc.startHistoryUpdates).mock.calls.length).toBe(1);
		//expect(memHistLoc.startHistoryUpdates.mock.calls[0][0]).toBe(router.updateUrl);
	});
	
});
