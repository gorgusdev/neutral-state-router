import { Promise } from 'es6-promise';

import router, { RouterBrowserHistory, RouterConfigMap } from '../src/index';

router.addConfig('app', {
	url: '/',
	data: {
		level: 'root'
	},
	errorPath: 'app.error',
	configs: {
		error: {
			data: {
				error: true
			}
		},
		login: {
			url: '/login',
			data: {
				mode: 'public'
			}
		},
		maint: {
			url: '/maint',
			data: {
				level: 'first',
				mode: 'user'
			},
			unrouted: true,
			configs: {
				party: {
					url: '/party',
					configs: {
						detail: {
							url: '/:partyId',
							configs: {
								edit: {
								}
							}
						}
					}
				}
			}
		},
		history: {
			url: '/history',
			unrouted: true,
			routeExtensionCallback: function(): Thenable<RouterConfigMap> {
				console.log('Extend!');
				return new Promise<RouterConfigMap>((resolve, reject) => {
					setTimeout(() => {
						resolve({
							search: {
								url: '/search'
							}
						});
					}, 5000);
				});
			}
		}
	}
});

var msgElem: any = document.getElementById('content');
var msgProp = ('innerText' in msgElem) ? 'innerText' : 'textContent';
console.log(router.rootConfig);
var hist: any = new RouterBrowserHistory('', true, !!(<any>window).useIFrameState, 'historyState');
router.start(hist, (state) => {
	console.log('Found State');
	console.log(state);
	msgElem[msgProp] = JSON.stringify(state);
}, (path, url, partialState, error) => {
	console.log('NotFound: ' + path + ', ' + url);
	msgElem[msgProp] = 'NOT FOUND: ' + JSON.stringify(partialState);
}, () => {
	console.log('Missing URL route path');
	router.navigateTo('app', {}, {});
	msgElem[msgProp] = 'MISSING';
}, (transitionId) => {
	console.log('Transition Begin: ' + transitionId);
}, (transitionId) => {
	console.log('Transition Cancel: ' + transitionId);
}, (transitionId) => {
	console.log('Transition End: ' + transitionId);
});

var elem = document.getElementById('partyEdit');
if(elem.addEventListener) {
	elem.addEventListener('click', (event) => {
		event.preventDefault();
		router.navigateTo('app.maint.party.detail.edit', { 'partyId': '1' }, {});
	});
} else {
	(<any>elem).attachEvent('onclick', (event: any) => {
		event.returnValue = false;
		router.navigateTo('app.maint.party.detail.edit', { 'partyId': '1' }, {});
	});	
}

var elem = document.getElementById('maintNav');
if(elem.addEventListener) {
	elem.addEventListener('click', (event) => {
		event.preventDefault();
		router.navigateTo('app.maint', {}, {});
	});
} else {
	(<any>elem).attachEvent('onclick', (event: any) => {
		event.returnValue = false;
		router.navigateTo('app.maint', {}, {});
	});	
}

Promise.resolve('hello!').then((value) => {
	console.log('Value 1 = ' + value);
	if(value === 'hello') {
		return 'world';
	}
}).then((value2) => {
	console.log('Value 2 = ' + value2);
});