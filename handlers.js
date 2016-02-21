/*global handlers */
/*global server */
/*global createSharedGroup*/
/*global getGamesListId*/
/*global checkWebRpcArgs*/
/*global currentPlayerId*/
/*global undefinedOrNull*/
/*global getSharedGroupData*/

handlers.onLogin = function (args) {
    'use strict';
    if (args.c) { // newly created
		createSharedGroup(getGamesListId());
	}
};

handlers.pollGamesData = function () {
    'use strict';
    var gameList = {},
        listToLoad = {},
        gameKey = '',
        userKey = '',
        data = {};
    gameList = getSharedGroupData(getGamesListId());
    for (gameKey in gameList) {
        if (gameList.hasOwnProperty(gameKey)) {
            if (gameList[gameKey].Creation.UserId === currentPlayerId) {
                if (!undefinedOrNull(gameList[gameKey].Actors['1']) && gameList[gameKey].Actors['1'].UserId === currentPlayerId) {
                    data[gameKey] = gameList[gameKey].gameData;
                    data[gameKey].pn = 1;
                }
            } else {
                if (undefinedOrNull(listToLoad[gameList[gameKey].Creation.UserId])) {
                    listToLoad[gameList[gameKey].Creation.UserId] = [];
                }
                listToLoad[gameList[gameKey].Creation.UserId].push(gameKey);
            }
        }
    }
    for (userKey in listToLoad) {
        if (listToLoad.hasOwnProperty(userKey)) {
            gameList = getSharedGroupData(getGamesListId(userKey), listToLoad[userKey]);
            for (gameKey in gameList) {
                if (gameList.hasOwnProperty(gameKey)) {
                    data[gameKey] = gameList[gameKey].gameData;
                    data[gameKey].pn = 2;
                }
            }
        }
    }
    return {ResultCode: 0, Data: data};
};

function getDiffData(gameData, clientGame) {
    'use strict';
    var diff = {};
    return diff;
}

handlers.pollData = function (args) {
    'use strict';
    var serverGamesData = handlers.pollGamesData().Data,
        clientGamesList = args.g,
        gameKey = '',
        gameData = {},
        gameState = {},
        data = {u: {}, o: {}, n: {}, ni: {}, ui: {}};
    for (gameKey in serverGamesData) {
        if (serverGamesData.hasOwnProperty(gameKey)) {
            gameData = serverGamesData[gameKey];
            if (clientGamesList.hasOwnProperty(gameKey)) {
                gameState = clientGamesList[gameKey];
                if (gameState.t !== gameData.t || gameState.s !== gameData.s) {
                    data.u[gameKey] = getDiffData(gameData, gameState);
                }
            } else {
                data.n[gameKey] = gameData;
            }
        }
    }
    return {ResultCode: 0, Data: data};
};
