/*global handlers */
/*global server */
/*global createSharedGroup*/
/*global getGamesListId*/
/*global checkWebRpcArgs*/

handlers.onLogin = function (args) {
    'use strict';
    if (args.c) { // newly created
		createSharedGroup(getGamesListId());
	}
};
