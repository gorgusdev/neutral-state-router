import { Promise } from 'es6-promise';

import router, { RouterBrowserHistory, RouterConfigMap } from '../src/index';

router.addConfig('a', {
	url: '/',
	data: {
		level: 'first'
	},
	errorPath: 'app.error',
	configs: {
		error: {
			data: {
				error: true
			}
		},
		b1: {
			url: '/b1',
			data: {
				level: 'second'
			},
			unrouted: true,
			configs: {
				c1: {
					url: '/c1',
					data: {
						level: 'third'
					}
				},
				c2: {
					url: '/c2',
					data: {
						level: 'third'
					}
				},
				c3: {
					data: {
						level: 'third'
					},
				},
				c4: {
					url: '/c4/:arg1',
					data: {
						level: 'third'
					}
				}
			}
		},
		b2: {
			url: '/b2',
			unrouted: true,
			data: {
				level: 'second'
			},
			routeExtensionCallback: function(): Thenable<RouterConfigMap> {
				console.log('Extend!');
				return new Promise<RouterConfigMap>((resolve, reject) => {
					setTimeout(() => {
						resolve({
							c1: {
								url: '/c1',
								data: {
									level: 'third'
								}
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
var hist: any = new RouterBrowserHistory('', true, false /*!!(<any>window).useIFrameState*/, 'historyState');
router.start(hist, (state) => {
	console.log('Found State');
	console.log(state);
	msgElem[msgProp] = JSON.stringify(state);
	document.title = 'Test ' + state.historyTrackId;
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


var elem = document.getElementById('b1c1');
if(elem.addEventListener) {
	elem.addEventListener('click', (event) => {
		event.preventDefault();
		router.navigateTo('a.b1.c1', {}, {});
	});
} else {
	(<any>elem).attachEvent('onclick', (event: any) => {
		event.returnValue = false;
		router.navigateTo('a.b1.c1', {}, {});
		return false;
	});	
}

var elem = document.getElementById('b1c2');
if(elem.addEventListener) {
	elem.addEventListener('click', (event) => {
		event.preventDefault();
		router.navigateTo('a.b1.c2', {}, {});
	});
} else {
	(<any>elem).attachEvent('onclick', (event: any) => {
		event.returnValue = false;
		router.navigateTo('a.b1.c2', {}, {});
		return false;
	});	
}

var elem = document.getElementById('b1c3');
if(elem.addEventListener) {
	elem.addEventListener('click', (event) => {
		event.preventDefault();
		router.navigateTo('a.b1.c3', {}, {});
	});
} else {
	(<any>elem).attachEvent('onclick', (event: any) => {
		event.returnValue = false;
		router.navigateTo('a.b1.c3', {}, {});
		return false;
	});	
}

var elem = document.getElementById('b1c4');
if(elem.addEventListener) {
	elem.addEventListener('click', (event) => {
		event.preventDefault();
		router.navigateTo('a.b1.c4', { arg1: 'xyz' }, {});
	});
} else {
	(<any>elem).attachEvent('onclick', (event: any) => {
		event.returnValue = false;
		router.navigateTo('a.b1.c4', { arg1: 'xyz' }, {});
		return false;
	});	
}

var elem = document.getElementById('b2c1');
if(elem.addEventListener) {
	elem.addEventListener('click', (event) => {
		event.preventDefault();
		router.navigateTo('a.b2.c1', {}, {});
	});
} else {
	(<any>elem).attachEvent('onclick', (event: any) => {
		event.returnValue = false;
		router.navigateTo('a.b2.c1', {}, {});
		return false;
	});	
}
